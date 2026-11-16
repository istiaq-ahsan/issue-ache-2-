const express = require('express')
const { createPaymentController } = require('../controllers/payment.controller')
const { createRateLimiter, ipKey } = require('../middlewares/rate-limit')
const validateRequest = require('../validators/validate-request')
const { paymentIdParamsSchema, providerCallbackSchema } = require('../validators/payment.validators')

function createPaymentRouter({ controller = createPaymentController() } = {}) {
  const router = express.Router()
  const callbackLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: ipKey,
  })
  const ipnLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 120,
    keyGenerator: ipKey,
  })

  router.post(
    '/ipn',
    ipnLimit,
    validateRequest({ body: providerCallbackSchema }),
    controller.ipn,
  )
  router.post(
    '/:id/callback',
    callbackLimit,
    validateRequest({ params: paymentIdParamsSchema, body: providerCallbackSchema }),
    controller.callback,
  )

  return router
}

module.exports = createPaymentRouter
