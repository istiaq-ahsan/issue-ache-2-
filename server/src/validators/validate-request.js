const ApiError = require('../utils/api-error')

function validateRequest(schema) {
  return function validate(req, res, next) {
    const validated = {}

    for (const segment of ['body', 'params', 'query']) {
      if (!schema[segment]) {
        continue
      }

      const result = schema[segment].safeParse(req[segment])

      if (!result.success) {
        return next(
          new ApiError(
            400,
            'VALIDATION_ERROR',
            'Request validation failed',
            result.error.issues.map(({ path, message, code }) => ({
              path,
              message,
              code,
            })),
          ),
        )
      }

      validated[segment] = result.data
    }

    req.validated = validated
    return next()
  }
}

module.exports = validateRequest
