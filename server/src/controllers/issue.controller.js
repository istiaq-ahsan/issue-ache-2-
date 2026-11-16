const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  addIssueNote,
  archiveIssue,
  createIssue,
  getIssue,
  listIssues,
  updateIssueStatus,
} = require('../services/issue.service')

function createIssueController({
  create = createIssue,
  list = listIssues,
  get = getIssue,
  updateStatus = updateIssueStatus,
  addNote = addIssueNote,
  archive = archiveIssue,
} = {}) {
  return {
    create: asyncHandler(async (req, res) => {
      const issue = await create(
        req.auth.institutionId,
        req.auth.membership,
        req.auth.user.id,
        req.validated.body,
      )
      return sendSuccess(res, { issue }, {
        statusCode: 201,
        message: 'Issue reported',
      })
    }),
    list: asyncHandler(async (req, res) => {
      const issues = await list(
        req.auth.institutionId,
        req.auth.membership.role,
        req.validated.query,
      )
      return sendSuccess(res, { issues })
    }),
    get: asyncHandler(async (req, res) => {
      const issue = await get(
        req.auth.institutionId,
        req.params.issueId,
        req.auth.membership.role,
      )
      return sendSuccess(res, { issue })
    }),
    updateStatus: asyncHandler(async (req, res) => {
      const issue = await updateStatus(
        req.auth.institutionId,
        req.params.issueId,
        { userId: req.auth.user.id, membershipId: req.auth.membership.id },
        req.validated.body,
      )
      return sendSuccess(res, { issue }, { message: 'Issue status updated' })
    }),
    addNote: asyncHandler(async (req, res) => {
      const note = await addNote(
        req.auth.institutionId,
        req.params.issueId,
        { userId: req.auth.user.id, membershipId: req.auth.membership.id },
        req.validated.body,
      )
      return sendSuccess(res, { note }, {
        statusCode: 201,
        message: 'Issue note added',
      })
    }),
    archive: asyncHandler(async (req, res) => {
      const issue = await archive(
        req.auth.institutionId,
        req.params.issueId,
        { userId: req.auth.user.id, membershipId: req.auth.membership.id },
        req.validated.body.reason,
      )
      return sendSuccess(res, { issue }, { message: 'Issue archived' })
    }),
  }
}

module.exports = { createIssueController }
