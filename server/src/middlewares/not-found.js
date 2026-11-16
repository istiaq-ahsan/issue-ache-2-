const ApiError = require('../utils/api-error')

function notFoundHandler(req, res, next) {
  next(
    new ApiError(
      404,
      'ROUTE_NOT_FOUND',
      `No route found for ${req.method} ${req.path}`,
    ),
  )
}

module.exports = { notFoundHandler }
