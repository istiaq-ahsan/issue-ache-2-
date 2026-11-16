const express = require('express')
const { requireAuth } = require('../middlewares/auth')
const { sendSuccess } = require('../utils/api-response')
const createFeatureRouter = require('./feature-router')

function createAuthRouter({ authenticate = requireAuth } = {}) {
  const router = express.Router()

  router.get('/me', authenticate, (req, res) =>
    sendSuccess(res, {
      user: {
        id: req.auth.user.id,
        email: req.auth.user.email,
        name: req.auth.user.name,
        phone: req.auth.user.phone,
      },
      memberships: req.auth.memberships,
      administeredInstitutions: req.auth.administeredInstitutions,
    }),
  )
  router.use('/', createFeatureRouter('Authentication'))

  return router
}

module.exports = createAuthRouter
