const { z } = require('zod')

const startRegistrationSchema = z.object({
  planCode: z.enum(['BASIC', 'PRO']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  institutionName: z.string().trim().min(1).max(200),
  contactPersonName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  campusType: z.string().trim().min(1).max(100),
  campusSize: z.string().trim().min(1).max(100),
  location: z.string().trim().min(1).max(500),
  adminName: z.string().trim().min(1).max(200),
  adminEmail: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  startTrial: z.boolean().default(false),
}).strict().superRefine((input, context) => {
  if (input.startTrial && input.planCode !== 'BASIC') {
    context.addIssue({
      code: 'custom',
      path: ['startTrial'],
      message: 'Only the Basic plan can start a trial',
    })
  }
})

const registrationStatusParamsSchema = z.object({
  paymentId: z.string().trim().min(1).max(128),
})

module.exports = { startRegistrationSchema, registrationStatusParamsSchema }
