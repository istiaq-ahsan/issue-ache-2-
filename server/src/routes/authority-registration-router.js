const express = require('express')
const {
  requireAuth,
  requireActiveSubscription,
  requireInstitutionAccess,
  requireRole,
} = require('../middlewares/auth')
const { createMemberRegistrationController } = require('../controllers/member-registration.controller')
const validateRequest = require('../validators/validate-request')
const {
  registrationDecisionSchema,
  registrationListQuerySchema,
} = require('../validators/member-registration.validators')

function createAuthorityRegistrationRouter({
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess(),
  authorizeAuthority = requireRole('AUTHORITY'),
  requireSubscription = requireActiveSubscription,
  controller = createMemberRegistrationController(),
} = {}) {
  const router = express.Router()
  const authorize = [authenticate, authorizeInstitution, authorizeAuthority]

  router.get(
    '/institutions/:institutionId/pending-registrations',
    ...authorize,
    validateRequest({ query: registrationListQuerySchema }),
    controller.listPending,
  )
  router.get(
    '/institutions/:institutionId/pending-registrations/:membershipId',
    ...authorize,
    controller.getPending,
  )
  router.post(
    '/institutions/:institutionId/pending-registrations/:membershipId/decision',
    ...authorize,
    requireSubscription,
    validateRequest({ body: registrationDecisionSchema }),
    controller.decide,
  )

  return router
}

module.exports = createAuthorityRegistrationRouter
