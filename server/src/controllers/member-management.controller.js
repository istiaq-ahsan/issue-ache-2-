const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  getDepartmentMember,
  listDepartmentMembers,
  setDepartmentMemberEnabled,
} = require('../services/member-management.service')

function createMemberManagementController({ role, list = listDepartmentMembers, get = getDepartmentMember, setEnabled = setDepartmentMemberEnabled } = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const members = await list(
        req.auth.institutionId,
        role,
        req.scope,
        undefined,
        req.validated.query.departmentId,
      )
      return sendSuccess(res, { members })
    }),
    get: asyncHandler(async (req, res) => {
      const member = await get(
        req.auth.institutionId,
        role,
        req.params.membershipId,
        req.scope,
      )
      return sendSuccess(res, { member })
    }),
    setEnabled: asyncHandler(async (req, res) => {
      const membership = await setEnabled(
        req.auth.institutionId,
        role,
        req.params.membershipId,
        req.validated.body.enabled,
        { userId: req.auth.user.id, membershipId: req.auth.membership.id },
        req.scope,
      )
      return sendSuccess(res, { membership }, {
        message: `${role === 'STUDENT' ? 'Student' : 'Teacher'} ${req.validated.body.enabled ? 'activated' : 'deactivated'}`,
      })
    }),
  }
}

module.exports = { createMemberManagementController }
