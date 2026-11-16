const express = require('express')
const { createRateLimiter, ipKey } = require('../middlewares/rate-limit')
const { createRegistrationController } = require('../controllers/registration.controller')

function createPlansRouter({ controller = createRegistrationController() } = {}) {
  const router = express.Router()
  const limit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: ipKey,
  })

  router.get('/', limit, controller.plans)
  return router
}

module.exports = createPlansRouter
