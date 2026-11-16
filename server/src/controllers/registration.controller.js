const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const { listPlans } = require('../config/plans')
const {
  cleanupExpiredIntents,
  getRegistrationStatus,
  startRegistration,
} = require('../services/registration.service')

function createRegistrationController({
  start = startRegistration,
  getStatus = getRegistrationStatus,
  cleanup = cleanupExpiredIntents,
} = {}) {
  return {
    plans: asyncHandler(async (req, res) => {
      return sendSuccess(res, { plans: listPlans() })
    }),
    start: asyncHandler(async (req, res) => {
      const result = await start(req.validated.body)
      return sendSuccess(res, result, {
        statusCode: 201,
        message: result.paymentId
          ? 'Registration payment initiated'
          : 'Institution trial started',
      })
    }),
    status: asyncHandler(async (req, res) => {
      const status = await getStatus(req.validated.params.paymentId)
      return sendSuccess(res, status)
    }),
    cleanup: asyncHandler(async (req, res) => {
      const result = await cleanup()
      return sendSuccess(res, result, { message: 'Expired registrations cleaned up' })
    }),
  }
}

module.exports = { createRegistrationController }
