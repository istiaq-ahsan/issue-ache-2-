const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createRequireAuth, createRequireInstitutionAccess, requireRole } = require('../src/middlewares/auth')
const { createApp } = require('../src/app')

function createRequest({ authorization, institutionId } = {}) {
  const headers = {}
  if (authorization) headers.authorization = authorization
  if (institutionId) headers['x-institution-id'] = institutionId

  return {
    headers,
    params: {},
    get(name) {
      return this.headers[name.toLowerCase()]
    },
  }
}

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve({ error, request: req }))
  })
}

function createAuthenticatedUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'person@example.edu',
    name: 'Campus User',
    phone: null,
    memberships: [],
    administeredInstitutions: [],
    ...overrides,
  }
}

function createMembership(overrides = {}) {
  const activeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return {
    id: 'membership-1',
    institutionId: 'institution-1',
    userId: 'user-1',
    role: 'STUDENT',
    status: 'ACTIVE',
    deletedAt: null,
    institution: {
      id: 'institution-1',
      name: 'Campus',
      institutionCode: 'CAMPUS',
    },
    departmentMemberships: [
      {
        id: 'department-membership-1',
        departmentId: 'department-1',
        isActive: true,
        isPrimary: true,
        department: {
          id: 'department-1',
          name: 'Science',
          status: 'ACTIVE',
          subscriptions: [
            {
              id: 'subscription-1',
              status: 'ACTIVE',
              startsAt: new Date(Date.now() - 60 * 1000),
              endsAt: activeUntil,
            },
          ],
        },
      },
    ],
    ...overrides,
  }
}

function createDatabase({ user, memberships = [], administeredInstitution } = {}) {
  return {
    user: {
      findUnique: async () => user ?? null,
    },
    institutionMembership: {
      findFirst: async ({ where }) => {
        const membership = memberships.find(
          (membership) =>
            membership.institutionId === where.institutionId &&
            membership.userId === where.userId,
        )
        if (!membership) return null

        const now = new Date()
        return {
          ...membership,
          departmentMemberships: membership.departmentMemberships
            .filter(({ isActive }) => isActive)
            .map((departmentMembership) => ({
              ...departmentMembership,
              department: {
                ...departmentMembership.department,
                subscriptions: departmentMembership.department.subscriptions.filter(
                  (subscription) =>
                    subscription.status === 'ACTIVE' &&
                    subscription.startsAt <= now &&
                    subscription.endsAt > now,
                ),
              },
            })),
        }
      },
    },
    institution: {
      findFirst: async ({ where }) =>
        administeredInstitution?.id === where.id &&
        administeredInstitution.adminUserId === where.adminUserId
          ? administeredInstitution
          : null,
    },
    department: {
      findFirst: async ({ where }) =>
        memberships
          .flatMap((membership) => membership.departmentMemberships)
          .map(({ department }) => department)
          .find(
            (department) =>
              department.id === where.id &&
              where.status === 'ACTIVE' &&
              department.status === 'ACTIVE' &&
              (!where.subscriptions ||
                department.subscriptions?.some(
                  (subscription) =>
                    subscription.status === 'ACTIVE' &&
                    subscription.startsAt <= where.subscriptions.some.startsAt.lte &&
                    subscription.endsAt > where.subscriptions.some.endsAt.gt,
                )),
          ) ?? null,
    },
  }
}

function createAuthMiddleware({ uid = 'firebase-user-1', user, verifyError } = {}) {
  const database = createDatabase({ user })
  const firebaseAuth = {
    verifyIdToken: async () => {
      if (verifyError) throw verifyError
      return { uid }
    },
  }

  return createRequireAuth({ firebaseAuth: () => firebaseAuth, database })
}

test('missing Firebase token is rejected', async () => {
  const middleware = createAuthMiddleware()
  const { error } = await runMiddleware(middleware, createRequest())

  assert.equal(error.statusCode, 401)
  assert.equal(error.code, 'AUTHENTICATION_REQUIRED')
})

test('invalid Firebase token is rejected', async () => {
  const middleware = createAuthMiddleware({
    verifyError: { code: 'auth/invalid-id-token' },
  })
  const { error } = await runMiddleware(
    middleware,
    createRequest({ authorization: 'Bearer invalid-token' }),
  )

  assert.equal(error.statusCode, 401)
  assert.equal(error.code, 'INVALID_ID_TOKEN')
})

test('unknown Firebase UID cannot access the application', async () => {
  const middleware = createAuthMiddleware()
  const { error } = await runMiddleware(
    middleware,
    createRequest({ authorization: 'Bearer valid-token' }),
  )

  assert.equal(error.statusCode, 403)
  assert.equal(error.code, 'APPLICATION_ACCOUNT_NOT_FOUND')
})

test('pending membership cannot access institution features', async () => {
  const membership = createMembership({ status: 'PENDING' })
  const middleware = createRequireInstitutionAccess({
    database: createDatabase({ memberships: [membership] }),
  })
  const { error } = await runMiddleware(
    middleware,
    Object.assign(createRequest({ institutionId: membership.institutionId }), {
      auth: { user: { id: membership.userId } },
    }),
  )

  assert.equal(error.statusCode, 403)
  assert.equal(error.code, 'MEMBERSHIP_NOT_ACTIVE')
})

test('rejected membership cannot access institution features', async () => {
  const membership = createMembership({ status: 'REJECTED' })
  const middleware = createRequireInstitutionAccess({
    database: createDatabase({ memberships: [membership] }),
  })
  const { error } = await runMiddleware(
    middleware,
    Object.assign(createRequest({ institutionId: membership.institutionId }), {
      auth: { user: { id: membership.userId } },
    }),
  )

  assert.equal(error.statusCode, 403)
  assert.equal(error.code, 'MEMBERSHIP_NOT_ACTIVE')
})

test('inactive membership cannot access institution features', async () => {
  const membership = createMembership({ status: 'INACTIVE' })
  const middleware = createRequireInstitutionAccess({
    database: createDatabase({ memberships: [membership] }),
  })
  const { error } = await runMiddleware(
    middleware,
    Object.assign(createRequest({ institutionId: membership.institutionId }), {
      auth: { user: { id: membership.userId } },
    }),
  )

  assert.equal(error.statusCode, 403)
  assert.equal(error.code, 'MEMBERSHIP_NOT_ACTIVE')
})

test('role authorization denies a role that is not assigned in PostgreSQL', async () => {
  const membership = createMembership()
  const institutionAccess = createRequireInstitutionAccess({
    database: createDatabase({ memberships: [membership] }),
  })
  const req = Object.assign(
    createRequest({ institutionId: membership.institutionId }),
    { auth: { user: { id: membership.userId } } },
  )
  const accessResult = await runMiddleware(institutionAccess, req)
  const roleResult = await runMiddleware(requireRole('AUTHORITY'), req)

  assert.equal(accessResult.error, undefined)
  assert.equal(roleResult.error.code, 'ROLE_NOT_AUTHORIZED')
})

test('cross-institution access is denied even when the caller selects another tenant', async () => {
  const membership = createMembership()
  const middleware = createRequireInstitutionAccess({
    database: createDatabase({ memberships: [membership] }),
  })
  const { error } = await runMiddleware(
    middleware,
    Object.assign(createRequest({ institutionId: 'institution-2' }), {
      auth: { user: { id: membership.userId } },
    }),
  )

  assert.equal(error.statusCode, 403)
  assert.equal(error.code, 'INSTITUTION_ACCESS_DENIED')
})

test('legacy locked department status does not block student institution access', async () => {
  const membership = createMembership({
    departmentMemberships: [
      {
        id: 'department-membership-1',
        departmentId: 'department-1',
        isActive: true,
        isPrimary: true,
        department: {
          id: 'department-1',
          name: 'Science',
          status: 'LOCKED',
          subscriptions: [],
        },
      },
    ],
  })
  const middleware = createRequireInstitutionAccess({
    database: createDatabase({ memberships: [membership] }),
  })
  const { error, request } = await runMiddleware(
    middleware,
    Object.assign(createRequest({ institutionId: membership.institutionId }), {
      auth: { user: { id: membership.userId } },
    }),
  )

  assert.equal(error, undefined)
  assert.equal(request.auth.institutionId, membership.institutionId)
})

test('legacy department subscription dates do not block student institution access', async () => {
  const membership = createMembership({
    departmentMemberships: [
      {
        id: 'department-membership-1',
        departmentId: 'department-1',
        isActive: true,
        isPrimary: true,
        department: {
          id: 'department-1',
          name: 'Science',
          status: 'ACTIVE',
          subscriptions: [
            {
              id: 'subscription-expired',
              status: 'ACTIVE',
              startsAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
              endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          ],
        },
      },
    ],
  })
  const middleware = createRequireInstitutionAccess({
    database: createDatabase({ memberships: [membership] }),
  })
  const { error, request } = await runMiddleware(
    middleware,
    Object.assign(createRequest({ institutionId: membership.institutionId }), {
      auth: { user: { id: membership.userId } },
    }),
  )

  assert.equal(error, undefined)
  assert.equal(request.auth.institutionId, membership.institutionId)
})

test('GET /api/auth/me returns the PostgreSQL identity for a verified token', async () => {
  const user = createAuthenticatedUser()
  const authenticate = createAuthMiddleware({ user })
  const app = createApp({ authenticate })
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`, {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.deepEqual(body.data.user, {
      id: 'user-1',
      email: 'person@example.edu',
      name: 'Campus User',
      phone: null,
    })
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})
