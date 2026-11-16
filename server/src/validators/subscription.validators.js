const { z } = require('zod')

const renewSubscriptionSchema = z.object({
  planCode: z.enum(['BASIC', 'PRO']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
}).strict()

module.exports = { renewSubscriptionSchema }
