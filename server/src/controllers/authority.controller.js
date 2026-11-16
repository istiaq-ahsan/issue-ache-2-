const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  createAuthority,
  deleteAuthority,
  listAuthorities,
  setAuthorityEnabled,
  updateAuthority,
} = require('../services/authority.service')

function createAuthorityController({
  create = createAuthority,
  list = listAuthorities,
  update = updateAuthority,
  setEnabled = setAuthorityEnabled,
  remove = deleteAuthority,
} = {}) {
  return {
    create: asyncHandler(async (req, res) => {
      const authority = await create(
        req.validated.body,
        req.auth.institutionId,
        req.auth.user.id,
      )
      return sendSuccess(res, { authority }, {
        statusCode: 201,
        message: 'Authority account created',
      })
    }),
    list: asyncHandler(async (req, res) => {
      const authorities = await list(req.auth.institutionId)
      return sendSuccess(res, { authorities })
    }),
    update: asyncHandler(async (req, res) => {
      const authority = await update(
        req.auth.institutionId,
        req.params.membershipId,
        req.validated.body,
        req.auth.user.id,
      )
      return sendSuccess(res, { authority }, { message: 'Authority account updated' })
    }),
    setEnabled: asyncHandler(async (req, res) => {
      const result = await setEnabled(
        req.auth.institutionId,
        req.params.membershipId,
        req.validated.body.enabled,
        req.auth.user.id,
      )
      return sendSuccess(res, result, {
        message: result.warning || `Authority account ${req.validated.body.enabled ? 'enabled' : 'disabled'}`,
      })
    }),
    remove: asyncHandler(async (req, res) => {
      const result = await remove(
        req.auth.institutionId,
        req.params.membershipId,
        req.auth.user.id,
      )
      return sendSuccess(res, result, {
        message: result.warning || 'Authority account deleted',
      })
    }),
  }
}

module.exports = { createAuthorityController }
