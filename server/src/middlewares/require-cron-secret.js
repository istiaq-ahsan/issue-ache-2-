const { timingSafeEqual } = require('node:crypto')
const env = require('../config/env')
const ApiError = require('../utils/api-error')

function requireCronSecret(req, res, next) {
  if (!env.CRON_SECRET) {
    return next(
      new ApiError(
        503,
        'CRON_SECRET_NOT_CONFIGURED',
        'The registration cleanup job is not configured',
      ),
    )
  }

  const authorization = req.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const provided = match?.[1] || ''
  const expectedBuffer = Buffer.from(env.CRON_SECRET)
  const providedBuffer = Buffer.from(provided)

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return next(new ApiError(401, 'CRON_AUTHENTICATION_REQUIRED', 'A valid cron secret is required'))
  }

  return next()
}

module.exports = requireCronSecret
