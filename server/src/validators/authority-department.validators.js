const { z } = require('zod')

const authorityDepartmentsSchema = z.object({
  departmentIds: z.array(z.string().trim().min(1).max(128)).min(1),
}).strict()

module.exports = { authorityDepartmentsSchema }