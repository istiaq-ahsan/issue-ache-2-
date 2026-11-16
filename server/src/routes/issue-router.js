const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAccess,
  requireRole,
} = require('../middlewares/auth')
const { createIssueController } = require('../controllers/issue.controller')
const validateRequest = require('../validators/validate-request')
const {
  archiveIssueSchema,
  createIssueSchema,
  issueListQuerySchema,
  issueNoteSchema,
  issueStatusUpdateSchema,
} = require('../validators/issue.validators')

function createIssueRouter({
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess(),
  authorizeViewer = requireRole('STUDENT', 'TEACHER', 'AUTHORITY'),
  authorizeReporter = requireRole('STUDENT', 'TEACHER'),
  authorizeAuthority = requireRole('AUTHORITY'),
  requireSubscription = requireActiveSubscription,
  controller = createIssueController(),
} = {}) {
  const router = express.Router()
  const institutionAccess = [authenticate, authorizeInstitution]
  const activeSubscription = [requireSubscription]

  router.get(
    '/:institutionId',
    ...institutionAccess,
    authorizeViewer,
    validateRequest({ query: issueListQuerySchema }),
    controller.list,
  )
  router.post(
    '/:institutionId',
    ...institutionAccess,
    authorizeReporter,
    ...activeSubscription,
    validateRequest({ body: createIssueSchema }),
    controller.create,
  )
  router.get(
    '/:institutionId/:issueId',
    ...institutionAccess,
    authorizeViewer,
    controller.get,
  )
  router.patch(
    '/:institutionId/:issueId/status',
    ...institutionAccess,
    authorizeAuthority,
    ...activeSubscription,
    validateRequest({ body: issueStatusUpdateSchema }),
    controller.updateStatus,
  )
  router.post(
    '/:institutionId/:issueId/notes',
    ...institutionAccess,
    authorizeAuthority,
    ...activeSubscription,
    validateRequest({ body: issueNoteSchema }),
    controller.addNote,
  )
  router.post(
    '/:institutionId/:issueId/archive',
    ...institutionAccess,
    authorizeAuthority,
    ...activeSubscription,
    validateRequest({ body: archiveIssueSchema }),
    controller.archive,
  )

  return router
}

module.exports = createIssueRouter
