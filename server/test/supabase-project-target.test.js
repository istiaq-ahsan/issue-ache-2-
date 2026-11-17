const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  assertNonProductionDatabaseTargets,
  getSupabaseProjectTarget,
} = require('../src/utils/supabase-project-target')

test('identifies project refs from direct and pooler Supabase URLs', () => {
  assert.deepEqual(
    getSupabaseProjectTarget(
      'postgresql://postgres:secret@db.abc123.supabase.co:5432/postgres',
    ),
    { host: 'db.abc123.supabase.co:5432', projectRef: 'abc123' },
  )
  assert.deepEqual(
    getSupabaseProjectTarget(
      'postgresql://postgres.abc123:secret@aws-0-us-east-1.pooler.supabase.com/postgres',
    ),
    { host: 'aws-0-us-east-1.pooler.supabase.com', projectRef: 'abc123' },
  )
})

test('does not infer a Supabase project ref from an unrecognized database URL', () => {
  assert.deepEqual(
    getSupabaseProjectTarget('postgresql://postgres:secret@localhost:5432/postgres'),
    { host: 'localhost:5432', projectRef: null },
  )
})

test('database safety gate rejects missing production refs and production targets', () => {
  const databaseUrl = 'postgresql://postgres.devproject123:secret@pooler.example.supabase.com/postgres'
  const directUrl = 'postgresql://postgres:secret@db.devproject123.supabase.co/postgres'
  const log = () => undefined

  assert.throws(
    () => assertNonProductionDatabaseTargets({
      databaseUrl,
      directUrl,
      productionProjectRef: '<paste prod ref>',
      log,
    }),
    /PRODUCTION_PROJECT_REF must be set/,
  )
  assert.throws(
    () => assertNonProductionDatabaseTargets({
      databaseUrl,
      directUrl,
      productionProjectRef: ' differentprodref123 ',
      log,
    }),
    /PRODUCTION_PROJECT_REF must be set/,
  )
  assert.throws(
    () => assertNonProductionDatabaseTargets({
      databaseUrl,
      directUrl,
      productionProjectRef: 'devproject123',
      log,
    }),
    /matches PRODUCTION_PROJECT_REF/,
  )
  assert.throws(
    () => assertNonProductionDatabaseTargets({
      databaseUrl,
      directUrl,
      productionProjectRef: 'DEVPROJECT123',
      log,
    }),
    /matches PRODUCTION_PROJECT_REF/,
  )
  assert.deepEqual(
    assertNonProductionDatabaseTargets({
      databaseUrl,
      directUrl,
      productionProjectRef: 'differentprodref123',
      log,
    }).directTarget,
    { host: 'db.devproject123.supabase.co', projectRef: 'devproject123' },
  )
})
