const express = require('express')
const { createRegistrationController } = require('../controllers/registration.controller')
const { createRateLimiter, ipKey } = require('../middlewares/rate-limit')
const requireCronSecret = require('../middlewares/require-cron-secret')
const validateRequest = require('../validators/validate-request')
const {
  registrationStatusParamsSchema,
  startRegistrationSchema,
} = require('../validators/registration.validators')

function createRegistrationRouter({
  controller = createRegistrationController(),
  authorizeCron = requireCronSecret,
} = {}) {
  const router = express.Router()
  const startIpLimit = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 8,
    keyGenerator: ipKey,
    message: 'Too many registration attempts from this network. Try again later.',
  })
  const startEmailLimit = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.validated.body.contactEmail,
    message: 'Too many registration attempts for this contact email. Try again later.',
  })
  const statusLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: ipKey,
  })

  router.post(
    '/start',
    startIpLimit,
    validateRequest({ body: startRegistrationSchema }),
    startEmailLimit,
    controller.start,
  )
  router.get(
    '/status/:paymentId',
    statusLimit,
    validateRequest({ params: registrationStatusParamsSchema }),
    controller.status,
  )
  router.get('/cleanup-expired', authorizeCron, controller.cleanup)

  return router
}

module.exports = createRegistrationRouter
