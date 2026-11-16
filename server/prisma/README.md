# Prisma database layer

`schema.prisma` contains the PostgreSQL models, enums, tenant-scoped
relationships, and indexes. Database commands read `DATABASE_URL` and
`DIRECT_URL` from `server/.env` through `prisma.config.js`; migrations use
`DIRECT_URL` when present, while the application Prisma client uses
`DATABASE_URL`.

Copy `.env.example` to `.env` and set real Supabase connection strings before
running Prisma commands. Never commit `.env` or credentials.

Run database scripts from `server/`:

```powershell
npm run db:format
npm run db:validate
npm run db:generate
npm run db:migrate:status
npm run db:migrate:deploy
```

`db:migrate:deploy` applies checked-in migrations to a database. For future
schema changes, update `schema.prisma`, create and review a new migration with
`npm run db:migrate:dev -- --name <description>`, and commit both the schema and
migration.

The initial migration also adds PostgreSQL checks, partial indexes, and
triggers for approved lifecycle and tenant constraints that Prisma Schema
Language cannot express. Preserve or deliberately replace these SQL objects
when editing future migrations; Prisma schema diffs do not manage them.

The generated Prisma Client is placed in ignored dependencies; application
source remains JavaScript.
