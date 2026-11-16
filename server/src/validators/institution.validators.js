const { z } = require('zod')

const institutionRegistrationSchema = z.object({
  institutionName: z.string().trim().min(1).max(200),
  contactPersonName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
  campusType: z.string().trim().min(1).max(100),
  campusSize: z.string().trim().min(1).max(100),
  location: z.string().trim().min(1).max(500),
})

module.exports = { institutionRegistrationSchema }
