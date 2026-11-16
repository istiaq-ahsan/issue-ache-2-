const express = require('express')
const {
  requireAuth,
  requireInstitutionAccess,
  requireRole,
} = require('../middlewares/auth')
const { attachAuthorityScope } = require('../middlewares/authority-scope')
const { createAuthorityDashboardController } = require('../controllers/authority-dashboard.controller')
const validateRequest = require('../validators/validate-request')
const { authorityDashboardQuerySchema } = require('../validators/authority-dashboard.validators')

function createAuthorityDashboardRouter({
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess(),
  authorizeAuthority = requireRole('AUTHORITY'),
  attachScope = attachAuthorityScope(),
  controller = createAuthorityDashboardController(),
} = {}) {
  const router = express.Router()
  router.get(
    '/institutions/:institutionId/dashboard',
    authenticate,
    authorizeInstitution,
    authorizeAuthority,
    attachScope,
    validateRequest({ query: authorityDashboardQuerySchema }),
    controller.get,
  )
  return router
}

module.exports = createAuthorityDashboardRouter
