const { z } = require('zod')

const authorityDashboardQuerySchema = z.object({
  departmentId: z.string().trim().min(1).max(128).optional(),
}).strict()

module.exports = { authorityDashboardQuerySchema }
