const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require('../services/notification.service')

function createNotificationController({
  list = listNotifications,
  markRead = markNotificationRead,
  markAllRead = markAllNotificationsRead,
} = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await list(
        req.auth.institutionId,
        req.auth.user.id,
        {
          ...req.validated.query,
          unreadOnly: req.validated.query.unreadOnly === 'true',
        },
        undefined,
        req.scope,
      )
      return sendSuccess(res, result)
    }),
    markRead: asyncHandler(async (req, res) => {
      const notification = await markRead(
        req.auth.institutionId,
        req.auth.user.id,
        req.params.notificationId,
        { scope: req.scope, departmentId: req.validated.query.departmentId },
      )
      return sendSuccess(res, { notification }, { message: 'Notification marked as read' })
    }),
    markAllRead: asyncHandler(async (req, res) => {
      const result = await markAllRead(
        req.auth.institutionId,
        req.auth.user.id,
        { scope: req.scope, departmentId: req.validated.query.departmentId },
      )
      return sendSuccess(res, result, { message: 'All notifications marked as read' })
    }),
  }
}

module.exports = { createNotificationController }
