const ApiError = require('../utils/api-error')
const {
  ensureAuthorityDepartmentInScope,
  getDepartmentScopeWhere,
} = require('../middlewares/authority-scope')

function getDatabase() {
  return require('../config/prisma')
}

function getRecipientOrThrow(notification) {
  if (!notification) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification was not found')
  }
  return notification
}

function serializeNotification(notification) {
  return {
    id: notification.id,
    institutionId: notification.institutionId,
    departmentId: notification.departmentId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  }
}

async function listNotifications(
  institutionId,
  recipientId,
  { unreadOnly = false, limit = 50, cursor, departmentId } = {},
  database = getDatabase(),
  scope = null,
) {
  if (departmentId) ensureAuthorityDepartmentInScope(scope, departmentId)
  const where = {
    institutionId,
    recipientId,
    ...getDepartmentScopeWhere(scope),
    ...(departmentId ? { departmentId } : {}),
    ...(unreadOnly ? { readAt: null } : {}),
  }
  const [notifications, unreadCount] = await Promise.all([
    database.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        institutionId: true,
        departmentId: true,
        type: true,
        title: true,
        message: true,
        relatedEntityType: true,
        relatedEntityId: true,
        readAt: true,
        createdAt: true,
      },
    }),
    database.notification.count({
      where: {
        institutionId,
        recipientId,
        ...getDepartmentScopeWhere(scope),
        ...(departmentId ? { departmentId } : {}),
        readAt: null,
      },
    }),
  ])
  return {
    notifications: notifications.map(serializeNotification),
    unreadCount,
    nextCursor: notifications.length === limit
      ? notifications[notifications.length - 1].id
      : null,
  }
}

async function markNotificationRead(
  institutionId,
  recipientId,
  notificationId,
  { database = getDatabase(), now = new Date(), scope = null, departmentId } = {},
) {
  if (departmentId) ensureAuthorityDepartmentInScope(scope, departmentId)
  const result = await database.notification.updateMany({
    where: {
      id: notificationId,
      institutionId,
      recipientId,
      ...getDepartmentScopeWhere(scope),
      ...(departmentId ? { departmentId } : {}),
      readAt: null,
    },
    data: { readAt: now },
  })
  if (result.count === 0) {
    const existing = await database.notification.findFirst({
      where: {
        id: notificationId,
        institutionId,
        recipientId,
        ...getDepartmentScopeWhere(scope),
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        institutionId: true,
        departmentId: true,
        type: true,
        title: true,
        message: true,
        relatedEntityType: true,
        relatedEntityId: true,
        readAt: true,
        createdAt: true,
      },
    })
    return serializeNotification(getRecipientOrThrow(existing))
  }

  const notification = await database.notification.findFirst({
    where: {
      id: notificationId,
      institutionId,
      recipientId,
      ...getDepartmentScopeWhere(scope),
      ...(departmentId ? { departmentId } : {}),
    },
    select: {
      id: true,
      institutionId: true,
      departmentId: true,
      type: true,
      title: true,
      message: true,
      relatedEntityType: true,
      relatedEntityId: true,
      readAt: true,
      createdAt: true,
    },
  })
  return serializeNotification(getRecipientOrThrow(notification))
}

async function markAllNotificationsRead(
  institutionId,
  recipientId,
  { database = getDatabase(), now = new Date(), scope = null, departmentId } = {},
) {
  if (departmentId) ensureAuthorityDepartmentInScope(scope, departmentId)
  const result = await database.notification.updateMany({
    where: {
      institutionId,
      recipientId,
      ...getDepartmentScopeWhere(scope),
      ...(departmentId ? { departmentId } : {}),
      readAt: null,
    },
    data: { readAt: now },
  })
  return { markedRead: result.count, readAt: now }
}

module.exports = {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
}
