const { z } = require('zod')

const paymentIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(128),
})

const providerCallbackSchema = z.object({}).passthrough()

module.exports = { paymentIdParamsSchema, providerCallbackSchema }
