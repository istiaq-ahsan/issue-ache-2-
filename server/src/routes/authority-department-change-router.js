const express = require('express')
const {
  requireAuth,
  requireActiveSubscription,
  requireInstitutionAccess,
  requireRole,
} = require('../middlewares/auth')
const { createDepartmentChangeController } = require('../controllers/department-change.controller')
const { attachAuthorityScope } = require('../middlewares/authority-scope')
const validateRequest = require('../validators/validate-request')
const {
  departmentChangeDecisionSchema,
  departmentChangeListQuerySchema,
} = require('../validators/member.validators')

function createAuthorityDepartmentChangeRouter({
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess(),
  authorizeAuthority = requireRole('AUTHORITY'),
  requireSubscription = requireActiveSubscription,
  attachScope = attachAuthorityScope(),
  controller = createDepartmentChangeController(),
} = {}) {
  const router = express.Router()
  const authorize = [authenticate, authorizeInstitution, authorizeAuthority, attachScope]

  router.get(
    '/institutions/:institutionId/department-change-requests',
    ...authorize,
    validateRequest({ query: departmentChangeListQuerySchema }),
    controller.listAuthority,
  )
  router.get(
    '/institutions/:institutionId/department-change-requests/:requestId',
    ...authorize,
    controller.getAuthority,
  )
  router.post(
    '/institutions/:institutionId/department-change-requests/:requestId/decision',
    ...authorize,
    requireSubscription,
    validateRequest({ body: departmentChangeDecisionSchema }),
    controller.decide,
  )

  return router
}

module.exports = createAuthorityDepartmentChangeRouter
