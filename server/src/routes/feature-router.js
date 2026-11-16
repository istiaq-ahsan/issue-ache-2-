const express = require('express')
const { createFeatureController } = require('../controllers/feature.controller')
const asyncHandler = require('../utils/async-handler')

function createFeatureRouter(featureName) {
  const router = express.Router()

  router.all('/', asyncHandler(createFeatureController(featureName)))

  return router
}

module.exports = createFeatureRouter
