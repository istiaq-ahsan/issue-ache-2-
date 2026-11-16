const { z } = require('zod')

const issueCategorySchema = z.enum([
  'CLASSROOM_EQUIPMENT',
  'WIFI_NETWORKING',
  'ELECTRICAL',
  'FURNITURE_INFRASTRUCTURE',
  'CLEANING_SANITATION',
  'LAB_EQUIPMENT',
  'OTHER',
])

const issuePrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
const issueStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])

const createIssueSchema = z.object({
  departmentId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(10000),
  category: issueCategorySchema,
  priority: issuePrioritySchema,
  location: z.string().trim().min(1).max(300),
}).strict()

const issueListQuerySchema = z.object({
  category: issueCategorySchema.optional(),
  priority: issuePrioritySchema.optional(),
  status: issueStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  archived: z.enum(['true', 'false', 'all']).optional(),
}).refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: 'The from date must be before or equal to the to date', path: ['from'] },
)

const issueStatusUpdateSchema = z.object({
  status: issueStatusSchema,
  note: z.string().trim().min(1).max(2000).optional(),
  resolutionSummary: z.string().trim().min(1).max(5000).optional(),
}).strict()

const issueNoteSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  visibility: z.enum(['INTERNAL', 'PUBLIC']),
}).strict()

const archiveIssueSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
}).strict()

module.exports = {
  archiveIssueSchema,
  createIssueSchema,
  issueListQuerySchema,
  issueNoteSchema,
  issueStatusUpdateSchema,
}
