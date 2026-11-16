const { z } = require('zod')

const notificationListQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  departmentId: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(128).optional(),
}).strict()

const auditLogListQuerySchema = z.object({
  departmentId: z.string().trim().min(1).max(128).optional(),
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  entityId: z.string().trim().min(1).max(128).optional(),
  actorId: z.string().trim().min(1).max(128).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict().refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: 'The from date must be before or equal to the to date', path: ['from'] },
)

module.exports = {
  auditLogListQuerySchema,
  notificationListQuerySchema,
}
