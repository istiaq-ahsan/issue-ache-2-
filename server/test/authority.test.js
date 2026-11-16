const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createApp } = require('../src/app')
const { createRequireInstitutionAdministrator } = require('../src/middlewares/auth')
const {
  createAuthority,
  deleteAuthority,
  setAuthorityEnabled,
  updateAuthority,
} = require('../src/services/authority.service')

function makeMembership(overrides = {}) {
  return {
    id: 'membership-1',
    status: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    user: {
      id: 'user-1',
      firebaseUid: 'firebase-1',
      name: 'Authority Name',
      email: 'authority@example.edu',
    },
    authorityDepartments: [{
      department: { id: 'department-1', name: 'Engineering' },
    }],
    ...overrides,
  }
}

function activeSubscriptionModel(planCode = 'PRO') {
  return {
    updateMany: async () => ({ count: 0 }),
    findFirst: async () => ({
      id: 'subscription-1',
      planCode,
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 86_400_000),
    }),
  }
}

test('Authority creation provisions Firebase and PostgreSQL without storing the password', async () => {
  const writes = []
  const membership = makeMembership()
  const transaction = {
    $queryRaw: async () => [],
    subscription: activeSubscriptionModel(),
    user: {
      create: async ({ data }) => {
        writes.push({ table: 'user', data })
        return { id: 'user-1' }
      },
    },
    institutionMembership: {
      create: async ({ data }) => {
        writes.push({ table: 'membership', data })
        return membership
      },
      count: async () => 0,
      findUnique: async () => membership,
    },
    authorityDepartment: {
      createMany: async ({ data }) => writes.push({ table: 'assignments', data }),
    },
    department: { count: async () => 1 },
    auditLog: {
      create: async ({ data }) => writes.push({ table: 'audit', data }),
    },
    institution: { findUnique: async () => ({ adminUserId: 'admin-1' }) },
    notification: {
      create: async ({ data }) => writes.push({ table: 'notification', data }),
    },
  }
  const database = {
    subscription: activeSubscriptionModel(),
    user: { findUnique: async () => null },
    institutionMembership: { count: async () => 0 },
    department: { count: async () => 1 },
    $transaction: async (callback) => callback(transaction),
  }
  let firebaseInput
  const firebaseAuth = {
    createUser: async (data) => {
      firebaseInput = data
      return { uid: 'firebase-1' }
    },
  }

  const result = await createAuthority(
    { name: 'Authority Name', email: 'AUTHORITY@example.edu', password: 'initial-secret', departmentIds: ['department-1'] },
    'institution-1',
    'admin-1',
    { database, firebaseAuth },
  )

  assert.equal(firebaseInput.email, 'authority@example.edu')
  assert.equal(firebaseInput.password, 'initial-secret')
  assert.equal(firebaseInput.disabled, false)
  assert.equal(writes.find(({ table }) => table === 'user').data.email, 'authority@example.edu')
  assert.equal(writes.find(({ table }) => table === 'membership').data.role, 'AUTHORITY')
  assert.equal(writes.find(({ table }) => table === 'membership').data.status, 'ACTIVE')
  assert.deepEqual(writes.find(({ table }) => table === 'assignments').data, [{
    institutionId: 'institution-1',
    authorityMembershipId: 'membership-1',
    departmentId: 'department-1',
    assignedById: 'admin-1',
  }])
  assert.equal(writes.find(({ table }) => table === 'audit').data.action, 'AUTHORITY_CREATED')
  assert.equal(writes.find(({ table }) => table === 'notification').data.recipientId, 'admin-1')
  assert.equal(JSON.stringify(writes).includes('initial-secret'), false)
  assert.equal(JSON.stringify(result).includes('initial-secret'), false)
  assert.equal('firebaseUid' in result, false)
})

test('Authority creation uses a Prisma-safe advisory lock and cleans Firebase after a transaction failure', async () => {
  const deletedFirebaseUsers = []
  let lockSql = ''
  let lockParameters = []
  const transactionError = Object.assign(new Error('database write failed'), { code: 'P2010' })
  const transaction = {
    $queryRaw: async (strings, ...values) => {
      lockSql = strings.join('?')
      lockParameters = values
      return [{ '?column?': true }]
    },
    subscription: activeSubscriptionModel(),
    institutionMembership: {
      count: async () => {
        throw transactionError
      },
    },
  }
  const database = {
    subscription: activeSubscriptionModel(),
    institutionMembership: { count: async () => 0 },
    department: { count: async () => 1 },
    user: { findUnique: async () => null },
    $transaction: async (callback) => callback(transaction),
  }

  await assert.rejects(
    createAuthority(
      { name: 'Authority Name', email: 'authority@example.edu', password: 'initial-secret', departmentIds: ['department-1'] },
      'institution-1',
      'admin-1',
      {
        database,
        firebaseAuth: {
          createUser: async () => ({ uid: 'temporary-firebase-user' }),
          deleteUser: async (uid) => deletedFirebaseUsers.push(uid),
        },
      },
    ),
    (error) => error === transactionError,
  )

  assert.match(lockSql, /WITH advisory_lock AS MATERIALIZED/)
  assert.match(lockSql, /SELECT TRUE\s+FROM advisory_lock/)
  assert.deepEqual(lockParameters, ['authority-limit:institution-1'])
  assert.deepEqual(deletedFirebaseUsers, ['temporary-firebase-user'])
})

test('duplicate application email is rejected before creating a Firebase account', async () => {
  let createCalls = 0

  await assert.rejects(
    createAuthority(
      { name: 'Authority Name', email: 'authority@example.edu', password: 'initial-secret', departmentIds: ['department-1'] },
      'institution-1',
      'admin-1',
      {
        database: {
          subscription: activeSubscriptionModel(),
          institutionMembership: { count: async () => 0 },
          department: { count: async () => 1 },
          user: { findUnique: async () => ({ id: 'existing-user' }) },
        },
        firebaseAuth: { createUser: async () => { createCalls += 1 } },
      },
    ),
    (error) => error.statusCode === 409 && error.code === 'AUTHORITY_EMAIL_EXISTS',
  )
  assert.equal(createCalls, 0)
})

test('duplicate Firebase email is reported as a conflict', async () => {
  await assert.rejects(
    createAuthority(
      { name: 'Authority Name', email: 'authority@example.edu', password: 'initial-secret', departmentIds: ['department-1'] },
      'institution-1',
      'admin-1',
      {
        database: {
          subscription: activeSubscriptionModel(),
          institutionMembership: { count: async () => 0 },
          department: { count: async () => 1 },
          user: { findUnique: async () => null },
        },
        firebaseAuth: {
          createUser: async () => {
            const error = new Error('duplicate')
            error.code = 'auth/email-already-exists'
            throw error
          },
        },
      },
    ),
    (error) => error.statusCode === 409 && error.code === 'AUTHORITY_EMAIL_EXISTS',
  )
})

test('Authority creation enforces the subscribed plan limit before provisioning Firebase', async () => {
  let firebaseCalls = 0
  await assert.rejects(
    createAuthority(
      { name: 'Authority Name', email: 'authority@example.edu', password: 'initial-secret', departmentIds: ['department-1'] },
      'institution-1',
      'admin-1',
      {
        database: {
          subscription: activeSubscriptionModel('BASIC'),
          institutionMembership: { count: async () => 2 },
          user: { findUnique: async () => null },
        },
        firebaseAuth: { createUser: async () => { firebaseCalls += 1 } },
      },
    ),
    (error) =>
      error.statusCode === 409 &&
      error.code === 'PLAN_LIMIT_REACHED' &&
      error.details.limit === 2,
  )
  assert.equal(firebaseCalls, 0)
})

test('Authority profile updates keep Firebase and PostgreSQL identity fields aligned', async () => {
  const firebaseUpdates = []
  const databaseUpdates = []
  const updatedMembership = makeMembership({
    user: {
      id: 'user-1',
      firebaseUid: 'firebase-1',
      name: 'Updated Authority',
      email: 'updated@example.edu',
    },
  })
  const database = {
    institutionMembership: {
      findFirst: async ({ where }) =>
        where.deletedAt === null ? makeMembership() : { id: 'membership-1' },
      findUnique: async () => updatedMembership,
    },
    user: {
      findUnique: async () => null,
    },
    $transaction: async (callback) => callback({
      user: { update: async (args) => databaseUpdates.push(args) },
      institutionMembership: {
        findFirst: async () => ({ id: 'membership-1' }),
        findUnique: async () => updatedMembership,
      },
      auditLog: { create: async () => undefined },
      institution: { findUnique: async () => ({ adminUserId: 'admin-1' }) },
      notification: { create: async () => undefined },
    }),
  }

  const result = await updateAuthority(
    'institution-1',
    'membership-1',
    { name: 'Updated Authority', email: 'UPDATED@example.edu' },
    'admin-1',
    {
      database,
      firebaseAuth: { updateUser: async (...args) => firebaseUpdates.push(args) },
    },
  )

  assert.equal(result.user.name, 'Updated Authority')
  assert.equal(result.user.email, 'updated@example.edu')
  assert.deepEqual(firebaseUpdates, [[
    'firebase-1',
    { displayName: 'Updated Authority', email: 'updated@example.edu' },
  ]])
  assert.deepEqual(databaseUpdates, [{
    where: { id: 'user-1' },
    data: { name: 'Updated Authority', email: 'updated@example.edu' },
  }])
})

test('database creation failure deletes the provisional Firebase user', async () => {
  const deleted = []
  const database = {
    subscription: activeSubscriptionModel(),
    institutionMembership: { count: async () => 0 },
    department: { count: async () => 1 },
    user: { findUnique: async () => null },
    $transaction: async () => {
      throw new Error('database unavailable')
    },
  }
  const firebaseAuth = {
    createUser: async () => ({ uid: 'provisional-firebase-user' }),
    deleteUser: async (uid) => deleted.push(uid),
  }

  await assert.rejects(
    createAuthority(
      { name: 'Authority Name', email: 'authority@example.edu', password: 'initial-secret', departmentIds: ['department-1'] },
      'institution-1',
      'admin-1',
      { database, firebaseAuth },
    ),
    /database unavailable/,
  )
  assert.deepEqual(deleted, ['provisional-firebase-user'])
})

test('failed Firebase compensation is logged without exposing the password', async () => {
  const logEntries = []
  const database = {
    subscription: activeSubscriptionModel(),
    institutionMembership: { count: async () => 0 },
    department: { count: async () => 1 },
    user: { findUnique: async () => null },
    $transaction: async () => {
      throw new Error('database unavailable')
    },
  }
  const firebaseAuth = {
    createUser: async () => ({ uid: 'provisional-firebase-user' }),
    deleteUser: async () => {
      throw Object.assign(new Error('cleanup failed'), { code: 'auth/internal-error' })
    },
  }

  await assert.rejects(
    createAuthority(
      { name: 'Authority Name', email: 'authority@example.edu', password: 'initial-secret', departmentIds: ['department-1'] },
      'institution-1',
      'admin-1',
      {
        database,
        firebaseAuth,
        logger: { error: (...args) => logEntries.push(args) },
      },
    ),
    (error) =>
      error.statusCode === 500 &&
      error.code === 'AUTHORITY_PROVISIONING_CLEANUP_FAILED',
  )
  assert.equal(JSON.stringify(logEntries).includes('initial-secret'), false)
  assert.equal(JSON.stringify(logEntries).includes('provisional-firebase-user'), true)
})

test('deactivation is institution-scoped and disables Firebase only when no access remains', async () => {
  const updates = []
  const database = {
    institutionMembership: {
      findFirst: async ({ where }) =>
        where.institutionId === 'institution-1' && where.id === 'membership-1'
          ? makeMembership()
          : null,
      update: async ({ data }) => updates.push(data),
    },
    user: {
      findUnique: async () => ({
        firebaseUid: 'firebase-1',
        memberships: [],
        administeredInstitutions: [],
      }),
    },
    $transaction: async (callback) => callback({
      institutionMembership: {
        update: async ({ data }) => updates.push(data),
      },
      auditLog: { create: async () => undefined },
      institution: { findUnique: async () => ({ adminUserId: 'admin-1' }) },
      notification: { create: async () => undefined },
    }),
  }
  const firebaseUpdates = []
  const result = await setAuthorityEnabled(
    'institution-1',
    'membership-1',
    false,
    'admin-1',
    {
      database,
      firebaseAuth: { updateUser: async (...args) => firebaseUpdates.push(args) },
    },
  )

  assert.equal(result.authority.status, 'INACTIVE')
  assert.equal(result.firebaseAccessSynced, true)
  assert.deepEqual(updates, [{ status: 'INACTIVE' }])
  assert.deepEqual(firebaseUpdates, [['firebase-1', { disabled: true }]])
})

test('deactivation preserves Firebase sign-in when another active institution membership remains', async () => {
  const firebaseUpdates = []
  const database = {
    institutionMembership: {
      findFirst: async () => makeMembership(),
    },
    user: {
      findUnique: async () => ({
        firebaseUid: 'firebase-1',
        memberships: [{ id: 'membership-in-another-institution' }],
        administeredInstitutions: [],
      }),
    },
    $transaction: async (callback) => callback({
      institutionMembership: { update: async () => undefined },
      auditLog: { create: async () => undefined },
      institution: { findUnique: async () => ({ adminUserId: 'admin-1' }) },
      notification: { create: async () => undefined },
      institution: { findUnique: async () => ({ adminUserId: 'admin-1' }) },
      notification: { create: async () => undefined },
    }),
  }

  const result = await setAuthorityEnabled(
    'institution-1',
    'membership-1',
    false,
    'admin-1',
    {
      database,
      firebaseAuth: { updateUser: async (...args) => firebaseUpdates.push(args) },
    },
  )

  assert.equal(result.authority.status, 'INACTIVE')
  assert.deepEqual(firebaseUpdates, [['firebase-1', { disabled: false }]])
})

test('Firebase status-sync failures remain visible while local membership access is revoked', async () => {
  let firebaseAttempts = 0
  const logEntries = []
  const database = {
    institutionMembership: {
      findFirst: async () => makeMembership(),
    },
    user: {
      findUnique: async () => ({
        firebaseUid: 'firebase-1',
        memberships: [],
        administeredInstitutions: [],
      }),
    },
    $transaction: async (callback) => callback({
      institutionMembership: { update: async () => undefined },
      auditLog: { create: async () => undefined },
      institution: { findUnique: async () => ({ adminUserId: 'admin-1' }) },
      notification: { create: async () => undefined },
    }),
  }

  const result = await setAuthorityEnabled(
    'institution-1',
    'membership-1',
    false,
    'admin-1',
    {
      database,
      firebaseAuth: {
        updateUser: async () => {
          firebaseAttempts += 1
          throw Object.assign(new Error('Firebase unavailable'), { code: 'auth/internal-error' })
        },
      },
      logger: { error: (...args) => logEntries.push(args) },
    },
  )

  assert.equal(result.authority.status, 'INACTIVE')
  assert.equal(result.firebaseAccessSynced, false)
  assert.match(result.warning, /could not be synchronized/)
  assert.equal(firebaseAttempts, 3)
  assert.equal(logEntries.length, 1)
})

test('soft deletion retains membership and audit history and disables only an unshared identity', async () => {
  const now = new Date('2026-11-04T00:00:00Z')
  const membershipUpdates = []
  const auditEntries = []
  const firebaseUpdates = []
  const database = {
    institutionMembership: {
      findFirst: async ({ where }) =>
        where.institutionId === 'institution-1' ? makeMembership() : null,
    },
    user: {
      findUnique: async () => ({
        firebaseUid: 'firebase-1',
        memberships: [],
        administeredInstitutions: [],
      }),
    },
    $transaction: async (callback) => callback({
      institutionMembership: {
        update: async (args) => membershipUpdates.push(args),
      },
      auditLog: { create: async ({ data }) => auditEntries.push(data) },
      institution: { findUnique: async () => ({ adminUserId: 'admin-1' }) },
      notification: { create: async () => undefined },
    }),
  }

  const result = await deleteAuthority('institution-1', 'membership-1', 'admin-1', {
    database,
    firebaseAuth: { updateUser: async (...args) => firebaseUpdates.push(args) },
    now,
  })

  assert.deepEqual(membershipUpdates[0].data, { status: 'INACTIVE', deletedAt: now })
  assert.equal(auditEntries[0].action, 'AUTHORITY_DELETED')
  assert.equal(auditEntries[0].metadata.softDeleted, true)
  assert.equal(result.authority.deletedAt, now)
  assert.deepEqual(firebaseUpdates, [['firebase-1', { disabled: true }]])
})

test('administrator cannot manage Authority accounts belonging to another institution', async (context) => {
  const authorizeAdministrator = createRequireInstitutionAdministrator({
    database: {
      institution: {
        findFirst: async ({ where }) =>
          where.id === 'institution-owned' && where.adminUserId === 'admin-1'
            ? {
                id: where.id,
                name: 'Owned',
                institutionCode: 'OWNED',
                contactPersonName: 'Admin',
                contactEmail: 'admin@example.edu',
                campusType: 'University',
                campusSize: 'Large',
                location: 'North',
              }
            : null,
      },
    },
  })
  const app = createApp({
    institutionRouterOptions: {
      authenticate: (req, res, next) => {
        req.auth = { user: { id: 'admin-1' } }
        next()
      },
      authorizeAdministrator,
    },
  })
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/institutions/institution-other/authorities`,
  )
  const body = await response.json()

  assert.equal(response.status, 403)
  assert.equal(body.error.code, 'INSTITUTION_ACCESS_DENIED')

  const publicRegistration = await fetch(
    `http://127.0.0.1:${server.address().port}/api/authorities`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Public Authority',
        email: 'public@example.edu',
        password: 'initial-secret',
      }),
    },
  )
  assert.equal(publicRegistration.status, 501)
})

test('PUT /api/authorities/:id/departments resolves and authorizes the owning institution', async (context) => {
  let authorizedInstitutionId
  let updated
  const app = createApp({
    institutionRouterOptions: {
      authorityDepartmentRouterOptions: {
        authenticate: (req, res, next) => {
          req.auth = { user: { id: 'admin-1' } }
          next()
        },
        authorizeAdministrator: (req, res, next) => {
          authorizedInstitutionId = req.params.institutionId
          req.auth.institutionId = authorizedInstitutionId
          req.auth.institutionAdministrator = true
          next()
        },
        requireSubscription: (req, res, next) => next(),
        database: {
          institutionMembership: {
            findFirst: async ({ where }) => (
              where.institution.adminUserId === 'admin-1'
                ? { institutionId: 'institution-1' }
                : null
            ),
          },
        },
        controller: {
          replaceDepartments: (req, res) => {
            updated = req.validated.body.departmentIds
            return res.json({ ok: true })
          },
        },
      },
    },
  })
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/authorities/membership-1/departments`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentIds: ['department-1'] }),
    },
  )

  assert.equal(response.status, 200)
  assert.equal(authorizedInstitutionId, 'institution-1')
  assert.deepEqual(updated, ['department-1'])
})
