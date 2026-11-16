const express = require('express')
const {
  requireActiveSubscription,
  requireAuth,
  requireInstitutionAdministrator,
} = require('../middlewares/auth')
const { createDepartmentController } = require('../controllers/department.controller')
const validateRequest = require('../validators/validate-request')
const {
  createDepartmentSchema,
  departmentIdParamsSchema,
  updateDepartmentSchema,
} = require('../validators/department.validators')

function createDepartmentRouter({
  authenticate = requireAuth,
  authorizeAdministrator = requireInstitutionAdministrator(),
  requireSubscription = requireActiveSubscription,
  controller = createDepartmentController(),
} = {}) {
  const router = express.Router()

  router.get('/:institutionId/departments', authenticate, authorizeAdministrator, controller.list)
  router.post(
    '/:institutionId/departments',
    authenticate,
    authorizeAdministrator,
    requireSubscription,
    validateRequest({ body: createDepartmentSchema }),
    controller.create,
  )
  router.get(
    '/:institutionId/departments/:departmentId',
    authenticate,
    authorizeAdministrator,
    validateRequest({ params: departmentIdParamsSchema }),
    controller.details,
  )
  router.patch(
    '/:institutionId/departments/:departmentId',
    authenticate,
    authorizeAdministrator,
    requireSubscription,
    validateRequest({ params: departmentIdParamsSchema, body: updateDepartmentSchema }),
    controller.update,
  )
  router.delete(
    '/:institutionId/departments/:departmentId',
    authenticate,
    authorizeAdministrator,
    requireSubscription,
    validateRequest({ params: departmentIdParamsSchema }),
    controller.remove,
  )
  return router
}

module.exports = createDepartmentRouter
