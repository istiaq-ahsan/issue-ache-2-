const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { createApp } = require('../src/app')
const { createRequireInstitutionAdministrator } = require('../src/middlewares/auth')

let server
let baseUrl

before(async () => {
  const authorizeAdministrator = createRequireInstitutionAdministrator({
    database: {
      institution: {
        findFirst: async ({ where }) =>
          where.id === 'institution-owned' && where.adminUserId === 'user-1'
            ? {
                id: where.id,
                name: 'Owned Institution',
                institutionCode: 'OWNED',
                contactPersonName: 'Admin',
                contactEmail: 'contact@example.edu',
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
        req.auth = { user: { id: 'user-1' } }
        next()
      },
      authorizeAdministrator,
      controller: {
        dashboard: (req, res) => res.status(200).json({ success: true }),
      },
    },
  })
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

test('institution administrator cannot access a different institution dashboard', async () => {
  const response = await fetch(`${baseUrl}/api/institutions/institution-other/dashboard`)
  const body = await response.json()

  assert.equal(response.status, 403)
  assert.equal(body.error.code, 'INSTITUTION_ACCESS_DENIED')
})

test('authorized institution administrator can access the dashboard route', async () => {
  const response = await fetch(`${baseUrl}/api/institutions/institution-owned/dashboard`)

  assert.equal(response.status, 200)
})

test('institution administrator cannot list another institution departments', async () => {
  const response = await fetch(
    `${baseUrl}/api/institutions/institution-other/departments`,
  )
  const body = await response.json()

  assert.equal(response.status, 403)
  assert.equal(body.error.code, 'INSTITUTION_ACCESS_DENIED')
})

test('legacy institution registration endpoint is disabled', async () => {
  const response = await fetch(`${baseUrl}/api/institutions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.error.code, 'ROUTE_NOT_FOUND')
})
