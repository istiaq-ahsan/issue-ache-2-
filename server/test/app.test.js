const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { z } = require('zod')
const app = require('../src/app')
const ApiError = require('../src/utils/api-error')
const validateRequest = require('../src/validators/validate-request')

let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
})

test('health endpoint returns the standard success response', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://localhost:5173' },
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.deepEqual(body.data, { status: 'ok' })
  assert.equal(body.meta.requestId, response.headers.get('x-request-id'))
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
  )
})

test('feature routes report that business behavior is not implemented', async () => {
  const featurePaths = [
    'auth',
    'institutions',
    'departments',
    'authorities',
    'students',
    'teachers',
    'memberships',
    'department-change-requests',
    'issues',
    'analytics',
  ]

  for (const path of featurePaths) {
    const response = await fetch(`${baseUrl}/api/${path}`)
    const body = await response.json()

    assert.equal(response.status, 501, path)
    assert.equal(body.success, false, path)
    assert.equal(body.error.code, 'FEATURE_NOT_IMPLEMENTED', path)
  }
})

test('subscription billing endpoints remain accessible for renewal but require the institution administrator', async () => {
  const current = await fetch(`${baseUrl}/api/subscriptions/current`)
  const renew = await fetch(`${baseUrl}/api/subscriptions/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planCode: 'BASIC', billingCycle: 'MONTHLY' }),
  })

  assert.equal(current.status, 401)
  assert.equal(renew.status, 401)
})

test('notification and audit endpoints require authenticated institution context', async () => {
  for (const path of ['notifications/institution-1', 'audit-logs/institution-1']) {
    const response = await fetch(`${baseUrl}/api/${path}`)
    const body = await response.json()

    assert.equal(response.status, 401, path)
    assert.equal(body.error.code, 'AUTHENTICATION_REQUIRED', path)
  }
})

test('unknown routes use the standard not-found response', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`)
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'ROUTE_NOT_FOUND')
})

test('invalid JSON uses the standard client-error response', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'INVALID_JSON')
})

test('request validation stores parsed input and forwards validation errors', () => {
  const middleware = validateRequest({
    body: z.object({ name: z.string().min(1) }),
  })
  const validRequest = { body: { name: 'Campus' } }
  let validError

  middleware(validRequest, {}, (error) => {
    validError = error
  })

  assert.equal(validError, undefined)
  assert.deepEqual(validRequest.validated.body, { name: 'Campus' })

  let invalidError
  middleware({ body: { name: '' } }, {}, (error) => {
    invalidError = error
  })

  assert.ok(invalidError instanceof ApiError)
  assert.equal(invalidError.statusCode, 400)
  assert.equal(invalidError.code, 'VALIDATION_ERROR')
})
