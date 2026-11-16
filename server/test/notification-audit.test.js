const assert = require('node:assert/strict')
const express = require('express')
const { after, before, test } = require('node:test')
const createApiRouter = require('../src/routes')
const errorHandler = require('../src/middlewares/error-handler')
const ApiError = require('../src/utils/api-error')
const {
  getAuditLog,
  listAuditLogs,
  redactSensitiveMetadata,
} = require('../src/services/audit-log.service')
const {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require('../src/services/notification.service')

let server
let baseUrl

function notification(id, overrides = {}) {
  return {
    id,
    institutionId: 'institution-1',
    type: 'ISSUE_STATUS_CHANGED',
    title: 'Issue updated',
    message: 'Your issue changed status',
    relatedEntityType: 'Issue',
    relatedEntityId: 'issue-1',
    readAt: null,
    createdAt: new Date('2026-11-04T10:00:00Z'),
    ...overrides,
  }
}

function auditLog(id, overrides = {}) {
  return {
    id,
    institutionId: 'institution-1',
    actorId: 'actor-1',
    action: 'ISSUE_STATUS_CHANGED',
    entityType: 'Issue',
    entityId: 'issue-1',
    metadata: {
      oldStatus: 'OPEN',
      newStatus: 'IN_PROGRESS',
      nested: { password: 'should-not-leak', count: 2 },
    },
    createdAt: new Date('2026-11-04T11:00:00Z'),
    actor: { id: 'actor-1', name: 'Authority' },
    ...overrides,
  }
}

test('notification listing scopes to recipient and institution and returns unread count', async () => {
  let listArgs
  let countArgs
  const rows = [notification('notification-1')]
  const result = await listNotifications(
    'institution-1',
    'recipient-1',
    { unreadOnly: true, limit: 10 },
    {
      notification: {
        findMany: async (args) => { listArgs = args; return rows },
        count: async (args) => { countArgs = args; return 3 },
      },
    },
  )

  assert.deepEqual(listArgs.where, {
    institutionId: 'institution-1',
    recipientId: 'recipient-1',
    readAt: null,
  })
  assert.deepEqual(countArgs.where, {
    institutionId: 'institution-1',
    recipientId: 'recipient-1',
    readAt: null,
  })
  assert.equal(result.unreadCount, 3)
  assert.equal(result.notifications[0].id, 'notification-1')
  assert.equal('recipientId' in result.notifications[0], false)
})

test('mark notification read only updates the matching tenant recipient', async () => {
  let updateArgs
  let selectArgs
  const result = await markNotificationRead(
    'institution-1',
    'recipient-1',
    'notification-1',
    {
      now: new Date('2026-11-05T00:00:00Z'),
      database: {
        notification: {
          updateMany: async (args) => { updateArgs = args; return { count: 1 } },
          findFirst: async (args) => {
            selectArgs = args
            return notification('notification-1', { readAt: args.select ? new Date('2026-11-05T00:00:00Z') : null })
          },
        },
      },
    },
  )
  assert.deepEqual(updateArgs.where, {
    id: 'notification-1',
    institutionId: 'institution-1',
    recipientId: 'recipient-1',
    readAt: null,
  })
  assert.equal(selectArgs.where.recipientId, 'recipient-1')
  assert.ok(result.readAt)
})

test('foreign notification IDs are not readable or markable by another recipient', async () => {
  await assert.rejects(
    markNotificationRead('institution-2', 'recipient-1', 'foreign-id', {
      database: {
        notification: {
          updateMany: async () => ({ count: 0 }),
          findFirst: async ({ where }) => {
            assert.deepEqual(where, {
              id: 'foreign-id',
              institutionId: 'institution-2',
              recipientId: 'recipient-1',
            })
            return null
          },
        },
      },
    }),
    (error) => error.statusCode === 404 && error.code === 'NOTIFICATION_NOT_FOUND',
  )
})

test('mark all read updates only the current recipient within the institution', async () => {
  let args
  const result = await markAllNotificationsRead('institution-1', 'recipient-1', {
    now: new Date('2026-11-05T00:00:00Z'),
    database: {
      notification: {
        updateMany: async (value) => { args = value; return { count: 4 } },
      },
    },
  })
  assert.deepEqual(args.where, {
    institutionId: 'institution-1',
    recipientId: 'recipient-1',
    readAt: null,
  })
  assert.equal(result.markedRead, 4)
})

test('Authority notification reads and updates are department-scoped', async () => {
  let listWhere
  await listNotifications(
    'institution-1',
    'authority-user',
    {},
    {
      notification: {
        findMany: async ({ where }) => { listWhere = where; return [] },
        count: async () => 0,
      },
    },
    { departmentIds: ['department-1'] },
  )
  assert.deepEqual(listWhere.departmentId, { in: ['department-1'] })

  let updateWhere
  let fallbackWhere
  await assert.rejects(
    markNotificationRead(
      'institution-1',
      'authority-user',
      'notification-2',
      {
        scope: { departmentIds: ['department-1'] },
        database: {
          notification: {
            updateMany: async ({ where }) => { updateWhere = where; return { count: 0 } },
            findFirst: async ({ where }) => { fallbackWhere = where; return null },
          },
        },
      },
    ),
    (error) => error.statusCode === 404,
  )
  assert.deepEqual(updateWhere.departmentId, { in: ['department-1'] })
  assert.deepEqual(fallbackWhere.departmentId, { in: ['department-1'] })
})

test('Authority notification filters stay within one assigned department', async () => {
  let where
  await listNotifications(
    'institution-1',
    'authority-user',
    { departmentId: 'department-1' },
    {
      notification: {
        findMany: async ({ where: query }) => { where = query; return [] },
        count: async () => 0,
      },
    },
    { departmentIds: ['department-1', 'department-2'] },
  )
  assert.equal(where.departmentId, 'department-1')

  await assert.rejects(
    listNotifications('institution-1', 'authority-user', { departmentId: 'department-3' }, {}, {
      departmentIds: ['department-1', 'department-2'],
    }),
    (error) => error.statusCode === 404,
  )
})

test('audit listing is tenant-filtered and returns redacted metadata without credential keys', async () => {
  let findArgs
  let countArgs
  const result = await listAuditLogs('institution-1', { limit: 20, offset: 0 }, {
    auditLog: {
      findMany: async (args) => { findArgs = args; return [auditLog('audit-1')] },
      count: async (args) => { countArgs = args; return 1 },
    },
  })
  assert.equal(findArgs.where.institutionId, 'institution-1')
  assert.equal(countArgs.where.institutionId, 'institution-1')
  assert.equal(result.auditLogs[0].metadata.newStatus, 'IN_PROGRESS')
  assert.equal('password' in result.auditLogs[0].metadata.nested, false)
  assert.equal(result.total, 1)
})

test('Authority audit listing and detail are department-scoped', async () => {
  let listWhere
  await listAuditLogs(
    'institution-1',
    {},
    {
      auditLog: {
        findMany: async ({ where }) => { listWhere = where; return [] },
        count: async () => 0,
      },
    },
    { departmentIds: ['department-1'] },
  )
  assert.deepEqual(listWhere.departmentId, { in: ['department-1'] })

  let detailWhere
  await assert.rejects(
    getAuditLog(
      'institution-1',
      'audit-2',
      {
        auditLog: {
          findFirst: async ({ where }) => { detailWhere = where; return null },
        },
      },
      { departmentIds: ['department-1'] },
    ),
    (error) => error.statusCode === 404,
  )
  assert.deepEqual(detailWhere.departmentId, { in: ['department-1'] })
})

test('Authority audit filters reject unassigned departments', async () => {
  await assert.rejects(
    listAuditLogs(
      'institution-1',
      { departmentId: 'department-2' },
      {},
      { departmentIds: ['department-1'] },
    ),
    (error) => error.statusCode === 404,
  )
})

test('audit detail lookup is institution-scoped and metadata sanitizer redacts nested credentials', async () => {
  let where
  const result = await getAuditLog('institution-1', 'audit-1', {
    auditLog: {
      findFirst: async (args) => { where = args.where; return auditLog('audit-1') },
    },
  })
  assert.deepEqual(where, { id: 'audit-1', institutionId: 'institution-1' })
  assert.deepEqual(
    redactSensitiveMetadata({ key: 'value', firebasePrivateKey: 'secret', nested: { token: 'secret' } }),
    { key: 'value', nested: {} },
  )
  await assert.rejects(
    getAuditLog('institution-2', 'audit-1', {
      auditLog: { findFirst: async () => null },
    }),
    (error) => error.statusCode === 404 && error.code === 'AUDIT_LOG_NOT_FOUND',
  )
})

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
      ...(req.get('x-test-admin') === 'true' ? { institutionAdministrator: true } : {}),
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
  const notificationController = {
    list: (req, res) => res.json({ recipientId: req.auth.user.id }),
    markRead: (req, res) => res.json({ recipientId: req.auth.user.id }),
    markAllRead: (req, res) => res.json({ recipientId: req.auth.user.id }),
  }
  const auditController = {
    list: (req, res) => res.json({ institutionId: req.auth.institutionId }),
    get: (req, res) => res.json({ auditLogId: req.params.auditLogId }),
  }
  const attachScope = (req, res, next) => {
    req.scope = req.auth.membership?.role === 'AUTHORITY'
      ? { departmentIds: ['department-1'] }
      : { departmentIds: null }
    return next()
  }
  function authorizeAudit(req, res, next) {
    if (req.auth.institutionAdministrator || req.auth.membership.role === 'AUTHORITY') return next()
    return next(new ApiError(403, 'ROLE_NOT_AUTHORIZED', 'No audit access'))
  }
  app.use('/api', express.json(), createApiRouter({
    authenticate,
    institutionRouterOptions: {
      notificationRouterOptions: {
        authenticate,
        authorizeInstitution,
        attachScope,
        controller: notificationController,
      },
      auditLogRouterOptions: {
        authenticate,
        authorizeInstitution,
        authorizeViewer: authorizeAudit,
        attachScope,
        controller: auditController,
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

test('notification endpoints use the authenticated recipient and tenant; audit logs are read-only and restricted', async () => {
  const notificationResponse = await fetch(`${baseUrl}/api/notifications/institution-1`)
  assert.equal(notificationResponse.status, 200)
  assert.deepEqual(await notificationResponse.json(), { recipientId: 'user-1' })

  const foreignResponse = await fetch(`${baseUrl}/api/notifications/institution-2`)
  assert.equal(foreignResponse.status, 403)

  const unauthorizedAudit = await fetch(`${baseUrl}/api/audit-logs/institution-1`)
  assert.equal(unauthorizedAudit.status, 403)

  const authorityAudit = await fetch(`${baseUrl}/api/audit-logs/institution-1`, {
    headers: { 'x-test-role': 'AUTHORITY' },
  })
  assert.equal(authorityAudit.status, 200)

  const adminAudit = await fetch(`${baseUrl}/api/audit-logs/institution-1`, {
    headers: { 'x-test-admin': 'true' },
  })
  assert.equal(adminAudit.status, 200)

  const updateAttempt = await fetch(`${baseUrl}/api/audit-logs/institution-1/audit-1`, {
    method: 'DELETE',
    headers: { 'x-test-role': 'AUTHORITY' },
  })
  assert.equal(updateAttempt.status, 404)
})
