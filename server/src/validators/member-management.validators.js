const { z } = require('zod')

const memberStatusSchema = z.object({ enabled: z.boolean() }).strict()
const memberListQuerySchema = z.object({
  departmentId: z.string().trim().min(1).max(128).optional(),
}).strict()

module.exports = { memberListQuerySchema, memberStatusSchema }
