const express = require('express')
const { createMemberRegistrationController } = require('../controllers/member-registration.controller')
const validateRequest = require('../validators/validate-request')
const {
  createRegistrationSchema,
  institutionCodeParamsSchema,
} = require('../validators/member-registration.validators')

function createMemberRegistrationRouter({
  role,
  includeInstitutionLookup = false,
  controller = createMemberRegistrationController(),
} = {}) {
  const router = express.Router()

  if (includeInstitutionLookup) {
    router.get(
      '/institutions/:institutionCode/departments',
      validateRequest({ params: institutionCodeParamsSchema }),
      controller.lookup,
    )
  }

  if (role === 'STUDENT') {
    router.post(
      '/register',
      validateRequest({ body: createRegistrationSchema('studentId') }),
      controller.registerStudent,
    )
  }

  if (role === 'TEACHER') {
    router.post(
      '/register',
      validateRequest({ body: createRegistrationSchema('teacherId') }),
      controller.registerTeacher,
    )
  }

  return router
}

module.exports = createMemberRegistrationRouter
