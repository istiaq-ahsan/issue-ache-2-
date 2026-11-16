const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAdministrator,
} = require('../middlewares/auth')
const { createInstitutionController } = require('../controllers/institution.controller')
const createFeatureRouter = require('./feature-router')
const createAuthorityRouter = require('./authority-router')

function createInstitutionRouter({
  authenticate = requireAuth,
  authorizeAdministrator = requireInstitutionAdministrator(),
  controller = createInstitutionController(),
  authorityRouterOptions = {},
  authorityController,
  requireSubscription = requireActiveSubscription,
} = {}) {
  const router = express.Router()

  router.get('/:institutionId/dashboard', authenticate, authorizeAdministrator, controller.dashboard)
  router.use(
    createAuthorityRouter({
      ...authorityRouterOptions,
      authenticate: authorityRouterOptions.authenticate || authenticate,
      authorizeAdministrator:
        authorityRouterOptions.authorizeAdministrator || authorizeAdministrator,
      requireSubscription:
        authorityRouterOptions.requireSubscription || requireSubscription,
      controller: authorityRouterOptions.controller || authorityController,
    }),
  )
  router.all('/', createFeatureRouter('Institution'))

  return router
}

module.exports = createInstitutionRouter
