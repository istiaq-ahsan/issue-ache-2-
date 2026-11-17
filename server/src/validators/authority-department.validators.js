const { z } = require('zod')

const authorityDepartmentSchema = z.object({
  departmentId: z.string().trim().min(1).max(128),
}).strict()

module.exports = { authorityDepartmentSchema }