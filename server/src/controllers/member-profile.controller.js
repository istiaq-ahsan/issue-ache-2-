const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  getMemberProfile,
  updateMemberProfile,
} = require('../services/member-profile.service')

function createMemberProfileController({
  getProfile = getMemberProfile,
  updateProfile = updateMemberProfile,
} = {}) {
  return {
    get: asyncHandler(async (req, res) => {
      const profile = await getProfile(
        req.auth.institutionId,
        req.auth.membership.id,
      )
      return sendSuccess(res, { profile })
    }),
    update: asyncHandler(async (req, res) => {
      const profile = await updateProfile(
        req.auth.institutionId,
        req.auth.membership.id,
        req.validated.body,
      )
      return sendSuccess(res, { profile }, { message: 'Profile updated' })
    }),
  }
}

module.exports = { createMemberProfileController }
