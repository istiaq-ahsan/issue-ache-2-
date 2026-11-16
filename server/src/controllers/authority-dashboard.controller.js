const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const { getAuthorityDashboard } = require('../services/authority-dashboard.service')

function createAuthorityDashboardController({ getDashboard = getAuthorityDashboard } = {}) {
  return {
    get: asyncHandler(async (req, res) => {
      const dashboard = await getDashboard(
        req.auth.institutionId,
        req.scope,
        undefined,
        req.validated.query.departmentId,
      )
      return sendSuccess(res, dashboard)
    }),
  }
}

module.exports = { createAuthorityDashboardController }
