const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAdministrator,
} = require('../middlewares/auth')
const { createAuthorityController } = require('../controllers/authority.controller')
const validateRequest = require('../validators/validate-request')
const {
  authorityCreationSchema,
  authorityStatusSchema,
  authorityUpdateSchema,
} = require('../validators/authority.validators')

function createAuthorityRouter({
  authenticate = requireAuth,
  authorizeAdministrator = requireInstitutionAdministrator(),
  requireSubscription = requireActiveSubscription,
  controller = createAuthorityController(),
} = {}) {
  const router = express.Router()

  router.get('/:institutionId/authorities', authenticate, authorizeAdministrator, controller.list)
  router.post(
    '/:institutionId/authorities',
    authenticate,
    authorizeAdministrator,
    requireSubscription,
    validateRequest({ body: authorityCreationSchema }),
    controller.create,
  )
  router.patch(
    '/:institutionId/authorities/:membershipId',
    authenticate,
    authorizeAdministrator,
    requireSubscription,
    validateRequest({ body: authorityUpdateSchema }),
    controller.update,
  )
  router.patch(
    '/:institutionId/authorities/:membershipId/status',
    authenticate,
    authorizeAdministrator,
    requireSubscription,
    validateRequest({ body: authorityStatusSchema }),
    controller.setEnabled,
  )
  router.delete(
    '/:institutionId/authorities/:membershipId',
    authenticate,
    authorizeAdministrator,
    requireSubscription,
    controller.remove,
  )

  return router
}

module.exports = createAuthorityRouter
