const asyncHandler = require('../utils/async-handler')
const { sendSuccess } = require('../utils/api-response')
const {
  getPendingRegistration,
  listPendingRegistrations,
  lookupInstitutionDepartments,
  registerStudent,
  registerTeacher,
  decideRegistration,
} = require('../services/member-registration.service')

function createMemberRegistrationController({
  lookup = lookupInstitutionDepartments,
  createStudent = registerStudent,
  createTeacher = registerTeacher,
  listPending = listPendingRegistrations,
  getPending = getPendingRegistration,
  decide = decideRegistration,
} = {}) {
  return {
    lookup: asyncHandler(async (req, res) => {
      const result = await lookup(req.validated.params.institutionCode)
      return sendSuccess(res, {
        institution: result.institution,
        departments: result.departments,
      })
    }),
    registerStudent: asyncHandler(async (req, res) => {
      const registration = await createStudent(req.validated.body)
      return sendSuccess(res, { registration }, {
        statusCode: 201,
        message: 'Student registration submitted for Authority approval',
      })
    }),
    registerTeacher: asyncHandler(async (req, res) => {
      const registration = await createTeacher(req.validated.body)
      return sendSuccess(res, { registration }, {
        statusCode: 201,
        message: 'Teacher registration submitted for Authority approval',
      })
    }),
    listPending: asyncHandler(async (req, res) => {
      const registrations = await listPending(
        req.auth.institutionId,
        req.validated.query.role,
      )
      return sendSuccess(res, { registrations })
    }),
    getPending: asyncHandler(async (req, res) => {
      const registration = await getPending(
        req.auth.institutionId,
        req.params.membershipId,
      )
      return sendSuccess(res, { registration })
    }),
    decide: asyncHandler(async (req, res) => {
      const result = await decide(
        req.auth.institutionId,
        req.params.membershipId,
        {
          userId: req.auth.user.id,
          membershipId: req.auth.membership.id,
        },
        req.validated.body.decision,
      )
      return sendSuccess(res, { registration: result }, {
        message: `Registration ${result.decision.toLowerCase()}`,
      })
    }),
  }
}

module.exports = { createMemberRegistrationController }
