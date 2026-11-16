const assert = require('node:assert/strict')
const express = require('express')
const { after, before, test } = require('node:test')
const createApiRouter = require('../src/routes')
const errorHandler = require('../src/middlewares/error-handler')
const ApiError = require('../src/utils/api-error')

let server
let baseUrl
let subscriptionInactive = false

before(async () => {
  const app = express()
  const authenticate = (req, res, next) => {
    const role = req.get('x-test-role') || 'STUDENT'
    req.auth = {
      user: { id: 'user-1' },
      membership: {
        id: 'membership-1',
        status: 'ACTIVE',
        deletedAt: null,
        role,
      },
    }
    return next()
  }
  const authorizeInstitution = (req, res, next) => {
    if (req.params.institutionId !== 'institution-1') {
      return next(new ApiError(403, 'INSTITUTION_ACCESS_DENIED', 'No institution access'))
    }
    req.auth.institutionId = req.params.institutionId
    return next()
  }
  const controller = {
    create: (req, res) => res.status(201).json({ audience: req.auth.membership.role }),
    list: (req, res) => res.json({ audience: req.auth.membership.role }),
    get: (req, res) => res.json({ audience: req.auth.membership.role }),
    updateStatus: (req, res) => res.json({ ok: true }),
    addNote: (req, res) => res.json({ ok: true }),
    archive: (req, res) => res.json({ ok: true }),
  }
  app.use('/api', express.json(), createApiRouter({
    authenticate,
    institutionRouterOptions: {
      issueRouterOptions: {
        authenticate,
        authorizeInstitution,
        requireSubscription: (req, res, next) => (
          subscriptionInactive
            ? next(new ApiError(402, 'SUBSCRIPTION_INACTIVE', 'Renew the institution subscription'))
            : next()
        ),
        controller,
      },
    },
  }))
  app.use(errorHandler)
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

test('only Student and Teacher roles can create issues; Authority can view issues', async () => {
  const create = await fetch(`${baseUrl}/api/issues/institution-1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-role': 'STUDENT' },
    body: JSON.stringify({
      departmentId: 'department-1',
      title: 'Broken projector',
      description: 'It is not working',
      category: 'CLASSROOM_EQUIPMENT',
      priority: 'LOW',
      location: 'Room 12',
    }),
  })
  assert.equal(create.status, 201)

  const authorityCreate = await fetch(`${baseUrl}/api/issues/institution-1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-role': 'AUTHORITY' },
    body: JSON.stringify({
      departmentId: 'department-1',
      title: 'Broken projector',
      description: 'It is not working',
      category: 'CLASSROOM_EQUIPMENT',
      priority: 'LOW',
      location: 'Room 12',
    }),
  })
  assert.equal(authorityCreate.status, 403)

  const authorityList = await fetch(`${baseUrl}/api/issues/institution-1`, {
    headers: { 'x-test-role': 'AUTHORITY' },
  })
  assert.equal(authorityList.status, 200)
})

test('Authority-only issue management rejects Student and Teacher actions', async () => {
  for (const role of ['STUDENT', 'TEACHER']) {
    const response = await fetch(`${baseUrl}/api/issues/institution-1/issue-1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-test-role': role },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    })
    assert.equal(response.status, 403)
  }
})

test('issue routes reject cross-institution access', async () => {
  const response = await fetch(`${baseUrl}/api/issues/institution-2`, {
    headers: { 'x-test-role': 'STUDENT' },
  })

  test('issue writes are blocked when the institution subscription is inactive', async () => {
    subscriptionInactive = true
    const response = await fetch(`${baseUrl}/api/issues/institution-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-role': 'STUDENT' },
      body: JSON.stringify({
        departmentId: 'department-1',
        title: 'Broken projector',
        description: 'It is not working',
        category: 'CLASSROOM_EQUIPMENT',
        priority: 'LOW',
        location: 'Room 12',
      }),
    })
    subscriptionInactive = false
    const body = await response.json()

    assert.equal(response.status, 402)
    assert.equal(body.error.code, 'SUBSCRIPTION_INACTIVE')
  })
  assert.equal(response.status, 403)
})

test('issue creation rejects audience supplied by the client', async () => {
  const response = await fetch(`${baseUrl}/api/issues/institution-1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-role': 'STUDENT' },
    body: JSON.stringify({
      departmentId: 'department-1',
      title: 'Broken projector',
      description: 'It is not working',
      category: 'CLASSROOM_EQUIPMENT',
      priority: 'LOW',
      location: 'Room 12',
      audience: 'TEACHER',
    }),
  })
  const body = await response.json()
  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
})
