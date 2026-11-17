const ApiError = require('../utils/api-error')
const { writeAuditLog } = require('./audit-log.service')
const {
  ensureAuthorityDepartmentInScope,
  getDepartmentScopeWhere,
} = require('../middlewares/authority-scope')

function getDatabase() {
  return require('../config/prisma')
}

function issueNotFound() {
  return new ApiError(404, 'ISSUE_NOT_FOUND', 'Issue was not found')
}

function issueConflict(code, message) {
  return new ApiError(409, code, message)
}

function roleAudience(role) {
  if (role === 'STUDENT' || role === 'TEACHER') return role
  throw new ApiError(403, 'ROLE_NOT_AUTHORIZED', 'Only students and teachers can report issues')
}

function issueVisibilityWhere(role) {
  if (role === 'AUTHORITY') return {}
  return { audience: roleAudience(role) }
}

function issueSelect({
  details = false,
  includeInternalNotes = false,
  includeReporterDetails = false,
} = {}) {
  const select = {
    id: true,
    institutionId: true,
    departmentId: true,
    reporterId: includeReporterDetails,
    reporterMembershipId: includeReporterDetails,
    title: true,
    description: true,
    category: true,
    priority: true,
    status: true,
    audience: true,
    location: true,
    resolutionSummary: true,
    archivedAt: true,
    archivedById: true,
    archivedByMembershipId: true,
    archiveReason: true,
    createdAt: true,
    updatedAt: true,
    department: { select: { id: true, name: true } },
    reporter: includeReporterDetails
      ? { select: { id: true, name: true } }
      : false,
  }

  if (details) {
    select.archivedBy = { select: { id: true, name: true } }
    select.history = {
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        oldStatus: true,
        newStatus: true,
        changedById: true,
        note: includeInternalNotes,
        resolutionSummary: true,
        createdAt: true,
        changedBy: { select: { id: true, name: true } },
      },
    }
    select.notes = {
      where: includeInternalNotes ? {} : { visibility: 'PUBLIC' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        visibility: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    }
  }

  return select
}

function serializeIssue(issue) {
  return {
    ...issue,
    reporter: issue.reporter
      ? { id: issue.reporter.id, name: issue.reporter.name }
      : undefined,
  }
}

async function createIssue(
  institutionId,
  membership,
  userId,
  input,
  { database = getDatabase(), now = new Date() } = {},
) {
  const audience = roleAudience(membership.role)

  return database.$transaction(async (transaction) => {
    const departmentMembership = await transaction.departmentMembership.findFirst({
      where: {
        institutionId,
        membershipId: membership.id,
        departmentId: input.departmentId,
        isActive: true,
      },
      select: {
        departmentId: true,
        department: { select: { name: true } },
      },
    })
    if (!departmentMembership) {
      throw new ApiError(
        404,
        'DEPARTMENT_MEMBERSHIP_NOT_FOUND',
        'Choose a department where you have an active membership',
      )
    }

    const issue = await transaction.issue.create({
      data: {
        institutionId,
        departmentId: departmentMembership.departmentId,
        reporterId: userId,
        reporterMembershipId: membership.id,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        audience,
        location: input.location,
      },
      select: issueSelect(),
    })

    await transaction.issueHistory.create({
      data: {
        institutionId,
        issueId: issue.id,
        oldStatus: null,
        newStatus: 'OPEN',
        changedById: userId,
        changedByMembershipId: membership.id,
        note: null,
        resolutionSummary: null,
      },
    })

    const assignments = await transaction.authorityDepartment.findMany({
      where: {
        institutionId,
        departmentId: issue.departmentId,
        authorityMembership: {
          role: 'AUTHORITY',
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      select: {
        authorityMembership: { select: { id: true, userId: true } },
      },
    })
    const authorities = assignments.map(({ authorityMembership }) => authorityMembership)
    if (authorities.length > 0) {
      await transaction.notification.createMany({
        data: authorities.map((authority) => ({
          institutionId,
          departmentId: issue.departmentId,
          recipientId: authority.userId,
          recipientMembershipId: authority.id,
          type: 'ISSUE_CREATED',
          title: 'New issue reported',
          message: `A ${audience.toLowerCase()} reported "${issue.title}".`,
          relatedEntityType: 'Issue',
          relatedEntityId: issue.id,
        })),
      })
    }

    await writeAuditLog(transaction, {
      data: {
        institutionId,
        departmentId: issue.departmentId,
        actorId: userId,
        actorMembershipId: membership.id,
        action: 'ISSUE_CREATED',
        entityType: 'Issue',
        entityId: issue.id,
        metadata: {
          audience,
          category: issue.category,
          priority: issue.priority,
          departmentId: issue.departmentId,
        },
      },
    })

    return serializeIssue(issue)
  })
}

async function listIssues(
  institutionId,
  role,
  filters = {},
  database = getDatabase(),
  scope = null,
) {
  if (role === 'AUTHORITY' && filters.departmentId) {
    ensureAuthorityDepartmentInScope(scope, filters.departmentId)
  }
  const archived = filters.archived === 'true'
  const where = {
    institutionId,
    ...issueVisibilityWhere(role),
    ...(role === 'AUTHORITY' ? getDepartmentScopeWhere(scope) : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to
              ? { lt: new Date(filters.to.getTime() + 24 * 60 * 60 * 1000) }
              : {}),
          },
        }
      : {}),
    ...(filters.archived === 'all'
      ? {}
      : { archivedAt: archived ? { not: null } : null }),
  }
  const issues = await database.issue.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: issueSelect({ includeReporterDetails: role === 'AUTHORITY' }),
  })
  return issues.map(serializeIssue)
}

async function getIssue(
  institutionId,
  issueId,
  role,
  database = getDatabase(),
  scope = null,
) {
  const issue = await database.issue.findFirst({
    where: {
      id: issueId,
      institutionId,
      ...issueVisibilityWhere(role),
      ...(role === 'AUTHORITY' ? getDepartmentScopeWhere(scope) : {}),
    },
    select: issueSelect({
      details: true,
      includeInternalNotes: role === 'AUTHORITY',
      includeReporterDetails: role === 'AUTHORITY',
    }),
  })
  if (!issue) throw issueNotFound()
  return serializeIssue(issue)
}

async function updateIssueStatus(
  institutionId,
  issueId,
  actor,
  input,
  { database = getDatabase(), now = new Date(), scope = null } = {},
) {
  return database.$transaction(async (transaction) => {
    const issue = await transaction.issue.findFirst({
      where: {
        id: issueId,
        institutionId,
        ...getDepartmentScopeWhere(scope),
      },
      select: {
        id: true,
        departmentId: true,
        status: true,
        archivedAt: true,
        reporterId: true,
        reporterMembershipId: true,
        audience: true,
        title: true,
        resolutionSummary: true,
      },
    })
    if (!issue) throw issueNotFound()
    if (issue.archivedAt) {
      throw issueConflict('ISSUE_ARCHIVED', 'Archived issues cannot be changed')
    }

    const nextByStatus = {
      OPEN: 'IN_PROGRESS',
      IN_PROGRESS: 'RESOLVED',
      RESOLVED: 'CLOSED',
    }
    if (nextByStatus[issue.status] !== input.status) {
      throw issueConflict(
        'ISSUE_STATUS_TRANSITION_NOT_ALLOWED',
        'Issues can only move to the next documented lifecycle status',
      )
    }
    if (input.status === 'RESOLVED' && !input.resolutionSummary) {
      throw new ApiError(
        400,
        'RESOLUTION_SUMMARY_REQUIRED',
        'A resolution summary is required when resolving an issue',
      )
    }

    const data = { status: input.status }
    if (input.status === 'RESOLVED') data.resolutionSummary = input.resolutionSummary
    const changed = await transaction.issue.updateMany({
      where: {
        id: issueId,
        institutionId,
        ...getDepartmentScopeWhere(scope),
        status: issue.status,
        archivedAt: null,
      },
      data,
    })
    if (changed.count !== 1) {
      throw issueConflict('ISSUE_CHANGED', 'The issue was updated by another user; reload and try again')
    }

    await transaction.issueHistory.create({
      data: {
        institutionId,
        issueId,
        oldStatus: issue.status,
        newStatus: input.status,
        changedById: actor.userId,
        changedByMembershipId: actor.membershipId,
        note: input.note || null,
        resolutionSummary: input.status === 'RESOLVED'
          ? input.resolutionSummary
          : issue.resolutionSummary,
      },
    })

    await transaction.notification.create({
      data: {
        institutionId,
        departmentId: issue.departmentId,
        recipientId: issue.reporterId,
        recipientMembershipId: issue.reporterMembershipId,
        type: 'ISSUE_STATUS_CHANGED',
        title: 'Issue status updated',
        message: `"${issue.title}" is now ${input.status.toLowerCase().replaceAll('_', ' ')}.`,
        relatedEntityType: 'Issue',
        relatedEntityId: issueId,
      },
    })

    await writeAuditLog(transaction, {
      data: {
        institutionId,
        departmentId: issue.departmentId,
        actorId: actor.userId,
        actorMembershipId: actor.membershipId,
        action: 'ISSUE_STATUS_CHANGED',
        entityType: 'Issue',
        entityId: issueId,
        metadata: {
          oldStatus: issue.status,
          newStatus: input.status,
          audience: issue.audience,
        },
      },
    })

    return {
      id: issueId,
      status: input.status,
      resolutionSummary: input.status === 'RESOLVED'
        ? input.resolutionSummary
        : issue.resolutionSummary,
      updatedAt: now,
    }
  })
}

async function addIssueNote(
  institutionId,
  issueId,
  actor,
  input,
  { database = getDatabase(), scope = null } = {},
) {
  return database.$transaction(async (transaction) => {
    const issue = await transaction.issue.findFirst({
      where: { id: issueId, institutionId, ...getDepartmentScopeWhere(scope) },
      select: { id: true, departmentId: true, archivedAt: true },
    })
    if (!issue) throw issueNotFound()
    if (issue.archivedAt) {
      throw issueConflict('ISSUE_ARCHIVED', 'Archived issues cannot be changed')
    }

    const note = await transaction.issueNote.create({
      data: {
        institutionId,
        issueId,
        authorId: actor.userId,
        authorMembershipId: actor.membershipId,
        content: input.content,
        visibility: input.visibility,
      },
      select: {
        id: true,
        content: true,
        visibility: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    })

    await writeAuditLog(transaction, {
      data: {
        institutionId,
        departmentId: issue.departmentId,
        actorId: actor.userId,
        actorMembershipId: actor.membershipId,
        action: 'ISSUE_NOTE_CREATED',
        entityType: 'Issue',
        entityId: issueId,
        metadata: { noteId: note.id, visibility: note.visibility },
      },
    })

    return note
  })
}

async function archiveIssue(
  institutionId,
  issueId,
  actor,
  reason,
  { database = getDatabase(), now = new Date(), scope = null } = {},
) {
  return database.$transaction(async (transaction) => {
    const issue = await transaction.issue.findFirst({
      where: { id: issueId, institutionId, ...getDepartmentScopeWhere(scope) },
      select: { id: true, departmentId: true, status: true, archivedAt: true },
    })
    if (!issue) throw issueNotFound()
    if (issue.archivedAt) {
      throw issueConflict('ISSUE_ALREADY_ARCHIVED', 'This issue is already archived')
    }
    if (!['RESOLVED', 'CLOSED'].includes(issue.status)) {
      throw issueConflict(
        'ISSUE_NOT_ARCHIVABLE',
        'Only resolved or closed issues can be archived',
      )
    }

    const changed = await transaction.issue.updateMany({
      where: {
        id: issueId,
        institutionId,
        ...getDepartmentScopeWhere(scope),
        status: issue.status,
        archivedAt: null,
      },
      data: {
        archivedAt: now,
        archivedById: actor.userId,
        archivedByMembershipId: actor.membershipId,
        archiveReason: reason,
      },
    })
    if (changed.count !== 1) {
      throw issueConflict('ISSUE_CHANGED', 'The issue was updated by another user; reload and try again')
    }

    await writeAuditLog(transaction, {
      data: {
        institutionId,
        departmentId: issue.departmentId,
        actorId: actor.userId,
        actorMembershipId: actor.membershipId,
        action: 'ISSUE_ARCHIVED',
        entityType: 'Issue',
        entityId: issueId,
        metadata: { status: issue.status, reason },
      },
    })

    return { id: issueId, archivedAt: now, archiveReason: reason }
  })
}

module.exports = {
  addIssueNote,
  archiveIssue,
  createIssue,
  getIssue,
  listIssues,
  updateIssueStatus,
}
