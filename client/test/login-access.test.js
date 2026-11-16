import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getAuthorizedReturnPath,
  getLoginCandidates,
  getLoginDestination,
  hasPendingRegistration,
} from '../src/services/login-access.js'
import { getDashboardOptions } from '../src/services/dashboard-access.js'

function createMembership(role, institutionId, overrides = {}) {
  return {
    role,
    institutionId,
    status: 'ACTIVE',
    deletedAt: null,
    institution: { id: institutionId, name: `Institution ${institutionId}` },
    departmentMemberships: [
      {
        department: { status: 'ACTIVE', subscriptions: [{ id: 'subscription-1' }] },
      },
    ],
    ...overrides,
  }
}

test('Authority login returns only active, non-deleted Authority memberships', () => {
  const profile = {
    memberships: [
      createMembership('AUTHORITY', 'one'),
      createMembership('AUTHORITY', 'pending', { status: 'PENDING' }),
      createMembership('AUTHORITY', 'deleted', { deletedAt: new Date() }),
      createMembership('STUDENT', 'student'),
    ],
  }

  assert.deepEqual(getLoginCandidates('authority', profile), [
    profile.memberships[0],
  ])
})

test('Student and Teacher candidates require an eligible active department', () => {
  const student = createMembership('STUDENT', 'student')
  const teacher = createMembership('TEACHER', 'teacher')
  const expiredDepartment = createMembership('STUDENT', 'expired', {
    departmentMemberships: [
      { department: { status: 'EXPIRED', subscriptions: [] } },
    ],
  })

  assert.deepEqual(
    getLoginCandidates('student', {
      memberships: [student, teacher, expiredDepartment],
    }),
    [student],
  )
  assert.deepEqual(
    getLoginCandidates('teacher', { memberships: [student, teacher] }),
    [teacher],
  )
})

test('pending and rejected registrations remain eligible for the status flow', () => {
  assert.equal(
    hasPendingRegistration('student', {
      memberships: [
        { role: 'STUDENT', status: 'PENDING', deletedAt: null },
      ],
    }),
    true,
  )
  assert.equal(
    hasPendingRegistration('teacher', {
      memberships: [
        { role: 'TEACHER', status: 'REJECTED', deletedAt: null },
      ],
    }),
    true,
  )
})

test('institution login uses the server-returned ownership list', () => {
  const institutions = [{ id: 'one' }, { id: 'two' }]
  assert.deepEqual(
    getLoginCandidates('institution', {
      administeredInstitutions: institutions,
    }),
    institutions,
  )
  assert.equal(getLoginDestination('institution', 'one'), '/institution/dashboard/one')
})

test('role dashboards use the existing institution-scoped routes', () => {
  assert.equal(
    getLoginDestination('authority', 'one'),
    '/authority/institutions/one/dashboard',
  )
  assert.equal(getLoginDestination('student', 'one'), '/student/dashboard/one')
  assert.equal(getLoginDestination('teacher', 'one'), '/teacher/dashboard/one')
})

test('dashboard destinations use only verified active account memberships', () => {
  const profile = {
    administeredInstitutions: [{ id: 'admin' }],
    memberships: [
      createMembership('AUTHORITY', 'authority'),
      createMembership('STUDENT', 'student'),
      createMembership('TEACHER', 'teacher'),
      createMembership('STUDENT', 'pending', { status: 'PENDING' }),
    ],
  }

  assert.deepEqual(
    getDashboardOptions(profile).map(({ path }) => path),
    [
      '/authority/institutions/authority/dashboard',
      '/institution/dashboard',
      '/student/dashboard/student',
      '/teacher/dashboard/teacher',
    ],
  )
})

test('multiple verified memberships remain separate dashboard choices', () => {
  const profile = {
    memberships: [
      createMembership('STUDENT', 'one'),
      createMembership('STUDENT', 'two'),
    ],
  }

  assert.deepEqual(
    getDashboardOptions(profile).map(({ path }) => path),
    ['/student/dashboard/one', '/student/dashboard/two'],
  )
})

test('return paths are honored only for a verified matching institution and role', () => {
  const candidates = [
    createMembership('AUTHORITY', 'one', { id: 'membership-1' }),
    createMembership('AUTHORITY', 'two', { id: 'membership-2' }),
  ]

  assert.equal(
    getAuthorizedReturnPath(
      'authority',
      { pathname: '/authority/institutions/one/issues', search: '?status=OPEN' },
      candidates,
    ),
    '/authority/institutions/one/issues?status=OPEN',
  )
  assert.equal(
    getAuthorizedReturnPath(
      'authority',
      { pathname: '/authority/institutions/three/issues' },
      candidates,
    ),
    null,
  )
  assert.equal(
    getAuthorizedReturnPath(
      'student',
      { pathname: '/authority/institutions/one/issues' },
      candidates,
    ),
    null,
  )
})
