const ApiError = require('../utils/api-error')
const {
  ensureAuthorityDepartmentInScope,
  getDepartmentScopeWhere,
} = require('../middlewares/authority-scope')

function getDatabase() {
  return require('../config/prisma')
}

const SECRET_KEY = /(password|secret|token|credential|private.?key|service.?account|firebaseuid)/i

function redactSensitiveMetadata(value) {
  if (Array.isArray(value)) return value.map(redactSensitiveMetadata)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, nested]) => [key, redactSensitiveMetadata(nested)]),
  )
}

function serializeAuditLog(entry) {
  return {
    id: entry.id,
    institutionId: entry.institutionId,
    departmentId: entry.departmentId,
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: redactSensitiveMetadata(entry.metadata),
    createdAt: entry.createdAt,
  }
}

async function listAuditLogs(
  institutionId,
  filters = {},
  database = getDatabase(),
  scope = null,
) {
  if (filters.departmentId) ensureAuthorityDepartmentInScope(scope, filters.departmentId)
  const where = {
    institutionId,
    ...getDepartmentScopeWhere(scope),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.action ? { action: { contains: filters.action, mode: 'insensitive' } } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
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
  }
  const [entries, total] = await Promise.all([
    database.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filters.limit || 50,
      skip: filters.offset || 0,
      select: {
        id: true,
        institutionId: true,
        departmentId: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
    }),
    database.auditLog.count({ where }),
  ])
  return {
    auditLogs: entries.map(serializeAuditLog),
    total,
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  }
}

async function getAuditLog(
  institutionId,
  auditLogId,
  database = getDatabase(),
  scope = null,
) {
  const entry = await database.auditLog.findFirst({
    where: { id: auditLogId, institutionId, ...getDepartmentScopeWhere(scope) },
    select: {
      id: true,
      institutionId: true,
      departmentId: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
  })
  if (!entry) {
    throw new ApiError(404, 'AUDIT_LOG_NOT_FOUND', 'Audit log entry was not found')
  }
  return serializeAuditLog(entry)
}

module.exports = { getAuditLog, listAuditLogs, redactSensitiveMetadata }
