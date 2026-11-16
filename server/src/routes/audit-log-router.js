const express = require('express')
const {
  requireAuth,
  requireInstitutionAccess,
} = require('../middlewares/auth')
const ApiError = require('../utils/api-error')
const { createAuditLogController } = require('../controllers/audit-log.controller')
const validateRequest = require('../validators/validate-request')
const { auditLogListQuerySchema } = require('../validators/notification.validators')

function requireAuditViewer(req, res, next) {
  if (
    req.auth?.institutionAdministrator ||
    req.auth?.administeredInstitutions?.some(
      ({ id }) => id === req.auth.institutionId,
    ) ||
    (req.auth?.membership?.role === 'AUTHORITY' &&
      req.auth.membership.status === 'ACTIVE' &&
      !req.auth.membership.deletedAt)
  ) {
    return next()
  }
  return next(new ApiError(403, 'ROLE_NOT_AUTHORIZED', 'Only institution administrators and Authorities can view audit logs'))
}

function createAuditLogRouter({
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess({ allowAdministrator: true }),
  authorizeViewer = requireAuditViewer,
  controller = createAuditLogController(),
} = {}) {
  const router = express.Router()
  const authorize = [authenticate, authorizeInstitution, authorizeViewer]

  router.get(
    '/:institutionId',
    ...authorize,
    validateRequest({ query: auditLogListQuerySchema }),
    controller.list,
  )
  router.get(
    '/:institutionId/:auditLogId',
    ...authorize,
    controller.get,
  )

  return router
}

module.exports = createAuditLogRouter
