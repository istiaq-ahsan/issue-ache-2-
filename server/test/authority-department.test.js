const assert = require('node:assert/strict')
const { test } = require('node:test')
const { changeAuthorityDepartment } = require('../src/services/authority-department.service')
const { attachAuthorityScope } = require('../src/middlewares/authority-scope')

function runMiddleware(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error)))
}

function assignmentDatabase({
  status = 'ACTIVE',
  currentDepartmentId = 'department-1',
  targetDepartmentExists = true,
  activeAuthoritiesInTarget = 0,
  planCode = 'PRO',
} = {}) {
  const writes = []
  let assignedDepartmentId = currentDepartmentId
  const departments = {
    'department-1': { id: 'department-1', name: 'Engineering' },
    'department-2': targetDepartmentExists
      ? { id: 'department-2', name: 'Science' }
      : null,
  }
  const transaction = {
    $queryRaw: async (strings, ...values) => {
      writes.push({ table: 'department-lock', query: strings.join('?'), values })
      return targetDepartmentExists ? [{ id: 'department-2' }] : []
    },
    institutionMembership: {
      findFirst: async () => ({
        id: 'authority-membership',
        userId: 'authority-user',
        status,
      }),
    },
    authorityDepartment: {
      findMany: async () => [{
        id: 'assignment-1',
        departmentId: assignedDepartmentId,
        department: departments[assignedDepartmentId],
      }],
      update: async ({ data }) => {
        assignedDepartmentId = data.departmentId
        writes.push({ table: 'assignment-update', data })
        return { department: departments[data.departmentId] }
      },
      count: async () => activeAuthoritiesInTarget,
    },
    department: {
      findFirst: async ({ where }) => departments[where.id] || null,
    },
    subscription: {
      updateMany: async () => ({ count: 0 }),
      findFirst: async () => ({
        id: 'subscription-1',
        planCode,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
      }),
    },
    auditLog: {
      create: async ({ data }) => writes.push({ table: 'audit', data }),
    },
    notification: {
      create: async ({ data }) => writes.push({ table: 'notification', data }),
    },
  }
  return {
    database: { $transaction: async (callback) => callback(transaction) },
    writes,
    getAssignedDepartmentId: () => assignedDepartmentId,
  }
}

test('moving an Authority locks target capacity, updates one row, audits both sides, and notifies the Authority', async () => {
  const state = assignmentDatabase()

  const department = await changeAuthorityDepartment(
    'institution-1',
    'authority-membership',
    'department-2',
    'admin-user',
    state.database,
  )

  assert.deepEqual(department, { id: 'department-2', name: 'Science' })
  assert.equal(state.getAssignedDepartmentId(), 'department-2')
  assert.match(state.writes[0].query, /FOR UPDATE/)
  assert.deepEqual(state.writes[0].values, ['department-2', 'institution-1'])
  assert.deepEqual(
    state.writes.filter(({ table }) => table === 'audit').map(({ data }) => ({
      action: data.action,
      departmentId: data.departmentId,
      oldDepartmentId: data.metadata.oldDepartmentId,
      newDepartmentId: data.metadata.newDepartmentId,
    })),
    [
      {
        action: 'AUTHORITY_DEPARTMENT_UNASSIGNED',
        departmentId: 'department-1',
        oldDepartmentId: 'department-1',
        newDepartmentId: 'department-2',
      },
      {
        action: 'AUTHORITY_DEPARTMENT_ASSIGNED',
        departmentId: 'department-2',
        oldDepartmentId: 'department-1',
        newDepartmentId: 'department-2',
      },
    ],
  )
  assert.deepEqual(state.writes.find(({ table }) => table === 'notification').data, {
    institutionId: 'institution-1',
    departmentId: 'department-2',
    recipientId: 'authority-user',
    recipientMembershipId: 'authority-membership',
    type: 'AUTHORITY_DEPARTMENT_CHANGED',
    title: 'Your department assignment changed',
    message: 'Your Authority access is now assigned to Science.',
    relatedEntityType: 'InstitutionMembership',
    relatedEntityId: 'authority-membership',
  })

  const oldDepartmentAccess = await runMiddleware(
    attachAuthorityScope({
      database: {
        authorityDepartment: {
          findFirst: async () => ({ departmentId: state.getAssignedDepartmentId() }),
        },
      },
    }),
    {
      auth: {
        institutionId: 'institution-1',
        departmentId: 'department-1',
        membership: { id: 'authority-membership', role: 'AUTHORITY' },
      },
    },
  )
  assert.equal(oldDepartmentAccess.statusCode, 404)
  assert.equal(oldDepartmentAccess.code, 'RESOURCE_NOT_FOUND')
})

test('a full target and a cross-tenant department cannot receive an enabled Authority', async () => {
  const full = assignmentDatabase({ activeAuthoritiesInTarget: 3 })
  await assert.rejects(
    changeAuthorityDepartment(
      'institution-1',
      'authority-membership',
      'department-2',
      'admin-user',
      full.database,
    ),
    (error) => error.code === 'PLAN_LIMIT_REACHED' && error.details.limit === 3,
  )
  assert.equal(full.getAssignedDepartmentId(), 'department-1')
  assert.equal(full.writes.some(({ table }) => table === 'assignment-update'), false)

  const foreign = assignmentDatabase({ targetDepartmentExists: false })
  await assert.rejects(
    changeAuthorityDepartment(
      'institution-1',
      'authority-membership',
      'department-2',
      'admin-user',
      foreign.database,
    ),
    (error) => error.statusCode === 404 && error.code === 'DEPARTMENT_NOT_FOUND',
  )
  assert.equal(foreign.writes.some(({ table }) => table === 'assignment-update'), false)
})

test('disabled Authorities do not consume a slot when moved into a full department', async () => {
  const state = assignmentDatabase({
    status: 'INACTIVE',
    activeAuthoritiesInTarget: 1,
    planCode: 'BASIC',
  })

  await changeAuthorityDepartment(
    'institution-1',
    'authority-membership',
    'department-2',
    'admin-user',
    state.database,
  )

  assert.equal(state.getAssignedDepartmentId(), 'department-2')
  assert.equal(state.writes.some(({ table }) => table === 'department-lock'), false)
})

test('an Authority cannot be left unassigned and arrays are rejected', async () => {
  const state = assignmentDatabase()
  await assert.rejects(
    changeAuthorityDepartment(
      'institution-1',
      'authority-membership',
      '',
      'admin-user',
      state.database,
    ),
    (error) => error.code === 'DEPARTMENT_ASSIGNMENT_REQUIRED',
  )
  await assert.rejects(
    changeAuthorityDepartment(
      'institution-1',
      'authority-membership',
      ['department-1', 'department-2'],
      'admin-user',
      state.database,
    ),
    (error) => error.code === 'DEPARTMENT_ASSIGNMENT_REQUIRED',
  )
  assert.equal(state.writes.length, 0)
})
