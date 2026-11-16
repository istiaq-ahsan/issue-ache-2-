const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  getDepartmentMember,
  listDepartmentMembers,
  setDepartmentMemberEnabled,
} = require('../src/services/member-management.service')

test('Authority student and teacher lookups require an active department membership in scope', async () => {
  let listWhere
  await listDepartmentMembers(
    'institution-1',
    'STUDENT',
    { departmentIds: ['department-1'] },
    {
      institutionMembership: {
        findMany: async ({ where }) => { listWhere = where; return [] },
      },
    },
  )
  assert.deepEqual(listWhere.departmentMemberships.some, {
    isActive: true,
    departmentId: { in: ['department-1'] },
  })

  let detailWhere
  await assert.rejects(
    getDepartmentMember('institution-1', 'TEACHER', 'membership-1', {
      departmentIds: ['department-2'],
    }, {
      institutionMembership: {
        findFirst: async ({ where }) => { detailWhere = where; return null },
      },
    }),
    (error) => error.statusCode === 404,
  )
  assert.deepEqual(detailWhere.departmentMemberships.some.departmentId, {
    in: ['department-2'],
  })
})

test('Authority member lists can filter by one assigned department only', async () => {
  let listWhere
  await listDepartmentMembers(
    'institution-1',
    'TEACHER',
    { departmentIds: ['department-1', 'department-2'] },
    {
      institutionMembership: {
        findMany: async ({ where }) => { listWhere = where; return [] },
      },
    },
    'department-2',
  )
  assert.equal(listWhere.departmentMemberships.some.departmentId, 'department-2')

  await assert.rejects(
    listDepartmentMembers(
      'institution-1',
      'TEACHER',
      { departmentIds: ['department-1'] },
      { institutionMembership: { findMany: async () => [] } },
      'department-2',
    ),
    (error) => error.statusCode === 404,
  )
})

test('Authority activation is department-scoped and audits each visible department', async () => {
  const writes = []
  const membership = {
    id: 'membership-1',
    userId: 'student-user',
    status: 'INACTIVE',
    studentId: 'S-100',
    teacherId: null,
    departmentMemberships: [
      { departmentId: 'department-1' },
      { departmentId: 'department-2' },
    ],
  }
  const database = {
    $transaction: async (callback) => callback({
      institutionMembership: {
        findFirst: async ({ where }) => {
          writes.push({ table: 'find', where })
          return membership
        },
        updateMany: async ({ where, data }) => {
          writes.push({ table: 'update', where, data })
          return { count: 1 }
        },
      },
      auditLog: {
        create: async ({ data }) => writes.push({ table: 'audit', data }),
      },
    }),
  }
  await setDepartmentMemberEnabled(
    'institution-1',
    'STUDENT',
    'membership-1',
    true,
    { userId: 'authority-user', membershipId: 'authority-membership' },
    { departmentIds: ['department-1', 'department-2'] },
    database,
  )

  assert.deepEqual(writes.find(({ table }) => table === 'update').where.departmentMemberships.some.departmentId, {
    in: ['department-1', 'department-2'],
  })
  assert.equal(writes.filter(({ table }) => table === 'audit').length, 2)
})
