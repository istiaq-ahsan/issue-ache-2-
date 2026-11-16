const featureService = require('../services/feature.service')

function createFeatureController(featureName) {
  return function handleFeatureRequest() {
    return featureService.ensureFeatureImplemented(featureName)
  }
}

module.exports = { createFeatureController }
