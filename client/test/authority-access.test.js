import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getActiveAuthorityDashboardPath,
  getAuthorityLoginError,
} from '../src/services/authority-access.js'

test('one active Authority membership selects the existing dashboard using the server-provided institution', () => {
  assert.equal(
    getActiveAuthorityDashboardPath([
      {
        role: 'AUTHORITY',
        status: 'ACTIVE',
        institutionId: 'campus/one',
        deletedAt: null,
      },
    ]),
    '/authority/institutions/campus%2Fone/dashboard',
  )
})

test('multiple active Authority memberships require an institution choice', () => {
  assert.equal(
    getActiveAuthorityDashboardPath([
      { role: 'AUTHORITY', status: 'ACTIVE', institutionId: 'campus-1' },
      { role: 'AUTHORITY', status: 'ACTIVE', institutionId: 'campus-2' },
    ]),
    null,
  )
})

test('inactive or deleted Authority memberships do not authorize login', () => {
  assert.equal(
    getActiveAuthorityDashboardPath([
      { role: 'AUTHORITY', status: 'INACTIVE', institutionId: 'campus-1' },
      {
        role: 'AUTHORITY',
        status: 'ACTIVE',
        institutionId: 'campus-2',
        deletedAt: new Date(),
      },
    ]),
    null,
  )
})

test('Student and Teacher memberships do not authorize Authority login', () => {
  assert.equal(
    getActiveAuthorityDashboardPath([
      { role: 'STUDENT', status: 'ACTIVE', institutionId: 'campus-1' },
      { role: 'TEACHER', status: 'ACTIVE', institutionId: 'campus-2' },
    ]),
    null,
  )
})

test('invalid Firebase credentials receive a clear message', () => {
  assert.equal(
    getAuthorityLoginError({ code: 'auth/invalid-credential' }),
    'Email or password is incorrect.',
  )
})

test('accounts without an active server-authorized Authority role receive a clear message', () => {
  assert.match(
    getAuthorityLoginError({ response: { status: 403 } }),
    /active Authority membership/,
  )
})
