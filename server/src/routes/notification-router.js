const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAccess,
} = require('../middlewares/auth')
const { createNotificationController } = require('../controllers/notification.controller')
const validateRequest = require('../validators/validate-request')
const { notificationListQuerySchema } = require('../validators/notification.validators')
const { attachAuthorityScope } = require('../middlewares/authority-scope')

function createNotificationRouter({
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess({ allowAdministrator: true }),
  requireSubscription = requireActiveSubscription,
  attachScope = attachAuthorityScope(),
  controller = createNotificationController(),
} = {}) {
  const router = express.Router()
  const authorize = [authenticate, authorizeInstitution, attachScope]

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
    validateRequest({ query: notificationListQuerySchema }),
    controller.markAllRead,
  )
  router.patch(
    '/:institutionId/:notificationId/read',
    ...authorize,
    requireSubscription,
    validateRequest({ query: notificationListQuerySchema }),
    controller.markRead,
  )

  return router
}

module.exports = createNotificationRouter
