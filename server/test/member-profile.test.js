const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  cancelMemberDepartmentChange,
  createDepartmentChangeRequest,
  decideDepartmentChange,
  getAuthorityDepartmentChange,
  listAuthorityDepartmentChanges,
} = require('../src/services/department-change.service')
const {
  getMemberProfile,
  updateMemberProfile,
} = require('../src/services/member-profile.service')

function activeMembership(role = 'STUDENT') {
  return {
    id: 'membership-1',
    institutionId: 'institution-1',
    userId: 'user-1',
    role,
    status: 'ACTIVE',
    deletedAt: null,
    departmentMemberships: [
      {
        id: 'dm-primary',
        departmentId: 'department-current',
        isPrimary: true,
        department: { id: 'department-current', name: 'Current' },
      },
      ...(role === 'TEACHER'
        ? [{
            id: 'dm-other',
            departmentId: 'department-other',
            isPrimary: false,
            department: { id: 'department-other', name: 'Other' },
          }]
        : []),
    ],
  }
}

function changeRequest(overrides = {}) {
  return {
    id: 'request-1',
    institutionId: 'institution-1',
    institutionId: 'institution-1',
    membershipId: 'membership-1',
    changeType: 'STUDENT_CHANGE',
    currentDepartmentId: 'department-current',
    requestedDepartmentId: 'department-next',
    replacementDepartmentId: null,
    requestedById: 'user-1',
    status: 'PENDING',
    membership: { role: 'STUDENT', user: { name: 'Student Person' } },
    ...overrides,
  }
}

function requestDatabase({
  role = 'STUDENT',
  membership = activeMembership(role),
  requestedDepartment = { id: 'department-next', name: 'Next Department' },
  createError,
} = {}) {
  const writes = []
  const transaction = {
    institutionMembership: {
      findFirst: async () => membership,
    },
    authorityDepartment: {
      findMany: async ({ where }) => (where.departmentId.in || []).map((departmentId) => ({
        departmentId,
        authorityMembership: { id: 'authority-membership', userId: 'authority-user' },
      })),
    },
    department: {
      findFirst: async () => requestedDepartment,
    },
    departmentChangeRequest: {
      create: async ({ data }) => {
        writes.push({ table: 'request', data })
        if (createError) throw createError
        return { id: 'request-1', status: 'PENDING', changeType: data.changeType, requestedAt: new Date() }
      },
    },
    notification: {
      createMany: async ({ data }) => writes.push({ table: 'authorityNotifications', data }),
    },
    auditLog: {
      create: async ({ data }) => writes.push({ table: 'audit', data }),
    },
  }
  return {
    writes,
    database: { $transaction: async (callback) => callback(transaction) },
  }
}

function authorityDecisionDatabase({
  request = changeRequest(),
  department = { id: 'department-next' },
  updateCount = 1,
  existingRows = {},
} = {}) {
  const writes = []
  const transaction = {
    departmentChangeRequest: {
      findFirst: async ({ where }) => (
        where.institutionId === request.institutionId || request.institutionId === undefined
          ? request
          : null
      ),
      updateMany: async (args) => {
        writes.push({ table: 'requestUpdate', ...args })
        return { count: updateCount }
      },
    },
    department: {
      findFirst: async () => department,
    },
    departmentMembership: {
      findFirst: async ({ where }) => {
        const key = `${where.membershipId}:${where.departmentId}`
        return existingRows[key] || { id: `row-${where.departmentId}`, isActive: true }
      },
      findUnique: async ({ where }) => ({ id: where.id }),
      update: async (args) => writes.push({ table: 'departmentMembershipUpdate', ...args }),
      create: async ({ data }) => writes.push({ table: 'departmentMembershipCreate', data }),
    },
    notification: {
      create: async ({ data }) => writes.push({ table: 'notification', data }),
    },
    auditLog: {
      create: async ({ data }) => writes.push({ table: 'audit', data }),
    },
  }
  return { writes, database: { $transaction: async (callback) => callback(transaction) } }
}

const requester = { userId: 'user-1', membershipId: 'membership-1' }
const reviewer = { userId: 'authority-user', membershipId: 'authority-membership' }

test('profile is scoped to the current active membership and exposes only profile data', async () => {
  const database = {
    institutionMembership: {
      findFirst: async ({ where }) => {
        assert.deepEqual(where, { id: 'membership-1', institutionId: 'institution-1', deletedAt: null })
        return {
          ...activeMembership(),
          studentId: 'S-100',
          institution: { id: 'institution-1', name: 'Campus', institutionCode: 'IA-CAMPUS' },
          departmentMemberships: [{
            id: 'dm-1',
            departmentId: 'department-current',
            isPrimary: true,
            department: { id: 'department-current', name: 'Current' },
          }],
          user: { id: 'user-1', name: 'Student Person', email: 'student@example.edu', phone: '123' },
        }
      },
    },
    department: {
      findMany: async () => [{ id: 'department-next', name: 'Next' }],
    },
  }

  const profile = await getMemberProfile('institution-1', 'membership-1', database)
  assert.equal(profile.officialId, 'S-100')
  assert.equal(profile.institution.name, 'Campus')
  assert.equal(profile.departments[0].isPrimary, true)
  assert.deepEqual(profile.availableDepartments, [{ id: 'department-next', name: 'Next' }])
})

test('profile updates are limited to the validated name and phone fields', async () => {
  const updates = []
  const database = {
    institutionMembership: {
      findFirst: async () => ({
        ...activeMembership(),
        studentId: 'S-100',
        institution: { id: 'institution-1', name: 'Campus', institutionCode: 'IA-CAMPUS' },
        departmentMemberships: [],
        user: { id: 'user-1', name: 'New Name', email: 'student@example.edu', phone: '555' },
      }),
    },
    user: { update: async (args) => updates.push(args) },
    department: { findMany: async () => [] },
  }

  const profile = await updateMemberProfile(
    'institution-1',
    'membership-1',
    { name: 'New Name', phone: '555' },
    database,
  )

  assert.deepEqual(updates, [{ where: { id: 'user-1' }, data: { name: 'New Name', phone: '555' } }])
  assert.equal(profile.user.email, 'student@example.edu')
})

test('inactive profile membership is rejected', async () => {
  await assert.rejects(
    getMemberProfile('institution-1', 'membership-1', {
      institutionMembership: {
        findFirst: async () => ({ ...activeMembership(), status: 'INACTIVE' }),
      },
    }),
    (error) => error.statusCode === 403 && error.code === 'MEMBERSHIP_NOT_ACTIVE',
  )
})

test('Student department change derives current primary from server membership and submits pending request', async () => {
  const { database, writes } = requestDatabase()
  await createDepartmentChangeRequest(
    'institution-1',
    'membership-1',
    'user-1',
    {
      changeType: 'STUDENT_CHANGE',
      requestedDepartmentId: 'department-next',
      reason: 'Academic transfer',
    },
    { database },
  )

  const saved = writes.find(({ table }) => table === 'request').data
  assert.equal(saved.currentDepartmentId, 'department-current')
  assert.equal(saved.requestedDepartmentId, 'department-next')
  assert.equal(saved.requestedById, 'user-1')
  assert.equal(saved.status, undefined)
  assert.equal(writes.find(({ table }) => table === 'authorityNotifications').data[0].recipientId, 'authority-user')
})

test('Student cannot request teacher changes or directly choose a current department', async () => {
  const { database } = requestDatabase()
  await assert.rejects(
    createDepartmentChangeRequest('institution-1', 'membership-1', 'user-1', {
      changeType: 'TEACHER_ADD',
      requestedDepartmentId: 'department-next',
      reason: 'Add',
    }, { database }),
    (error) => error.statusCode === 403 && error.code === 'ROLE_NOT_AUTHORIZED',
  )
  await assert.rejects(
    createDepartmentChangeRequest('institution-1', 'membership-1', 'user-1', {
      changeType: 'STUDENT_CHANGE',
      requestedDepartmentId: 'department-current',
      reason: 'Same department',
    }, { database }),
    (error) => error.statusCode === 409,
  )
})

test('foreign or missing requested department is denied', async () => {
  const { database } = requestDatabase({ requestedDepartment: null })
  await assert.rejects(
    createDepartmentChangeRequest('institution-1', 'membership-1', 'user-1', {
      changeType: 'STUDENT_CHANGE',
      requestedDepartmentId: 'department-foreign',
      reason: 'Transfer',
    }, { database }),
    (error) => error.statusCode === 404 && error.code === 'DEPARTMENT_NOT_FOUND',
  )
})

test('a member cannot request changes for another user membership', async () => {
  const { database } = requestDatabase()
  await assert.rejects(
    createDepartmentChangeRequest('institution-1', 'membership-1', 'someone-else', {
      changeType: 'STUDENT_CHANGE',
      requestedDepartmentId: 'department-next',
      reason: 'Transfer',
    }, { database }),
    (error) => error.statusCode === 403 && error.code === 'MEMBERSHIP_ACCESS_DENIED',
  )
})

test('membership lookup is institution-scoped', async () => {
  let where
  await assert.rejects(
    createDepartmentChangeRequest('institution-2', 'membership-1', 'user-1', {
      changeType: 'STUDENT_CHANGE',
      requestedDepartmentId: 'department-next',
      reason: 'Transfer',
    }, {
      database: requestDatabase({
        membership: null,
      }).database,
    }),
    (error) => error.statusCode === 403 && error.code === 'MEMBERSHIP_NOT_ACTIVE',
  )

  const database = requestDatabase().database
  const originalTransaction = database.$transaction
  database.$transaction = (callback) => originalTransaction((transaction) => {
    transaction.institutionMembership.findFirst = async (args) => {
      where = args.where
      return null
    }
    return callback(transaction)
  })
  await assert.rejects(
    createDepartmentChangeRequest('institution-2', 'membership-1', 'user-1', {
      changeType: 'STUDENT_CHANGE',
      requestedDepartmentId: 'department-next',
      reason: 'Transfer',
    }, { database }),
    (error) => error.statusCode === 403,
  )
  assert.equal(where.institutionId, 'institution-2')
})

test('duplicate pending request is returned as a conflict', async () => {
  const { database } = requestDatabase({
    createError: Object.assign(new Error('unique'), { code: 'P2002' }),
  })
  await assert.rejects(
    createDepartmentChangeRequest('institution-1', 'membership-1', 'user-1', {
      changeType: 'STUDENT_CHANGE',
      requestedDepartmentId: 'department-next',
      reason: 'Transfer',
    }, { database }),
    (error) => error.statusCode === 409 && error.code === 'PENDING_DEPARTMENT_CHANGE_EXISTS',
  )
})

test('Teacher can request add and primary-change only to eligible departments', async () => {
  const added = requestDatabase({ role: 'TEACHER' })
  await createDepartmentChangeRequest('institution-1', 'membership-1', 'user-1', {
    changeType: 'TEACHER_ADD',
    requestedDepartmentId: 'department-next',
    reason: 'Teaching assignment',
  }, { database: added.database })
  assert.equal(added.writes.find(({ table }) => table === 'request').data.currentDepartmentId, null)

  const primary = requestDatabase({ role: 'TEACHER' })
  await createDepartmentChangeRequest('institution-1', 'membership-1', 'user-1', {
    changeType: 'TEACHER_PRIMARY_CHANGE',
    requestedDepartmentId: 'department-other',
    reason: 'Primary assignment',
  }, { database: primary.database })
  assert.equal(primary.writes.find(({ table }) => table === 'request').data.currentDepartmentId, 'department-current')
})

test('Teacher removing primary requires a distinct active replacement', async () => {
  const { database, writes } = requestDatabase({ role: 'TEACHER' })
  await createDepartmentChangeRequest('institution-1', 'membership-1', 'user-1', {
    changeType: 'TEACHER_REMOVE',
    currentDepartmentId: 'department-current',
    replacementDepartmentId: 'department-other',
    reason: 'Assignment change',
  }, { database })

  const data = writes.find(({ table }) => table === 'request').data
  assert.equal(data.requestedDepartmentId, null)
  assert.equal(data.replacementDepartmentId, 'department-other')
})

test('Authority can view requests tied to either department but only target scope can decide', async () => {
  let listWhere
  await listAuthorityDepartmentChanges(
    'institution-1',
    {},
    {
      departmentChangeRequest: {
        findMany: async ({ where }) => { listWhere = where; return [] },
      },
    },
    { departmentIds: ['department-current'] },
  )
  assert.deepEqual(listWhere.OR, [
    { requestedDepartmentId: { in: ['department-current'] } },
    { currentDepartmentId: { in: ['department-current'] } },
    { replacementDepartmentId: { in: ['department-current'] } },
  ])

  let detailWhere
  await getAuthorityDepartmentChange(
    'institution-1',
    'request-1',
    {
      departmentChangeRequest: {
        findFirst: async ({ where }) => { detailWhere = where; return null },
      },
    },
    { departmentIds: ['department-current'] },
  ).catch((error) => {
    assert.equal(error.statusCode, 404)
  })
  assert.equal(detailWhere.institutionId, 'institution-1')

  let updateCalled = false
  const database = {
    $transaction: async (callback) => callback({
      departmentChangeRequest: {
        findFirst: async ({ where }) => {
          const matches = where.OR.some((condition) =>
            condition.requestedDepartmentId?.in?.includes('department-current') ||
            (condition.requestedDepartmentId === null &&
              condition.currentDepartmentId?.in?.includes('department-current')),
          )
          return matches ? changeRequest() : null
        },
        updateMany: async () => { updateCalled = true; return { count: 1 } },
      },
    }),
  }
  await assert.rejects(
    decideDepartmentChange(
      'institution-1',
      'request-1',
      reviewer,
      'APPROVED',
      { database, scope: { departmentIds: ['department-current'] } },
    ),
    (error) => error.statusCode === 404,
  )
  assert.equal(updateCalled, false)
})

test('Approval moves Student department memberships atomically and records reviewer, audit, and notification', async () => {
  const { database, writes } = authorityDecisionDatabase()
  const result = await decideDepartmentChange('institution-1', 'request-1', reviewer, 'APPROVED', { database })

  assert.equal(result.status, 'APPROVED')
  const updates = writes.filter(({ table }) => table === 'departmentMembershipUpdate')
  assert.ok(writes.findIndex(({ table }) => table === 'requestUpdate') < writes.findIndex(({ table }) => table === 'departmentMembershipUpdate'))
  assert.deepEqual(updates.map(({ data }) => data), [
    { isActive: false, isPrimary: false },
    { isActive: true, isPrimary: true },
  ])
  assert.equal(writes.find(({ table }) => table === 'requestUpdate').data.reviewedByMembershipId, 'authority-membership')
  assert.equal(writes.find(({ table }) => table === 'notification').data.recipientId, 'user-1')
  assert.equal(writes.find(({ table }) => table === 'audit').data.action, 'DEPARTMENT_CHANGE_REQUEST_APPROVED')
})

test('Rejection does not change department memberships but records decision and notification', async () => {
  const { database, writes } = authorityDecisionDatabase()
  const result = await decideDepartmentChange('institution-1', 'request-1', reviewer, 'REJECTED', { database })

  assert.equal(result.status, 'REJECTED')
  assert.equal(writes.some(({ table }) => table.startsWith('departmentMembership')), false)
  assert.equal(writes.find(({ table }) => table === 'notification').data.type, 'DEPARTMENT_CHANGE_REQUEST_REJECTED')
})

test('Teacher approval adds a membership without making it primary', async () => {
  const { database, writes } = authorityDecisionDatabase({
    request: changeRequest({
      changeType: 'TEACHER_ADD',
      currentDepartmentId: null,
      membership: { role: 'TEACHER', user: { name: 'Teacher Person' } },
    }),
  })
  await decideDepartmentChange('institution-1', 'request-1', reviewer, 'APPROVED', { database })

  const update = writes.find(({ table }) => table === 'departmentMembershipUpdate')
  assert.deepEqual(update.data, { isActive: true, isPrimary: false })
})

test('Teacher primary-change approval switches the primary membership', async () => {
  const { database, writes } = authorityDecisionDatabase({
    request: changeRequest({
      changeType: 'TEACHER_PRIMARY_CHANGE',
      requestedDepartmentId: 'department-other',
      membership: { role: 'TEACHER', user: { name: 'Teacher Person' } },
    }),
  })
  await decideDepartmentChange('institution-1', 'request-1', reviewer, 'APPROVED', { database })

  const updates = writes.filter(({ table }) => table === 'departmentMembershipUpdate')
  assert.deepEqual(updates.map(({ where, data }) => [where.id, data]), [
    ['row-department-current', { isPrimary: false }],
    ['row-department-other', { isPrimary: true }],
  ])
})

test('Teacher removal approval deactivates the current membership and promotes the replacement', async () => {
  const { database, writes } = authorityDecisionDatabase({
    request: changeRequest({
      changeType: 'TEACHER_REMOVE',
      requestedDepartmentId: null,
      replacementDepartmentId: 'department-other',
      membership: { role: 'TEACHER', user: { name: 'Teacher Person' } },
    }),
  })
  await decideDepartmentChange('institution-1', 'request-1', reviewer, 'APPROVED', { database })

  const updates = writes.filter(({ table }) => table === 'departmentMembershipUpdate')
  assert.deepEqual(updates.map(({ where, data }) => [where.id, data]), [
    ['row-department-current', { isActive: false, isPrimary: false }],
    ['row-department-other', { isPrimary: true }],
  ])
})

test('Authority cannot approve its own department request', async () => {
  const { database, writes } = authorityDecisionDatabase({
    request: changeRequest({ requestedById: 'authority-user' }),
  })
  await assert.rejects(
    decideDepartmentChange('institution-1', 'request-1', reviewer, 'APPROVED', { database }),
    (error) => error.statusCode === 403 && error.code === 'SELF_REVIEW_NOT_ALLOWED',
  )
  assert.equal(writes.length, 0)
})

test('Approval rejects targets that no longer belong to the institution', async () => {
  const { database, writes } = authorityDecisionDatabase({ department: null })
  await assert.rejects(
    decideDepartmentChange('institution-1', 'request-1', reviewer, 'APPROVED', { database }),
    (error) => error.statusCode === 404 && error.code === 'DEPARTMENT_NOT_FOUND',
  )
  assert.equal(writes.length, 0)
})

test('a request cannot be decided twice', async () => {
  const { database } = authorityDecisionDatabase({ updateCount: 0 })
  await assert.rejects(
    decideDepartmentChange('institution-1', 'request-1', reviewer, 'REJECTED', { database }),
    (error) => error.statusCode === 409 && error.code === 'DEPARTMENT_CHANGE_ALREADY_REVIEWED',
  )
})

test('requester can cancel their own pending request and cancellation is audited', async () => {
  const writes = []
  const database = {
    $transaction: async (callback) => callback({
      departmentChangeRequest: {
        findFirst: async () => ({ id: 'request-1', changeType: 'STUDENT_CHANGE' }),
        updateMany: async (args) => {
          writes.push({ table: 'request', ...args })
          return { count: 1 }
        },
      },
      auditLog: { create: async ({ data }) => writes.push({ table: 'audit', data }) },
    }),
  }
  const result = await cancelMemberDepartmentChange(
    'institution-1',
    'membership-1',
    'user-1',
    'request-1',
    { database },
  )

  assert.equal(result.status, 'CANCELLED')
  assert.equal(writes.find(({ table }) => table === 'request').data.status, 'CANCELLED')
  assert.equal(writes.find(({ table }) => table === 'audit').data.actorMembershipId, 'membership-1')
})

test('cross-institution request ID cannot be cancelled or reviewed', async () => {
  const cancelDatabase = {
    $transaction: async (callback) => callback({
      departmentChangeRequest: { findFirst: async () => null },
    }),
  }
  await assert.rejects(
    cancelMemberDepartmentChange('institution-1', 'membership-1', 'user-1', 'foreign-request', {
      database: cancelDatabase,
    }),
    (error) => error.statusCode === 404,
  )

  const review = authorityDecisionDatabase()
  await assert.rejects(
    decideDepartmentChange('institution-2', 'request-1', reviewer, 'APPROVED', {
      database: review.database,
    }),
    (error) => error.statusCode === 404,
  )
})
