const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')
const env = require('./env')

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to initialize Prisma Client.')
}

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
})
const prisma = new PrismaClient({ adapter })

module.exports = prisma