const assert = require('node:assert/strict')
const { test } = require('node:test')
const { getAuthorityDashboard } = require('../src/services/authority-dashboard.service')

test('Authority dashboard counts pending work and issues only in assigned departments', async () => {
  const filters = []
  const result = await getAuthorityDashboard(
    'institution-1',
    { departmentIds: ['department-1'] },
    {
      institutionMembership: {
        count: async ({ where }) => { filters.push(where); return 2 },
      },
      departmentChangeRequest: {
        count: async ({ where }) => { filters.push(where); return 1 },
      },
      issue: {
        groupBy: async ({ where }) => {
          filters.push(where)
          return [{ status: 'OPEN', _count: { _all: 3 } }]
        },
      },
      department: {
        findMany: async ({ where }) => {
          filters.push(where)
          return [{ id: 'department-1', name: 'Science' }]
        },
      },
    },
  )

  assert.deepEqual(filters[0].requestedDepartmentId, { in: ['department-1'] })
  assert.deepEqual(filters[1].OR[0].requestedDepartmentId, { in: ['department-1'] })
  assert.deepEqual(filters[2].departmentId, { in: ['department-1'] })
  assert.equal(result.pendingRegistrations, 2)
  assert.equal(result.pendingDepartmentChanges, 1)
  assert.equal(result.activeIssues, 3)
  assert.deepEqual(result.departments, [{ id: 'department-1', name: 'Science' }])
})

test('Authority dashboard rejects a department filter outside its database scope', async () => {
  await assert.rejects(
    getAuthorityDashboard(
      'institution-1',
      { departmentIds: ['department-1'] },
      {},
      'department-2',
    ),
    (error) => error.statusCode === 404,
  )
})
