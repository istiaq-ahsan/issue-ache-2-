const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  cancelMemberDepartmentChange,
  createDepartmentChangeRequest,
  decideDepartmentChange,
  getAuthorityDepartmentChange,
  listAuthorityDepartmentChanges,
  listMemberDepartmentChanges,
} = require('../services/department-change.service')

function createDepartmentChangeController({
  create = createDepartmentChangeRequest,
  listMine = listMemberDepartmentChanges,
  cancel = cancelMemberDepartmentChange,
  listAuthority = listAuthorityDepartmentChanges,
  getAuthority = getAuthorityDepartmentChange,
  decide = decideDepartmentChange,
} = {}) {
  return {
    create: asyncHandler(async (req, res) => {
      const request = await create(
        req.auth.institutionId,
        req.auth.membership.id,
        req.auth.user.id,
        req.validated.body,
      )
      return sendSuccess(res, { request }, {
        statusCode: 201,
        message: 'Department change request submitted',
      })
    }),
    listMine: asyncHandler(async (req, res) => {
      const requests = await listMine(
        req.auth.institutionId,
        req.auth.membership.id,
      )
      return sendSuccess(res, { requests })
    }),
    cancel: asyncHandler(async (req, res) => {
      const request = await cancel(
        req.auth.institutionId,
        req.auth.membership.id,
        req.auth.user.id,
        req.params.requestId,
      )
      return sendSuccess(res, { request }, { message: 'Request cancelled' })
    }),
    listAuthority: asyncHandler(async (req, res) => {
      const requests = await listAuthority(
        req.auth.institutionId,
        req.validated.query,
      )
      return sendSuccess(res, { requests })
    }),
    getAuthority: asyncHandler(async (req, res) => {
      const request = await getAuthority(
        req.auth.institutionId,
        req.params.requestId,
      )
      return sendSuccess(res, { request })
    }),
    decide: asyncHandler(async (req, res) => {
      const request = await decide(
        req.auth.institutionId,
        req.params.requestId,
        { userId: req.auth.user.id, membershipId: req.auth.membership.id },
        req.validated.body.decision,
      )
      return sendSuccess(res, { request }, {
        message: `Department change request ${request.status.toLowerCase()}`,
      })
    }),
  }
}

module.exports = { createDepartmentChangeController }
