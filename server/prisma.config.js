const path = require('node:path')
const dotenv = require('dotenv')
const { defineConfig } = require('prisma/config')

dotenv.config({ path: path.join(__dirname, '.env') })

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'Set DATABASE_URL or DIRECT_URL in server/.env before running Prisma commands.',
  )
}

module.exports = defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'prisma', 'migrations'),
  },
  datasource: {
    url: databaseUrl,
  },
})
