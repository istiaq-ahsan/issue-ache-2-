const dotenv = require('dotenv')
const { z } = require('zod')

dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .refine((origins) => origins.length > 0, {
      message: 'CLIENT_ORIGIN must include at least one allowed origin',
    }),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PAYMENT_PROVIDER: z.enum(['demo', 'sslcommerz']).default('demo'),
  SSLCOMMERZ_STORE_ID: z.string().default(''),
  SSLCOMMERZ_STORE_PASSWORD: z.string().default(''),
  SSLCOMMERZ_IS_LIVE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CRON_SECRET: z.string().optional(),
  DATABASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  DIRECT_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
}).refine(
  ({ FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY }) => {
    const hasClientEmail = Boolean(FIREBASE_CLIENT_EMAIL)
    const hasPrivateKey = Boolean(FIREBASE_PRIVATE_KEY)
    return (
      hasClientEmail === hasPrivateKey &&
      (!hasClientEmail || Boolean(FIREBASE_PROJECT_ID))
    )
  },
  {
    message:
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be configured together',
  },
).superRefine((config, context) => {
  const isVercel = process.env.VERCEL === '1'
  const isProduction = config.NODE_ENV === 'production' || isVercel

  if (!isProduction) return

  if (config.NODE_ENV !== 'production') {
    context.addIssue({
      code: 'custom',
      path: ['NODE_ENV'],
      message: 'NODE_ENV must be production when deployed to Vercel',
    })
  }

  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    if (!config[key]) {
      context.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} must be configured for production`,
      })
    }
  }

  if (!process.env.CLIENT_ORIGIN) {
    context.addIssue({
      code: 'custom',
      path: ['CLIENT_ORIGIN'],
      message: 'CLIENT_ORIGIN must be explicitly configured for production',
    })
  }

  if (
    !config.FIREBASE_PROJECT_ID ||
    !config.FIREBASE_CLIENT_EMAIL ||
    !config.FIREBASE_PRIVATE_KEY
  ) {
    context.addIssue({
      code: 'custom',
      path: ['FIREBASE_PROJECT_ID'],
      message: 'Firebase Admin service-account credentials are required for production',
    })
  }

  for (const origin of config.CLIENT_ORIGIN) {
    let parsedOrigin = null
    try {
      parsedOrigin = new URL(origin)
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['CLIENT_ORIGIN'],
        message: 'Production CORS origins must be valid HTTPS origins',
      })
    }

    if (
      parsedOrigin &&
      (parsedOrigin.protocol !== 'https:' ||
        parsedOrigin.origin !== origin ||
        parsedOrigin.hostname === 'localhost' ||
        parsedOrigin.hostname === '127.0.0.1')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CLIENT_ORIGIN'],
        message: 'Production CORS origins must be HTTPS origins without a path',
      })
    }
  }
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  throw new Error(`Invalid server environment configuration: ${result.error.message}`)
}

module.exports = result.data
