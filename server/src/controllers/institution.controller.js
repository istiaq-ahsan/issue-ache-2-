const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const { getInstitutionDashboard } = require('../services/institution.service')

function createInstitutionController({
  getDashboard = getInstitutionDashboard,
} = {}) {
  return {
    dashboard: asyncHandler(async (req, res) => {
      const dashboard = await getDashboard(
        req.auth.institutionId,
        req.auth.institution,
      )
      return sendSuccess(res, dashboard)
    }),
  }
}

module.exports = { createInstitutionController }
