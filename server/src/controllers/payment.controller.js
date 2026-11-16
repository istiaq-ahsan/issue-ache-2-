const ApiError = require('../utils/api-error')
const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const { processPaymentCallback } = require('../services/registration.service')

function createPaymentController({ processCallback = processPaymentCallback } = {}) {
  return {
    callback: asyncHandler(async (req, res) => {
      const result = await processCallback(
        req.validated.params.id,
        req.validated.body,
      )
      return sendSuccess(res, result)
    }),
    ipn: asyncHandler(async () => {
      throw new ApiError(
        501,
        'SSLCOMMERZ_IPN_NOT_IMPLEMENTED',
        'SSLCommerz IPN processing is not implemented yet',
      )
    }),
  }
}

module.exports = { createPaymentController }
