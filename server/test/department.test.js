const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  createDepartment,
  deleteDepartment,
  getDepartmentDetails,
  listDepartments,
  updateDepartment,
} = require('../src/services/department.service')
const ApiError = require('../src/utils/api-error')

function createDatabase({ references = {} } = {}) {
  const department = {
    id: 'department-1',
    institutionId: 'institution-1',
    name: 'Science',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
  const auditLogs = []
  let deleted = false
  const transaction = {
    department: {
      create: async ({ data }) => ({ id: 'new-department', ...data }),
      findFirst: async ({ where }) =>
        !deleted && where.id === department.id && where.institutionId === department.institutionId
          ? { ...department }
          : null,
      findMany: async () => [{ ...department }],
      update: async ({ data }) => Object.assign(department, data),
      delete: async () => { deleted = true },
    },
    departmentMembership: { count: async () => references.departmentMemberships || 0 },
    issue: { count: async () => references.issues || 0 },
    authorityDepartment: { count: async () => references.assignedAuthorities || 0 },
    departmentChangeRequest: { count: async () => references.departmentChangeRequests || 0 },
    institutionMembership: { count: async () => references.requestedRegistrations || 0 },
    subscription: { count: async () => references.legacySubscriptions || 0 },
    payment: { count: async () => references.legacyPayments || 0 },
    auditLog: {
      count: async () => references.auditLogs || 0,
      create: async ({ data }) => auditLogs.push(data),
    },
  }
  return {
    auditLogs,
    database: {
      $transaction: async (callback) => callback(transaction),
      department: transaction.department,
    },
    isDeleted: () => deleted,
  }
}

test('departments can be created without a status and are audited', async () => {
  const state = createDatabase()
  const created = await createDepartment(
    'institution-1',
    'Engineering',
    'admin-1',
    state.database,
  )

  assert.equal(created.name, 'Engineering')
  assert.equal('status' in created, false)
  assert.equal(state.auditLogs[0].action, 'DEPARTMENT_CREATED')
})

test('department list does not depend on status or billing history', async () => {
  const state = createDatabase()
  let query
  state.database.department.findMany = async (args) => {
    query = args
    return [{ id: 'department-1', institutionId: 'institution-1', name: 'Science' }]
  }

  const departments = await listDepartments('institution-1', state.database)
  assert.equal(departments[0].name, 'Science')
  assert.deepEqual(query.where, { institutionId: 'institution-1' })
  assert.equal('status' in query.select, false)
})

test('department update is tenant-scoped and audited', async () => {
  const state = createDatabase()
  const result = await updateDepartment(
    'institution-1',
    'department-1',
    'Applied Science',
    'admin-1',
    state.database,
  )

  assert.equal(result.name, 'Applied Science')
  assert.equal(state.auditLogs[0].action, 'DEPARTMENT_UPDATED')
})

test('unused departments can be hard-deleted', async () => {
  const state = createDatabase()
  const result = await deleteDepartment(
    'institution-1',
    'department-1',
    'admin-1',
    state.database,
  )

  assert.deepEqual(result, { id: 'department-1', deleted: true })
  assert.equal(state.isDeleted(), true)
  assert.equal(state.auditLogs[0].action, 'DEPARTMENT_DELETED')
})

test('department deletion reports all blocking references without deleting', async () => {
  const state = createDatabase({
    references: { departmentMemberships: 2, issues: 1, assignedAuthorities: 1 },
  })

  await assert.rejects(
    deleteDepartment('institution-1', 'department-1', 'admin-1', state.database),
    (error) =>
      error instanceof ApiError &&
      error.statusCode === 409 &&
      error.code === 'DEPARTMENT_IN_USE' &&
      error.details.references.departmentMemberships === 2 &&
      error.details.references.issues === 1 &&
      error.details.references.assignedAuthorities === 1,
  )
  assert.equal(state.isDeleted(), false)
  assert.equal(state.auditLogs.length, 0)
})

test('department details retain legacy billing records as read-only history', async () => {
  const state = createDatabase()
  state.database.department.findFirst = async () => ({
    id: 'department-1',
    institutionId: 'institution-1',
    name: 'Science',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { memberships: 0, issues: 0, authorityAssignments: 0 },
    subscriptions: [{ id: 'legacy-subscription' }],
    payments: [{ id: 'legacy-payment' }],
  })
  const details = await getDepartmentDetails(
    'institution-1',
    'department-1',
    state.database,
  )

  assert.deepEqual(details.legacyBillingHistory, {
    subscriptions: [{ id: 'legacy-subscription' }],
    payments: [{ id: 'legacy-payment' }],
  })
})

test('another institution cannot update or delete a department', async () => {
  const state = createDatabase()
  await assert.rejects(
    updateDepartment('institution-2', 'department-1', 'Other', 'admin-1', state.database),
    (error) => error.statusCode === 404 && error.code === 'DEPARTMENT_NOT_FOUND',
  )
  await assert.rejects(
    deleteDepartment('institution-2', 'department-1', 'admin-1', state.database),
    (error) => error.statusCode === 404 && error.code === 'DEPARTMENT_NOT_FOUND',
  )
})
