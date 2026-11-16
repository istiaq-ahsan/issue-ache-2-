const { z } = require('zod')

function createRegistrationSchema(officialIdField) {
  return z.object({
    institutionCode: z.string().trim().min(1).max(64).transform((value) => value.toUpperCase()),
    [officialIdField]: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
    phone: z.string().trim().min(1).max(40),
    departmentId: z.string().trim().min(1).max(128),
    password: z.string().min(8).max(128),
  })
}

const institutionCodeParamsSchema = z.object({
  institutionCode: z.string().trim().min(1).max(64).transform((value) => value.toUpperCase()),
})

const registrationDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
})

const registrationListQuerySchema = z.object({
  role: z.enum(['STUDENT', 'TEACHER']).optional(),
})

module.exports = {
  createRegistrationSchema,
  institutionCodeParamsSchema,
  registrationDecisionSchema,
  registrationListQuerySchema,
}
