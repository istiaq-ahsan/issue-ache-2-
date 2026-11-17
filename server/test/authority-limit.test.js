const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  assertDepartmentAuthoritySlot,
  getDepartmentsOverAuthorityLimit,
} = require('../src/services/authority-limit.service')

function activeSubscriptionDatabase(planCode) {
  return {
    subscription: {
      updateMany: async () => ({ count: 0 }),
      findFirst: async () => ({
        id: 'subscription-1',
        institutionId: 'institution-1',
        planCode,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
      }),
    },
  }
}

test('Basic Authority capacity is one enabled, non-deleted Authority per department', async () => {
  const database = {
    ...activeSubscriptionDatabase('BASIC'),
    authorityDepartment: {
      count: async ({ where }) => {
        assert.deepEqual(where, {
          institutionId: 'institution-1',
          departmentId: 'department-1',
          authorityMembership: {
            institutionId: 'institution-1',
            role: 'AUTHORITY',
            status: 'ACTIVE',
            deletedAt: null,
          },
        })
        return 1
      },
    },
  }

  await assert.rejects(
    assertDepartmentAuthoritySlot(database, 'institution-1', 'department-1'),
    (error) =>
      error.code === 'PLAN_LIMIT_REACHED' &&
      error.details.limit === 1 &&
      error.details.current === 1 &&
      error.details.departmentId === 'department-1' &&
      error.details.planCode === 'BASIC',
  )
})

test('Basic capacity in one department does not block an Authority in another department', async () => {
  const database = {
    ...activeSubscriptionDatabase('BASIC'),
    authorityDepartment: {
      count: async ({ where }) => where.departmentId === 'department-1' ? 1 : 0,
    },
  }

  assert.deepEqual(
    await assertDepartmentAuthoritySlot(database, 'institution-1', 'department-2'),
    { limit: 1, current: 0, departmentId: 'department-2', planCode: 'BASIC' },
  )
})

test('Pro allows a third enabled Authority but rejects a fourth', async () => {
  let current = 2
  const database = {
    ...activeSubscriptionDatabase('PRO'),
    authorityDepartment: { count: async () => current },
  }

  assert.deepEqual(
    await assertDepartmentAuthoritySlot(database, 'institution-1', 'department-1'),
    { limit: 3, current: 2, departmentId: 'department-1', planCode: 'PRO' },
  )

  current = 3
  await assert.rejects(
    assertDepartmentAuthoritySlot(database, 'institution-1', 'department-1'),
    (error) => error.code === 'PLAN_LIMIT_REACHED' && error.details.limit === 3,
  )
})

test('transactional Authority capacity checks lock the institution department row first', async () => {
  const calls = []
  const database = {
    ...activeSubscriptionDatabase('PRO'),
    $queryRaw: async (strings, ...values) => {
      calls.push({ query: strings.join('?'), values })
      return [{ id: 'department-1' }]
    },
    authorityDepartment: {
      count: async () => {
        calls.push({ query: 'authority-count' })
        return 0
      },
    },
  }

  await assertDepartmentAuthoritySlot(
    database,
    'institution-1',
    'department-1',
    { lockDepartment: true },
  )

  assert.match(calls[0].query, /FOR UPDATE/)
  assert.deepEqual(calls[0].values, ['department-1', 'institution-1'])
  assert.equal(calls[calls.length - 1].query, 'authority-count')
})

test('Basic downgrade report lists over-limit departments using enabled, non-deleted Authorities', async () => {
  let groupQuery
  const database = {
    authorityDepartment: {
      groupBy: async (args) => {
        groupQuery = args
        return [{
          departmentId: 'department-1',
          _count: { _all: 2 },
        }]
      },
    },
    department: {
      findMany: async ({ where }) => {
        assert.deepEqual(where, {
          institutionId: 'institution-1',
          id: { in: ['department-1'] },
        })
        return [{ id: 'department-1', name: 'Science' }]
      },
    },
  }

  const departments = await getDepartmentsOverAuthorityLimit(
    database,
    'institution-1',
    'BASIC',
  )

  assert.deepEqual(groupQuery.where.authorityMembership, {
    institutionId: 'institution-1',
    role: 'AUTHORITY',
    status: 'ACTIVE',
    deletedAt: null,
  })
  assert.deepEqual(departments, [{
    departmentId: 'department-1',
    enabledAuthorities: 2,
    limit: 1,
    planCode: 'BASIC',
    name: 'Science',
  }])
})
