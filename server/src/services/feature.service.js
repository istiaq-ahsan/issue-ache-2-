const ApiError = require('../utils/api-error')

function ensureFeatureImplemented(featureName) {
  throw new ApiError(
    501,
    'FEATURE_NOT_IMPLEMENTED',
    `${featureName} endpoints are not implemented yet`,
  )
}

module.exports = { ensureFeatureImplemented }
