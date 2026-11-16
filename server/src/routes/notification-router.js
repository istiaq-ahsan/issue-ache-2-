const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAccess,
} = require('../middlewares/auth')
const { createNotificationController } = require('../controllers/notification.controller')
const validateRequest = require('../validators/validate-request')
const { notificationListQuerySchema } = require('../validators/notification.validators')

function createNotificationRouter({
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess({ allowAdministrator: true }),
  requireSubscription = requireActiveSubscription,
  controller = createNotificationController(),
} = {}) {
  const router = express.Router()
  const authorize = [authenticate, authorizeInstitution]

  router.get(
    '/:institutionId',
    ...authorize,
    validateRequest({ query: notificationListQuerySchema }),
    controller.list,
  )
  router.patch(
    '/:institutionId/read-all',
    ...authorize,
    requireSubscription,
    controller.markAllRead,
  )
  router.patch(
    '/:institutionId/:notificationId/read',
    ...authorize,
    requireSubscription,
    controller.markRead,
  )

  return router
}

module.exports = createNotificationRouter
