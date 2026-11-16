const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  addIssueNote,
  archiveIssue,
  createIssue,
  getIssue,
  listIssues,
  updateIssueStatus,
} = require('../src/services/issue.service')
const { createIssueSchema } = require('../src/validators/issue.validators')

function baseIssue(overrides = {}) {
  return {
    id: 'issue-1',
    institutionId: 'institution-1',
    departmentId: 'department-1',
    reporterId: 'student-user',
    reporterMembershipId: 'student-membership',
    title: 'Broken projector',
    description: 'The projector does not turn on.',
    category: 'CLASSROOM_EQUIPMENT',
    priority: 'MEDIUM',
    status: 'OPEN',
    audience: 'STUDENT',
    location: 'Room 12',
    resolutionSummary: null,
    archivedAt: null,
    createdAt: new Date('2026-11-04T10:00:00Z'),
    updatedAt: new Date('2026-11-04T10:00:00Z'),
    ...overrides,
  }
}

function makeCreateDatabase({ departmentMembership = { departmentId: 'department-1' } } = {}) {
  const writes = []
  const tx = {
    departmentMembership: {
      findFirst: async (args) => {
        writes.push({ table: 'departmentMembership.findFirst', args })
        return departmentMembership
      },
    },
    issue: {
      create: async ({ data }) => {
        writes.push({ table: 'issue.create', data })
        return baseIssue(data)
      },
    },
    issueHistory: {
      create: async ({ data }) => writes.push({ table: 'issueHistory.create', data }),
    },
    institutionMembership: {
      findMany: async () => [{ id: 'authority-membership', userId: 'authority-user' }],
    },
    notification: {
      createMany: async ({ data }) => writes.push({ table: 'notification.createMany', data }),
    },
    auditLog: {
      create: async ({ data }) => writes.push({ table: 'auditLog.create', data }),
    },
  }
  return { writes, database: { $transaction: async (callback) => callback(tx) } }
}

function makeStatusDatabase({ issue = baseIssue(), changedCount = 1 } = {}) {
  const writes = []
  const tx = {
    issue: {
      findFirst: async ({ where }) => {
        writes.push({ table: 'issue.findFirst', where })
        return issue
      },
      updateMany: async (args) => {
        writes.push({ table: 'issue.updateMany', args })
        return { count: changedCount }
      },
    },
    issueHistory: {
      create: async ({ data }) => writes.push({ table: 'issueHistory.create', data }),
    },
    notification: {
      create: async ({ data }) => writes.push({ table: 'notification.create', data }),
    },
    auditLog: {
      create: async ({ data }) => writes.push({ table: 'auditLog.create', data }),
    },
  }
  return { writes, database: { $transaction: async (callback) => callback(tx) } }
}

const member = { id: 'student-membership', role: 'STUDENT' }
const actor = { userId: 'authority-user', membershipId: 'authority-membership' }
const reportInput = {
  departmentId: 'department-1',
  title: 'Broken projector',
  description: 'The projector does not turn on.',
  category: 'CLASSROOM_EQUIPMENT',
  priority: 'MEDIUM',
  location: 'Room 12',
}

test('issue creation derives audience from the authenticated membership and writes history, notification, and audit', async () => {
  const { database, writes } = makeCreateDatabase()
  const issue = await createIssue('institution-1', member, 'student-user', reportInput, { database })

  const create = writes.find(({ table }) => table === 'issue.create').data
  assert.equal(create.audience, 'STUDENT')
  assert.equal(create.reporterId, 'student-user')
  assert.equal(create.reporterMembershipId, 'student-membership')
  assert.equal(issue.status, 'OPEN')
  assert.deepEqual(writes.find(({ table }) => table === 'issueHistory.create').data, {
    institutionId: 'institution-1',
    issueId: 'issue-1',
    oldStatus: null,
    newStatus: 'OPEN',
    changedById: 'student-user',
    changedByMembershipId: 'student-membership',
    note: null,
    resolutionSummary: null,
  })
  assert.equal(writes.find(({ table }) => table === 'notification.createMany').data[0].type, 'ISSUE_CREATED')
  assert.equal(writes.find(({ table }) => table === 'auditLog.create').data.action, 'ISSUE_CREATED')
})

test('teacher issue creation derives TEACHER audience', async () => {
  const { database, writes } = makeCreateDatabase()
  await createIssue(
    'institution-1',
    { id: 'teacher-membership', role: 'TEACHER' },
    'teacher-user',
    reportInput,
    { database },
  )
  assert.equal(writes.find(({ table }) => table === 'issue.create').data.audience, 'TEACHER')
})

test('issue creation requires an active department membership in the institution', async () => {
  const { database } = makeCreateDatabase({ departmentMembership: null })
  await assert.rejects(
    createIssue('institution-1', member, 'student-user', reportInput, { database }),
    (error) => error.statusCode === 404 && error.code === 'DEPARTMENT_MEMBERSHIP_NOT_FOUND',
  )
})

test('Authority cannot create a reporter issue', async () => {
  await assert.rejects(
    createIssue('institution-1', { id: 'authority-membership', role: 'AUTHORITY' }, 'authority-user', reportInput),
    (error) => error.statusCode === 403 && error.code === 'ROLE_NOT_AUTHORIZED',
  )
})

test('list applies institution and audience filters for members and both audiences for Authority', async () => {
  let where
  const database = {
    issue: {
      findMany: async (args) => {
        where = args.where
        return []
      },
    },
  }
  await listIssues('institution-1', 'STUDENT', {
    category: 'ELECTRICAL',
    priority: 'HIGH',
    status: 'OPEN',
    from: new Date('2026-11-01T00:00:00Z'),
    to: new Date('2026-11-04T00:00:00Z'),
  }, database)
  assert.equal(where.institutionId, 'institution-1')
  assert.equal(where.audience, 'STUDENT')
  assert.equal(where.category, 'ELECTRICAL')
  assert.equal(where.priority, 'HIGH')
  assert.equal(where.status, 'OPEN')
  assert.equal(where.archivedAt, null)
  assert.equal(where.createdAt.lt.toISOString(), '2026-11-05T00:00:00.000Z')

  await listIssues('institution-1', 'AUTHORITY', {}, database)
  assert.equal(where.institutionId, 'institution-1')
  assert.equal('audience' in where, false)
})

test('issue detail is tenant-scoped and exposes only public notes to members', async () => {
  let query
  const database = {
    issue: {
      findFirst: async (args) => {
        query = args
        return null
      },
    },
  }
  await assert.rejects(
    getIssue('institution-2', 'issue-from-institution-1', 'STUDENT', database),
    (error) => error.statusCode === 404 && error.code === 'ISSUE_NOT_FOUND',
  )
  assert.equal(query.where.institutionId, 'institution-2')
  assert.equal(query.where.audience, 'STUDENT')
  assert.deepEqual(query.select.notes.where, { visibility: 'PUBLIC' })
  assert.equal(query.select.history.select.note, false)

  await getIssue('institution-1', 'issue-1', 'AUTHORITY', {
    issue: { findFirst: async (args) => { query = args; return baseIssue({ notes: [] }) } },
  })
  assert.deepEqual(query.select.notes.where, {})
  assert.equal(query.select.history.select.note, true)
})

test('Authority can advance OPEN to IN_PROGRESS and records history, audit, and reporter notification', async () => {
  const { database, writes } = makeStatusDatabase()
  const result = await updateIssueStatus(
    'institution-1',
    'issue-1',
    actor,
    { status: 'IN_PROGRESS', note: 'Work has started.' },
    { database, now: new Date('2026-11-04T12:00:00Z') },
  )

  assert.equal(result.status, 'IN_PROGRESS')
  const history = writes.find(({ table }) => table === 'issueHistory.create').data
  assert.equal(history.oldStatus, 'OPEN')
  assert.equal(history.newStatus, 'IN_PROGRESS')
  assert.equal(history.note, 'Work has started.')
  assert.equal(writes.find(({ table }) => table === 'notification.create').data.recipientId, 'student-user')
  assert.equal(writes.find(({ table }) => table === 'auditLog.create').data.action, 'ISSUE_STATUS_CHANGED')
})

test('resolving requires a summary and stores it on the issue and history', async () => {
  const { database } = makeStatusDatabase({ issue: baseIssue({ status: 'IN_PROGRESS' }) })
  await assert.rejects(
    updateIssueStatus('institution-1', 'issue-1', actor, { status: 'RESOLVED' }, { database }),
    (error) => error.statusCode === 400 && error.code === 'RESOLUTION_SUMMARY_REQUIRED',
  )

  const success = makeStatusDatabase({ issue: baseIssue({ status: 'IN_PROGRESS' }) })
  await updateIssueStatus(
    'institution-1',
    'issue-1',
    actor,
    { status: 'RESOLVED', resolutionSummary: 'Replaced the projector cable.' },
    { database: success.database },
  )
  assert.equal(
    success.writes.find(({ table }) => table === 'issue.updateMany').args.data.resolutionSummary,
    'Replaced the projector cable.',
  )
  assert.equal(
    success.writes.find(({ table }) => table === 'issueHistory.create').data.resolutionSummary,
    'Replaced the projector cable.',
  )
})

test('unsupported direct, backward, and reopening transitions are rejected', async () => {
  for (const [current, next] of [
    ['OPEN', 'RESOLVED'],
    ['RESOLVED', 'IN_PROGRESS'],
    ['CLOSED', 'OPEN'],
  ]) {
    const { database, writes } = makeStatusDatabase({ issue: baseIssue({ status: current }) })
    await assert.rejects(
      updateIssueStatus('institution-1', 'issue-1', actor, { status: next }, { database }),
      (error) => error.statusCode === 409 && error.code === 'ISSUE_STATUS_TRANSITION_NOT_ALLOWED',
    )
    assert.equal(writes.some(({ table }) => table === 'issue.updateMany'), false)
  }
})

test('status updates reject archived or cross-institution issues and concurrent changes', async () => {
  const archived = makeStatusDatabase({ issue: baseIssue({ archivedAt: new Date() }) })
  await assert.rejects(
    updateIssueStatus('institution-1', 'issue-1', actor, { status: 'IN_PROGRESS' }, { database: archived.database }),
    (error) => error.statusCode === 409 && error.code === 'ISSUE_ARCHIVED',
  )

  const foreign = makeStatusDatabase({ issue: null })
  await assert.rejects(
    updateIssueStatus('institution-2', 'issue-1', actor, { status: 'IN_PROGRESS' }, { database: foreign.database }),
    (error) => error.statusCode === 404 && error.code === 'ISSUE_NOT_FOUND',
  )

  const concurrent = makeStatusDatabase({ changedCount: 0 })
  await assert.rejects(
    updateIssueStatus('institution-1', 'issue-1', actor, { status: 'IN_PROGRESS' }, { database: concurrent.database }),
    (error) => error.statusCode === 409 && error.code === 'ISSUE_CHANGED',
  )
})

test('Authority can add public and internal notes; archived issues reject new notes', async () => {
  const writes = []
  const database = {
    $transaction: async (callback) => callback({
      issue: { findFirst: async () => ({ id: 'issue-1', archivedAt: null }) },
      issueNote: {
        create: async ({ data }) => {
          writes.push({ table: 'note', data })
          return { id: 'note-1', ...data, author: { id: actor.userId, name: 'Authority' } }
        },
      },
      auditLog: { create: async ({ data }) => writes.push({ table: 'audit', data }) },
    }),
  }
  const note = await addIssueNote(
    'institution-1',
    'issue-1',
    actor,
    { content: 'Please keep the room clear.', visibility: 'PUBLIC' },
    { database },
  )
  assert.equal(note.visibility, 'PUBLIC')
  assert.equal(writes.find(({ table }) => table === 'audit').data.action, 'ISSUE_NOTE_CREATED')

  const archivedDatabase = {
    $transaction: async (callback) => callback({
      issue: { findFirst: async () => ({ id: 'issue-1', archivedAt: new Date() }) },
    }),
  }
  await assert.rejects(
    addIssueNote('institution-1', 'issue-1', actor, { content: 'Note', visibility: 'INTERNAL' }, { database: archivedDatabase }),
    (error) => error.statusCode === 409 && error.code === 'ISSUE_ARCHIVED',
  )
})

test('only RESOLVED or CLOSED issues can be archived; archive metadata is audited and tenant-scoped', async () => {
  const writes = []
  const database = {
    $transaction: async (callback) => callback({
      issue: {
        findFirst: async ({ where }) => where.institutionId === 'institution-1'
          ? { id: 'issue-1', status: 'RESOLVED', archivedAt: null }
          : null,
        updateMany: async (args) => {
          writes.push({ table: 'issue.updateMany', args })
          return { count: 1 }
        },
      },
      auditLog: { create: async ({ data }) => writes.push({ table: 'audit', data }) },
    }),
  }
  const result = await archiveIssue('institution-1', 'issue-1', actor, 'Work completed', { database })
  assert.equal(result.archiveReason, 'Work completed')
  assert.equal(writes.find(({ table }) => table === 'issue.updateMany').args.data.archivedByMembershipId, actor.membershipId)
  assert.equal(writes.find(({ table }) => table === 'audit').data.action, 'ISSUE_ARCHIVED')

  const notResolved = {
    $transaction: async (callback) => callback({
      issue: { findFirst: async () => ({ id: 'issue-1', status: 'OPEN', archivedAt: null }) },
    }),
  }
  await assert.rejects(
    archiveIssue('institution-1', 'issue-1', actor, 'Reason', { database: notResolved }),
    (error) => error.statusCode === 409 && error.code === 'ISSUE_NOT_ARCHIVABLE',
  )

  await assert.rejects(
    archiveIssue('institution-2', 'issue-1', actor, 'Reason', { database }),
    (error) => error.statusCode === 404 && error.code === 'ISSUE_NOT_FOUND',
  )
})

test('issue creation rejects audience values supplied by the client', () => {
  assert.equal(createIssueSchema.safeParse({ ...reportInput, audience: 'TEACHER' }).success, false)
})
