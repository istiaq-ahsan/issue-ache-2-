const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  getBillingSummary,
  startSubscriptionRenewal,
} = require('../services/subscription.service')

function createSubscriptionController({
  getSummary = getBillingSummary,
  renew = startSubscriptionRenewal,
} = {}) {
  return {
    current: asyncHandler(async (req, res) => {
      const summary = await getSummary(req.auth.institutionId)
      return sendSuccess(res, summary)
    }),
    renew: asyncHandler(async (req, res) => {
      const result = await renew(
        req.auth.institutionId,
        req.auth.user.id,
        req.validated.body,
      )
      return sendSuccess(res, result, {
        statusCode: 201,
        message: 'Subscription payment initiated',
      })
    }),
  }
}

module.exports = { createSubscriptionController }
