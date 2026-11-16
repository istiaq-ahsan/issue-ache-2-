const assert = require('node:assert/strict')
const { test } = require('node:test')
const { replaceAuthorityDepartments } = require('../src/services/authority-department.service')

function assignmentDatabase({ current = ['department-1'], validCount = 1 } = {}) {
  const writes = []
  const transaction = {
    $queryRaw: async () => [],
    institutionMembership: {
      findFirst: async () => ({ id: 'authority-membership' }),
    },
    department: {
      count: async () => validCount,
    },
    authorityDepartment: {
      findMany: async () => current.map((departmentId) => ({ departmentId })),
      deleteMany: async (args) => writes.push({ table: 'delete', args }),
      createMany: async ({ data }) => writes.push({ table: 'create', data }),
    },
    auditLog: {
      create: async ({ data }) => writes.push({ table: 'audit', data }),
    },
  }
  const database = {
    $transaction: async (callback) => callback(transaction),
  }
  return { database, writes }
}

test('Authority assignments replace atomically and audit each added or removed department', async () => {
  const { database, writes } = assignmentDatabase()
  await replaceAuthorityDepartments(
    'institution-1',
    'authority-membership',
    ['department-2'],
    'admin-user',
    database,
  )

  assert.equal(writes.find(({ table }) => table === 'delete').args.where.authorityMembershipId, 'authority-membership')
  assert.deepEqual(writes.find(({ table }) => table === 'create').data, [{
    institutionId: 'institution-1',
    authorityMembershipId: 'authority-membership',
    departmentId: 'department-2',
    assignedById: 'admin-user',
  }])
  assert.deepEqual(
    writes.filter(({ table }) => table === 'audit').map(({ data }) => [
      data.action,
      data.departmentId,
    ]),
    [
      ['AUTHORITY_DEPARTMENT_ASSIGNED', 'department-2'],
      ['AUTHORITY_DEPARTMENT_UNASSIGNED', 'department-1'],
    ],
  )
})

test('Authority assignments cannot be emptied or include a foreign department', async () => {
  const { database } = assignmentDatabase()
  await assert.rejects(
    replaceAuthorityDepartments('institution-1', 'authority-membership', [], 'admin-user', database),
    (error) => error.code === 'DEPARTMENT_ASSIGNMENT_REQUIRED',
  )
  await assert.rejects(
    replaceAuthorityDepartments(
      'institution-1',
      'authority-membership',
      ['department-1', 'department-2'],
      'admin-user',
      assignmentDatabase({ validCount: 1 }).database,
    ),
    (error) => error.code === 'DEPARTMENT_ASSIGNMENT_INVALID',
  )
})
