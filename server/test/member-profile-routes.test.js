const assert = require('node:assert/strict')
const express = require('express')
const { after, before, test } = require('node:test')
const createApiRouter = require('../src/routes')
const ApiError = require('../src/utils/api-error')
const errorHandler = require('../src/middlewares/error-handler')

let server
let baseUrl

before(async () => {
  const app = express()
  const authenticate = (req, res, next) => {
    req.auth = {
      user: { id: 'user-1' },
      membership: {
        id: 'membership-1',
        status: 'ACTIVE',
        deletedAt: null,
        role: req.get('x-test-role') || 'STUDENT',
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
  const profileController = {
    get: (req, res) => res.json({ role: req.auth.membership.role }),
    update: (req, res) => res.json({ updated: true }),
  }
  const departmentChangeController = {
    listMine: (req, res) => res.json({ role: req.auth.membership.role }),
    create: (req, res) => res.json({ submitted: true }),
    cancel: (req, res) => res.json({ cancelled: true }),
    listAuthority: (req, res) => res.json({ role: req.auth.membership.role }),
    getAuthority: (req, res) => res.json({ requestId: req.params.requestId }),
    decide: (req, res) => res.json({ decision: req.body.decision }),
  }
  app.use('/api', express.json(), createApiRouter({
    authenticate,
    institutionRouterOptions: {
      memberProfileRouterOptions: {
        authenticate,
        authorizeInstitution,
        requireSubscription: (req, res, next) => next(),
        profileController,
        departmentChangeController,
      },
      authorityDepartmentChangeRouterOptions: {
        authenticate,
        authorizeInstitution,
        attachScope: (req, res, next) => {
          req.scope = { departmentIds: ['department-1'] }
          return next()
        },
        requireSubscription: (req, res, next) => next(),
        controller: departmentChangeController,
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

test('member profile routes require a Student or Teacher institution role', async () => {
  const response = await fetch(`${baseUrl}/api/institutions/institution-1/profile`, {
    headers: { 'x-test-role': 'STUDENT' },
  })
  assert.equal(response.status, 200)

  const authorityResponse = await fetch(`${baseUrl}/api/institutions/institution-1/profile`, {
    headers: { 'x-test-role': 'AUTHORITY' },
  })
  assert.equal(authorityResponse.status, 403)
})

test('Authority request routes reject member roles', async () => {
  const response = await fetch(`${baseUrl}/api/authority/institutions/institution-1/department-change-requests`, {
    headers: { 'x-test-role': 'TEACHER' },
  })
  assert.equal(response.status, 403)

  const authorityResponse = await fetch(`${baseUrl}/api/authority/institutions/institution-1/department-change-requests`, {
    headers: { 'x-test-role': 'AUTHORITY' },
  })
  assert.equal(authorityResponse.status, 200)
})

test('profile and Authority request routes reject another institution context', async () => {
  const memberResponse = await fetch(`${baseUrl}/api/institutions/institution-2/profile`, {
    headers: { 'x-test-role': 'STUDENT' },
  })
  const authorityResponse = await fetch(`${baseUrl}/api/authority/institutions/institution-2/department-change-requests`, {
    headers: { 'x-test-role': 'AUTHORITY' },
  })

  assert.equal(memberResponse.status, 403)
  assert.equal(authorityResponse.status, 403)
})
