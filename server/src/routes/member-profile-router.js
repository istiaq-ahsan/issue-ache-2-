const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAccess,
  requireRole,
} = require('../middlewares/auth')
const { createMemberProfileController } = require('../controllers/member-profile.controller')
const { createDepartmentChangeController } = require('../controllers/department-change.controller')
const validateRequest = require('../validators/validate-request')
const {
  createDepartmentChangeSchema,
  profileUpdateSchema,
} = require('../validators/member.validators')

function createMemberProfileRouter({
  authenticate = requireAuth,
  authorizeInstitution = requireInstitutionAccess(),
  authorizeMember = requireRole('STUDENT', 'TEACHER'),
  requireSubscription = requireActiveSubscription,
  profileController = createMemberProfileController(),
  departmentChangeController = createDepartmentChangeController(),
} = {}) {
  const router = express.Router()
  const authorize = [authenticate, authorizeInstitution, authorizeMember]
  const authorizeWrite = [...authorize, requireSubscription]

  router.get('/:institutionId/profile', ...authorize, profileController.get)
  router.patch(
    '/:institutionId/profile',
    ...authorizeWrite,
    validateRequest({ body: profileUpdateSchema }),
    profileController.update,
  )
  router.get(
    '/:institutionId/department-change-requests',
    ...authorize,
    departmentChangeController.listMine,
  )
  router.post(
    '/:institutionId/department-change-requests',
    ...authorizeWrite,
    validateRequest({ body: createDepartmentChangeSchema }),
    departmentChangeController.create,
  )
  router.post(
    '/:institutionId/department-change-requests/:requestId/cancel',
    ...authorizeWrite,
    departmentChangeController.cancel,
  )

  return router
}

module.exports = createMemberProfileRouter
