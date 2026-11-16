const { z } = require('zod')

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().min(1).max(40).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide a name or phone number to update',
  })

const createDepartmentChangeSchema = z.discriminatedUnion('changeType', [
  z.object({
    changeType: z.literal('STUDENT_CHANGE'),
    requestedDepartmentId: z.string().trim().min(1).max(128),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    changeType: z.literal('TEACHER_ADD'),
    requestedDepartmentId: z.string().trim().min(1).max(128),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    changeType: z.literal('TEACHER_REMOVE'),
    currentDepartmentId: z.string().trim().min(1).max(128),
    replacementDepartmentId: z.string().trim().min(1).max(128).optional(),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    changeType: z.literal('TEACHER_PRIMARY_CHANGE'),
    requestedDepartmentId: z.string().trim().min(1).max(128),
    reason: z.string().trim().min(1).max(2000),
  }),
])

const departmentChangeDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
})

const departmentChangeListQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  role: z.enum(['STUDENT', 'TEACHER']).optional(),
})

module.exports = {
  createDepartmentChangeSchema,
  departmentChangeDecisionSchema,
  departmentChangeListQuerySchema,
  profileUpdateSchema,
}
