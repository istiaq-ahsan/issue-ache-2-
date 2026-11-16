const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  getAuditLog,
  listAuditLogs,
} = require('../services/audit-log.service')

function createAuditLogController({
  list = listAuditLogs,
  get = getAuditLog,
} = {}) {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await list(
        req.auth.institutionId,
        req.validated.query,
      )
      return sendSuccess(res, result)
    }),
    get: asyncHandler(async (req, res) => {
      const auditLog = await get(req.auth.institutionId, req.params.auditLogId)
      return sendSuccess(res, { auditLog })
    }),
  }
}

module.exports = { createAuditLogController }
