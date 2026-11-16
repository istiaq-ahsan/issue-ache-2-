const { z } = require('zod')

const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
})

const updateDepartmentSchema = createDepartmentSchema.strict()

const departmentIdParamsSchema = z.object({
  institutionId: z.string().trim().min(1).max(128),
  departmentId: z.string().trim().min(1).max(128),
})

module.exports = {
  createDepartmentSchema: createDepartmentSchema.strict(),
  departmentIdParamsSchema,
  updateDepartmentSchema,
}
