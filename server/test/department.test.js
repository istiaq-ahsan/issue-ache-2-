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
  const auditLogs = references.auditLogRows || Array.from(
    { length: references.auditLogs || 0 },
    (_, index) => ({
      id: `existing-audit-${index + 1}`,
      institutionId: 'institution-1',
      departmentId: 'department-1',
      metadata: { retained: true },
    }),
  )
  const state = { authorityCountWhere: null, removedDeletedAuthorityAssignments: null }
  let deleted = false
  const transaction = {
    department: {
      create: async ({ data }) => {
        Object.assign(department, { id: 'new-department', ...data })
        return { ...department }
      },
      findFirst: async ({ where }) =>
        !deleted && where.id === department.id && where.institutionId === department.institutionId
          ? { ...department }
          : null,
      findMany: async () => [{ ...department, authorityAssignments: [] }],
      update: async ({ data }) => Object.assign(department, data),
      delete: async () => { deleted = true },
    },
    departmentMembership: { count: async () => references.departmentMemberships || 0 },
    issue: { count: async () => references.issues || 0 },
    authorityDepartment: {
      count: async ({ where }) => {
        state.authorityCountWhere = where
        return Math.max(
          0,
          (references.assignedAuthorities || 0) - (references.softDeletedAuthorities || 0),
        )
      },
      deleteMany: async ({ where }) => {
        state.removedDeletedAuthorityAssignments = where
      },
    },
    departmentChangeRequest: { count: async () => references.departmentChangeRequests || 0 },
    institutionMembership: { count: async () => references.requestedRegistrations || 0 },
    subscription: { count: async () => references.legacySubscriptions || 0 },
    payment: { count: async () => references.legacyPayments || 0 },
    subscription: {
      count: async () => references.legacySubscriptions || 0,
      updateMany: async () => ({ count: 0 }),
      findFirst: async () => null,
    },
    auditLog: {
      count: async () => references.auditLogs || 0,
      create: async ({ data }) => auditLogs.push(data),
    },
  }
  return {
    auditLogs,
    state,
    database: {
      $transaction: async (callback) => callback(transaction),
      department: transaction.department,
      departmentMembership: { count: async () => 0 },
      issue: { count: async () => 0 },
      subscription: transaction.subscription,
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
  assert.equal(state.auditLogs[0].departmentId, 'new-department')
  assert.equal(state.auditLogs[0].metadata.departmentName, 'Engineering')
})

test('department list does not depend on status or billing history', async () => {
  const state = createDatabase()
  let query
  state.database.department.findMany = async (args) => {
    query = args
    return [{
      id: 'department-1',
      institutionId: 'institution-1',
      name: 'Science',
      authorityAssignments: [],
    }]
  }

  const departments = await listDepartments('institution-1', state.database)
  assert.equal(departments[0].name, 'Science')
  assert.deepEqual(query.where, { institutionId: 'institution-1' })
  assert.equal('status' in query.select, false)
  assert.deepEqual(departments[0].authorityUsage, { used: 0, limit: null, planCode: null })
})

test('department list reports capacity using only enabled, non-deleted Authorities', async () => {
  const state = createDatabase()
  state.database.subscription.findFirst = async () => ({
    id: 'subscription-1',
    planCode: 'BASIC',
    status: 'ACTIVE',
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: new Date('2027-01-01T00:00:00Z'),
  })
  state.database.department.findMany = async () => [{
    id: 'department-1',
    institutionId: 'institution-1',
    name: 'Science',
    authorityAssignments: [
      { authorityMembership: { status: 'ACTIVE', deletedAt: null } },
      { authorityMembership: { status: 'INACTIVE', deletedAt: null } },
      { authorityMembership: { status: 'ACTIVE', deletedAt: new Date() } },
    ],
  }]

  const [department] = await listDepartments('institution-1', state.database)

  assert.deepEqual(department.authorityUsage, {
    used: 1,
    limit: 1,
    planCode: 'BASIC',
  })
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

test('soft-deleted Authority assignments do not block department deletion', async () => {
  const state = createDatabase({
    references: { assignedAuthorities: 1, softDeletedAuthorities: 1 },
  })

  const result = await deleteDepartment(
    'institution-1',
    'department-1',
    'admin-1',
    state.database,
  )

  assert.deepEqual(result, { id: 'department-1', deleted: true })
  assert.deepEqual(state.state.authorityCountWhere, {
    institutionId: 'institution-1',
    departmentId: 'department-1',
    authorityMembership: { deletedAt: null },
  })
  assert.deepEqual(state.state.removedDeletedAuthorityAssignments, {
    institutionId: 'institution-1',
    departmentId: 'department-1',
    authorityMembership: { deletedAt: { not: null } },
  })
})

test('department with only audit history is deleted and audit rows retain its id and name', async () => {
  const row = {
    id: 'audit-with-department',
    institutionId: 'institution-1',
    departmentId: 'department-1',
    metadata: { departmentId: 'department-1', departmentName: 'Science' },
  }
  const state = createDatabase({
    references: { auditLogs: 1, auditLogRows: [row] },
  })

  const result = await deleteDepartment(
    'institution-1',
    'department-1',
    'admin-1',
    state.database,
  )

  assert.deepEqual(result, { id: 'department-1', deleted: true })
  assert.equal(state.isDeleted(), true)
  assert.equal(state.auditLogs.length, 2)
  assert.equal(state.auditLogs[0].departmentId, 'department-1')
  assert.equal(state.auditLogs[0].metadata.departmentId, 'department-1')
  assert.equal(state.auditLogs[0].metadata.departmentName, 'Science')
  assert.equal(state.auditLogs[1].departmentId, 'department-1')
  assert.equal(state.auditLogs[1].metadata.departmentName, 'Science')
})

test('department details retain legacy billing records as read-only history', async () => {
  const state = createDatabase()
  state.database.subscription.findFirst = async () => ({
    id: 'subscription-1',
    planCode: 'PRO',
    status: 'ACTIVE',
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: new Date('2027-01-01T00:00:00Z'),
  })
  state.database.department.findFirst = async () => ({
    id: 'department-1',
    institutionId: 'institution-1',
    name: 'Science',
    createdAt: new Date(),
    updatedAt: new Date(),
    authorityAssignments: [
      {
        authorityMembership: {
          id: 'active-authority',
          role: 'AUTHORITY',
          status: 'ACTIVE',
          deletedAt: null,
          user: { name: 'Active Authority', email: 'active@example.edu' },
        },
      },
      {
        authorityMembership: {
          id: 'disabled-authority',
          role: 'AUTHORITY',
          status: 'INACTIVE',
          deletedAt: null,
          user: { name: 'Disabled Authority', email: 'disabled@example.edu' },
        },
      },
      {
        authorityMembership: {
          id: 'deleted-authority',
          role: 'AUTHORITY',
          status: 'INACTIVE',
          deletedAt: new Date(),
          user: { name: 'Deleted Authority', email: 'deleted@example.edu' },
        },
      },
    ],
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
  assert.equal(details.usage.authorities, 1)
  assert.deepEqual(details.authorityUsage, { used: 1, limit: 3, planCode: 'PRO' })
  assert.deepEqual(details.authorityAssignments.map(({ id }) => id), [
    'active-authority',
    'disabled-authority',
  ])
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
