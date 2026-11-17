const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  attachAuthorityScope,
  getAuthorityDepartmentIds,
} = require('../src/middlewares/authority-scope')

function runMiddleware(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error)))
}

test('Authority scope reads one AuthorityDepartment row and returns a department-id array', async () => {
  let query
  const departmentIds = await getAuthorityDepartmentIds('authority-membership', {
    authorityDepartment: {
      findFirst: async (args) => {
        query = args
        return { departmentId: 'department-1' }
      },
    },
  })

  assert.deepEqual(query.where, { authorityMembershipId: 'authority-membership' })
  assert.deepEqual(departmentIds, ['department-1'])
})

test('scope middleware rejects unassigned Authorities and out-of-scope department context', async () => {
  const middleware = attachAuthorityScope({
    database: {
      authorityDepartment: {
        findFirst: async () => ({ departmentId: 'department-1' }),
      },
    },
  })
  const req = {
    auth: {
      institutionId: 'institution-1',
      departmentId: 'department-2',
      membership: { id: 'authority-membership', role: 'AUTHORITY' },
    },
  }

  const error = await runMiddleware(middleware, req)
  assert.equal(error.statusCode, 404)
  assert.equal(error.code, 'RESOURCE_NOT_FOUND')
  assert.equal(req.scope, undefined)

  const unassigned = await runMiddleware(
    attachAuthorityScope({
      database: { authorityDepartment: { findFirst: async () => null } },
    }),
    {
      auth: {
        institutionId: 'institution-1',
        membership: { id: 'authority-membership', role: 'AUTHORITY' },
      },
    },
  )
  assert.equal(unassigned.statusCode, 403)
  assert.equal(unassigned.code, 'AUTHORITY_DEPARTMENT_ASSIGNMENT_REQUIRED')
})

test('institution administrators receive an unrestricted scope without querying assignments', async () => {
  const middleware = attachAuthorityScope({
    database: {
      authorityDepartment: {
        findMany: async () => { throw new Error('must not query Authority assignments') },
      },
    },
  })
  const req = { auth: { institutionAdministrator: true, institutionId: 'institution-1' } }
  const error = await runMiddleware(middleware, req)

  assert.equal(error, undefined)
  assert.deepEqual(req.scope, { departmentIds: null })
})
