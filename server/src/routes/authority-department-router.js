const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAdministrator,
} = require('../middlewares/auth')
const { createAuthorityController } = require('../controllers/authority.controller')
const asyncHandler = require('../utils/async-handler')
const ApiError = require('../utils/api-error')
const validateRequest = require('../validators/validate-request')
const { authorityDepartmentSchema } = require('../validators/authority-department.validators')

function createAuthorityDepartmentRouter({
  authenticate = requireAuth,
  authorizeAdministrator = requireInstitutionAdministrator(),
  requireSubscription = requireActiveSubscription,
  controller = createAuthorityController(),
  database = () => require('../config/prisma'),
} = {}) {
  const router = express.Router()
  const resolveInstitution = asyncHandler(async (req, res, next) => {
    const db = typeof database === 'function' ? database() : database
    const membership = await db.institutionMembership.findFirst({
      where: {
        id: req.params.membershipId,
        role: 'AUTHORITY',
        institution: { adminUserId: req.auth.user.id },
      },
      select: { institutionId: true },
    })
    if (!membership) {
      throw new ApiError(404, 'AUTHORITY_NOT_FOUND', 'Authority account was not found')
    }
    req.params.institutionId = membership.institutionId
    return next()
  })

  router.put(
    '/:membershipId/department',
    authenticate,
    resolveInstitution,
    authorizeAdministrator,
    requireSubscription,
    validateRequest({ body: authorityDepartmentSchema }),
    controller.changeDepartment,
  )

  return router
}

module.exports = createAuthorityDepartmentRouter
