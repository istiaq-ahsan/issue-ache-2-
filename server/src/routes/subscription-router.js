const express = require('express')
const {
  requireAuth,
  requireInstitutionAdministrator,
} = require('../middlewares/auth')
const { createSubscriptionController } = require('../controllers/subscription.controller')
const validateRequest = require('../validators/validate-request')
const { renewSubscriptionSchema } = require('../validators/subscription.validators')

function createSubscriptionRouter({
  authenticate = requireAuth,
  authorizeAdministrator = requireInstitutionAdministrator(),
  controller = createSubscriptionController(),
} = {}) {
  const router = express.Router()
  const authorize = [authenticate, authorizeAdministrator]

  router.get('/current', ...authorize, controller.current)
  router.post(
    '/renew',
    ...authorize,
    validateRequest({ body: renewSubscriptionSchema }),
    controller.renew,
  )

  return router
}

module.exports = createSubscriptionRouter
