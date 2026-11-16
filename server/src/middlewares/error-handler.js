const { ZodError } = require('zod')
const ApiError = require('../utils/api-error')
const { sendError } = require('../utils/api-response')

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  if (error instanceof ZodError) {
    return sendError(res, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.issues,
    })
  }

  if (error instanceof ApiError) {
    return sendError(res, {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    })
  }

  if (error.status === 400 && error.type === 'entity.parse.failed') {
    return sendError(res, {
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON',
    })
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      JSON.stringify({
        requestId: res.locals.requestId,
        errorName: error.name,
        errorCode: error.code,
      }),
    )
  } else {
    console.error(error)
  }

  return sendError(res, {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  })
}

module.exports = errorHandler
