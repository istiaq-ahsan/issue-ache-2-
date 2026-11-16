const { z } = require('zod')

const authorityCreationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
  departmentIds: z.array(z.string().trim().min(1).max(128)).min(1),
}).strict()

const authorityUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((email) => email.toLowerCase())
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one account field must be provided',
  })

const authorityStatusSchema = z.object({
  enabled: z.boolean(),
})

module.exports = {
  authorityCreationSchema,
  authorityStatusSchema,
  authorityUpdateSchema,
}
