const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createApp } = require('../src/app')
const { createRequireInstitutionAccess } = require('../src/middlewares/auth')
const {
  decideRegistration,
  lookupInstitutionDepartments,
  registerStudent,
  registerTeacher,
} = require('../src/services/member-registration.service')

const studentInput = {
  institutionCode: 'ia-SCHOOL1',
  studentId: 'S-100',
  name: 'Student Person',
  email: 'STUDENT@example.edu',
  phone: '+880123456789',
  departmentId: 'department-1',
  password: 'student-password',
}

function registrationDatabase({
  existingId = null,
  membershipCreate = async ({ data }) => ({ id: 'membership-1', ...data }),
  departments = [],
  authorities = [],
  memberCount = 0,
  planCode = 'PRO',
} = {}) {
  const writes = []
  const activeSubscription = {
    id: 'subscription-1',
    institutionId: 'institution-1',
    planCode,
    status: 'ACTIVE',
    startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 86_400_000),
  }
  const subscription = {
    updateMany: async () => ({ count: 0 }),
    findFirst: async () => activeSubscription,
  }
  const transaction = {
    $queryRaw: async () => [],
    subscription,
    user: {
      create: async ({ data }) => {
        writes.push({ table: 'user', data })
        return { id: 'user-1' }
      },
    },
    institutionMembership: {
      create: async ({ data }) => {
        writes.push({ table: 'membership', data })
        return membershipCreate({ data })
      },
      count: async () => memberCount,
      findMany: async () => authorities,
    },
    department: {
      findFirst: async () => ({ id: 'department-1', name: 'Engineering' }),
    },
    auditLog: {
      create: async ({ data }) => writes.push({ table: 'audit', data }),
    },
    notification: {
      createMany: async ({ data }) => writes.push({ table: 'notifications', data }),
    },
  }
  const database = {
    subscription,
    institution: {
      findUnique: async () => ({
        id: 'institution-1',
        name: 'Example University',
        institutionCode: 'IA-SCHOOL1',
      }),
    },
    department: {
      findFirst: async ({ where }) =>
        where.institutionId === 'institution-1' &&
        where.id === 'department-1'
          ? { id: 'department-1', name: 'Engineering' }
          : null,
      findMany: async () => departments,
    },
    institutionMembership: {
      findFirst: async () => (existingId ? { id: existingId } : null),
      count: async () => memberCount,
    },
    user: {
      findUnique: async () => null,
    },
    $transaction: async (callback) => callback(transaction),
  }
  return { database, writes }
}

function authorityMembership(overrides = {}) {
  return {
    id: 'pending-membership-1',
    institutionId: 'institution-1',
    userId: 'applicant-1',
    role: 'STUDENT',
    requestedDepartmentId: 'department-1',
    studentId: 'S-100',
    teacherId: null,
    institution: { name: 'Example University' },
    requestedDepartment: { id: 'department-1', name: 'Engineering' },
    user: { id: 'applicant-1', name: 'Student Person' },
    ...overrides,
  }
}

function decisionDatabase({
  membership = authorityMembership(),
  department = { id: 'department-1' },
  updateCount = 1,
} = {}) {
  const writes = []
  const transaction = {
    institutionMembership: {
      findFirst: async () => membership,
      updateMany: async (args) => {
        writes.push({ table: 'membershipUpdate', ...args })
        return { count: updateCount }
      },
    },
    department: {
      findFirst: async () => department,
    },
    departmentMembership: {
      create: async ({ data }) => writes.push({ table: 'departmentMembership', data }),
    },
    notification: {
      create: async ({ data }) => writes.push({ table: 'notification', data }),
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

test('institution lookup returns every department without department billing filters', async () => {
  let departmentFilter
  const result = await lookupInstitutionDepartments('ia-school1', {
    institution: {
      findUnique: async ({ where }) => {
        assert.deepEqual(where, { institutionCode: 'IA-SCHOOL1' })
        return { id: 'institution-1', name: 'Example University', institutionCode: 'IA-SCHOOL1' }
      },
    },
    department: {
      findMany: async ({ where }) => {
        departmentFilter = where
        return [{ id: 'department-1', name: 'Engineering' }]
      },
    },
  })

  assert.equal(result.institution.name, 'Example University')
  assert.deepEqual(result.departments, [{ id: 'department-1', name: 'Engineering' }])
  assert.deepEqual(departmentFilter, { institutionId: 'institution-1' })
})

test('invalid Institution Code is rejected', async () => {
  await assert.rejects(
    lookupInstitutionDepartments('UNKNOWN', {
      institution: { findUnique: async () => null },
    }),
    (error) => error.statusCode === 404 && error.code === 'INSTITUTION_CODE_NOT_FOUND',
  )
})

test('duplicate Student ID is rejected within its institution before Firebase creation', async () => {
  const { database } = registrationDatabase({ existingId: 'existing-membership' })
  let firebaseCalls = 0

  await assert.rejects(
    registerStudent(studentInput, {
      database,
      firebaseAuth: { createUser: async () => { firebaseCalls += 1 } },
    }),
    (error) => error.statusCode === 409 && error.code === 'STUDENT_ID_ALREADY_REGISTERED',
  )
  assert.equal(firebaseCalls, 0)
})

test('duplicate Teacher ID is rejected within its institution before Firebase creation', async () => {
  const { database } = registrationDatabase({ existingId: 'existing-membership' })
  let firebaseCalls = 0

  await assert.rejects(
    registerTeacher({
      ...studentInput,
      teacherId: 'T-100',
    }, {
      database,
      firebaseAuth: { createUser: async () => { firebaseCalls += 1 } },
    }),
    (error) => error.statusCode === 409 && error.code === 'TEACHER_ID_ALREADY_REGISTERED',
  )
  assert.equal(firebaseCalls, 0)
})

test('student and teacher registration enforces the member limit including pending registrations', async () => {
  const { database } = registrationDatabase({ memberCount: 1000, planCode: 'BASIC' })
  let firebaseCalls = 0

  await assert.rejects(
    registerStudent(studentInput, {
      database,
      firebaseAuth: { createUser: async () => { firebaseCalls += 1 } },
    }),
    (error) =>
      error.statusCode === 409 &&
      error.code === 'PLAN_LIMIT_REACHED' &&
      error.details.limit === 1000,
  )
  assert.equal(firebaseCalls, 0)
})

test('a legacy locked department remains available for registration', async () => {
  const { database } = registrationDatabase()
  const result = await registerStudent(studentInput, {
    database,
    firebaseAuth: { createUser: async () => ({ uid: 'firebase-student-1' }) },
  })
  assert.equal(result.status, 'PENDING')
})

test('Student registration creates Firebase identity and pending membership without storing password', async () => {
  const { database, writes } = registrationDatabase()
  let firebaseInput
  const result = await registerStudent(studentInput, {
    database,
    firebaseAuth: {
      createUser: async (data) => {
        firebaseInput = data
        return { uid: 'firebase-student-1' }
      },
    },
  })

  test('registration notifies active Authorities in the same institution', async () => {
    const { database, writes } = registrationDatabase({
      authorities: [
        { id: 'authority-membership-1', userId: 'authority-user-1' },
        { id: 'authority-membership-2', userId: 'authority-user-2' },
      ],
    })

    await registerStudent(studentInput, {
      database,
      firebaseAuth: { createUser: async () => ({ uid: 'firebase-student-1' }) },
    })

    const notifications = writes.find(({ table }) => table === 'notifications').data
    assert.equal(notifications.length, 2)
    assert.equal(notifications[0].recipientMembershipId, 'authority-membership-1')
    assert.equal(notifications[0].relatedEntityType, 'InstitutionMembership')
  })

  assert.equal(firebaseInput.email, 'student@example.edu')
  assert.equal(firebaseInput.password, 'student-password')
  assert.equal(result.status, 'PENDING')
  assert.equal(result.role, 'STUDENT')
  const userWrite = writes.find(({ table }) => table === 'user').data
  assert.equal(userWrite.email, 'student@example.edu')
  assert.equal(userWrite.phone, '+880123456789')
  const membershipWrite = writes.find(({ table }) => table === 'membership').data
  assert.equal(membershipWrite.status, 'PENDING')
  assert.equal(membershipWrite.role, 'STUDENT')
  assert.equal(membershipWrite.studentId, 'S-100')
  assert.equal(membershipWrite.requestedDepartmentId, 'department-1')
  assert.equal(writes.find(({ table }) => table === 'audit').data.actorMembershipId, 'membership-1')
  assert.equal(JSON.stringify(writes).includes('student-password'), false)
})

test('Teacher registration creates a pending teacher membership and uses Teacher ID', async () => {
  const { database, writes } = registrationDatabase()
  await registerTeacher({
    ...studentInput,
    teacherId: 'T-200',
    email: 'teacher@example.edu',
  }, {
    database,
    firebaseAuth: { createUser: async () => ({ uid: 'firebase-teacher-1' }) },
  })

  const membershipWrite = writes.find(({ table }) => table === 'membership').data
  assert.equal(membershipWrite.role, 'TEACHER')
  assert.equal(membershipWrite.teacherId, 'T-200')
  assert.equal(membershipWrite.studentId, undefined)
})

test('a concurrent duplicate institutional ID is mapped to a conflict and Firebase is cleaned up', async () => {
  const { database } = registrationDatabase({
    membershipCreate: async () => {
      throw Object.assign(new Error('unique constraint'), {
        code: 'P2002',
        meta: { target: ['institutionId', 'studentId'] },
      })
    },
  })
  const deleted = []

  await assert.rejects(
    registerStudent(studentInput, {
      database,
      firebaseAuth: {
        createUser: async () => ({ uid: 'provisional-user' }),
        deleteUser: async (uid) => deleted.push(uid),
      },
    }),
    (error) => error.statusCode === 409 && error.code === 'STUDENT_ID_ALREADY_REGISTERED',
  )
  assert.deepEqual(deleted, ['provisional-user'])
})

test('PostgreSQL failure triggers Firebase cleanup and never logs credentials', async () => {
  const { database } = registrationDatabase({
    membershipCreate: async () => { throw new Error('transaction failed') },
  })
  const deleted = []
  const logEntries = []

  await assert.rejects(
    registerStudent(studentInput, {
      database,
      firebaseAuth: {
        createUser: async () => ({ uid: 'provisional-user' }),
        deleteUser: async (uid) => deleted.push(uid),
      },
      logger: { error: (...args) => logEntries.push(args) },
    }),
    /transaction failed/,
  )
  assert.deepEqual(deleted, ['provisional-user'])
  assert.equal(JSON.stringify(logEntries).includes('student-password'), false)
})

test('Firebase cleanup failure is logged and surfaced for reconciliation', async () => {
  const { database } = registrationDatabase({
    membershipCreate: async () => { throw new Error('transaction failed') },
  })
  const logEntries = []

  await assert.rejects(
    registerStudent(studentInput, {
      database,
      firebaseAuth: {
        createUser: async () => ({ uid: 'orphaned-user' }),
        deleteUser: async () => {
          throw Object.assign(new Error('Firebase unavailable'), { code: 'auth/internal-error' })
        },
      },
      logger: { error: (...args) => logEntries.push(args) },
    }),
    (error) =>
      error.statusCode === 500 &&
      error.code === 'REGISTRATION_PROVISIONING_CLEANUP_FAILED',
  )
  assert.equal(logEntries.length, 1)
  assert.equal(JSON.stringify(logEntries).includes('student-password'), false)
})

test('approval activates membership and creates department access, notification, and audit atomically', async () => {
  const { database, writes } = decisionDatabase()
  const result = await decideRegistration(
    'institution-1',
    'pending-membership-1',
    { userId: 'authority-user', membershipId: 'authority-membership' },
    'APPROVED',
    { database, now: new Date('2026-11-04T00:00:00Z') },
  )

  assert.equal(result.status, 'ACTIVE')
  assert.equal(result.decision, 'APPROVED')
  assert.deepEqual(writes.find(({ table }) => table === 'membershipUpdate').data, {
    status: 'ACTIVE',
    reviewedById: 'authority-user',
    reviewedByMembershipId: 'authority-membership',
    reviewedAt: new Date('2026-11-04T00:00:00Z'),
  })
  assert.deepEqual(writes.find(({ table }) => table === 'departmentMembership').data, {
    institutionId: 'institution-1',
    membershipId: 'pending-membership-1',
    departmentId: 'department-1',
    isPrimary: true,
    isActive: true,
  })
  assert.equal(writes.find(({ table }) => table === 'notification').data.recipientId, 'applicant-1')
  assert.equal(writes.find(({ table }) => table === 'audit').data.actorMembershipId, 'authority-membership')
})

test('rejection marks membership terminal without department access and notifies applicant', async () => {
  const { database, writes } = decisionDatabase()
  const result = await decideRegistration(
    'institution-1',
    'pending-membership-1',
    { userId: 'authority-user', membershipId: 'authority-membership' },
    'REJECTED',
    { database },
  )

  assert.equal(result.status, 'REJECTED')
  assert.equal(writes.find(({ table }) => table === 'membershipUpdate').data.status, 'REJECTED')
  assert.equal(writes.some(({ table }) => table === 'departmentMembership'), false)
  assert.equal(writes.find(({ table }) => table === 'notification').data.type, 'MEMBERSHIP_REGISTRATION_REJECTED')
  assert.equal(writes.find(({ table }) => table === 'audit').data.action, 'STUDENT_REGISTRATION_REJECTED')
})

test('Authority cannot approve its own membership', async () => {
  const { database, writes } = decisionDatabase({
    membership: authorityMembership({ userId: 'authority-user' }),
  })
  await assert.rejects(
    decideRegistration(
      'institution-1',
      'pending-membership-1',
      { userId: 'authority-user', membershipId: 'authority-membership' },
      'APPROVED',
      { database },
    ),
    (error) => error.statusCode === 403 && error.code === 'SELF_APPROVAL_NOT_ALLOWED',
  )
  assert.equal(writes.length, 0)
})

test('Authority cannot approve a registration into a department outside the institution', async () => {
  const { database, writes } = decisionDatabase({ department: null })
  await assert.rejects(
    decideRegistration(
      'institution-1',
      'pending-membership-1',
      { userId: 'authority-user', membershipId: 'authority-membership' },
      'APPROVED',
      { database },
    ),
    (error) => error.statusCode === 409 && error.code === 'REGISTRATION_DEPARTMENT_NOT_FOUND',
  )
  assert.equal(writes.length, 0)
})

test('a second Authority decision cannot overwrite an already reviewed registration', async () => {
  const { database } = decisionDatabase({ updateCount: 0 })
  await assert.rejects(
    decideRegistration(
      'institution-1',
      'pending-membership-1',
      { userId: 'authority-user', membershipId: 'authority-membership' },
      'REJECTED',
      { database },
    ),
    (error) => error.statusCode === 409 && error.code === 'REGISTRATION_ALREADY_REVIEWED',
  )
})

test('cross-institution Authority registration queue access is denied', async (context) => {
  const authorizeInstitution = createRequireInstitutionAccess({
    database: {
      institutionMembership: { findFirst: async () => null },
      institution: { findFirst: async () => null },
    },
  })
  const app = createApp({
    institutionRouterOptions: {
      authorityRegistrationRouterOptions: {
        authenticate: (req, res, next) => {
          req.auth = { user: { id: 'authority-user' } }
          next()
        },
        authorizeInstitution,
      },
    },
  })
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/authority/institutions/institution-other/pending-registrations`,
  )
  const body = await response.json()
  assert.equal(response.status, 403)
  assert.equal(body.error.code, 'INSTITUTION_ACCESS_DENIED')
})

test('public registration API validates input and reaches the separate Student and Teacher routes', async (context) => {
  const received = []
  const app = createApp({
    institutionRouterOptions: {
      registrationRouterOptions: {
        controller: {
          lookup: (req, res) => res.status(200).json({ success: true }),
          registerStudent: (req, res) => {
            received.push({ role: 'STUDENT', body: req.validated.body })
            return res.status(201).json({ success: true })
          },
          registerTeacher: (req, res) => {
            received.push({ role: 'TEACHER', body: req.validated.body })
            return res.status(201).json({ success: true })
          },
        },
      },
    },
  })
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`

  const studentResponse = await fetch(`${baseUrl}/students/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentInput),
  })
  const teacherResponse = await fetch(`${baseUrl}/teachers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...studentInput, studentId: undefined, teacherId: 'T-200' }),
  })
  const invalidResponse = await fetch(`${baseUrl}/students/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...studentInput, password: 'short' }),
  })

  assert.equal(studentResponse.status, 201)
  assert.equal(teacherResponse.status, 201)
  assert.equal(invalidResponse.status, 400)
  assert.deepEqual(received.map(({ role }) => role), ['STUDENT', 'TEACHER'])
  assert.equal(received[0].body.institutionCode, 'IA-SCHOOL1')
  assert.equal(received[0].body.email, 'student@example.edu')
  assert.equal(received[1].body.teacherId, 'T-200')
})
