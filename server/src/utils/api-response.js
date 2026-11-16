function sendSuccess(res, data, { statusCode = 200, message } = {}) {
  const response = {
    success: true,
    data,
    meta: { requestId: res.locals.requestId },
  }

  if (message) {
    response.message = message
  }

  return res.status(statusCode).json(response)
}

function sendError(res, { statusCode, code, message, details }) {
  const response = {
    success: false,
    error: { code, message },
    meta: { requestId: res.locals.requestId },
  }

  if (details !== undefined) {
    response.error.details = details
  }

  return res.status(statusCode).json(response)
}

module.exports = { sendError, sendSuccess }
