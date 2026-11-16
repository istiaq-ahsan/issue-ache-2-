const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAccess,
  requireRole,
} = require('../middlewares/auth')
const { attachAuthorityScope } = require('../middlewares/authority-scope')
const { createMemberManagementController } = require('../controllers/member-management.controller')
const validateRequest = require('../validators/validate-request')
const {
  memberListQuerySchema,
  memberStatusSchema,
} = require('../validators/member-management.validators')

function createAuthorityMemberRouter({
  role,
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess(),
  authorizeAuthority = requireRole('AUTHORITY'),
  attachScope = attachAuthorityScope(),
  requireSubscription = requireActiveSubscription,
  controller = createMemberManagementController({ role }),
} = {}) {
  if (!['STUDENT', 'TEACHER'].includes(role)) {
    throw new TypeError('Authority member routes require STUDENT or TEACHER role')
  }

  const router = express.Router()
  const authorize = [authenticate, authorizeInstitution, authorizeAuthority, attachScope]
  const resource = role === 'STUDENT' ? 'students' : 'teachers'

  router.get(
    `/institutions/:institutionId/${resource}`,
    ...authorize,
    validateRequest({ query: memberListQuerySchema }),
    controller.list,
  )
  router.get(
    `/institutions/:institutionId/${resource}/:membershipId`,
    ...authorize,
    controller.get,
  )
  router.patch(
    `/institutions/:institutionId/${resource}/:membershipId/status`,
    ...authorize,
    requireSubscription,
    validateRequest({ body: memberStatusSchema }),
    controller.setEnabled,
  )

  return router
}

module.exports = createAuthorityMemberRouter
