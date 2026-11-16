const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const envConfigPath = path.join(__dirname, '..', 'src', 'config', 'env.js')

function loadProductionConfig(environment) {
  return spawnSync(
    process.execPath,
    ['-e', `require(${JSON.stringify(envConfigPath)})`],
    {
      cwd: os.tmpdir(),
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        VERCEL: '1',
        ...environment,
      },
    },
  )
}

test('production configuration rejects missing secrets and unsafe development origins', () => {
  const result = loadProductionConfig({
    CLIENT_ORIGIN: 'http://localhost:5173',
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DATABASE_URL must be configured for production/)
  assert.match(result.stderr, /Firebase Admin service-account credentials are required/)
  assert.match(result.stderr, /Production CORS origins must be HTTPS origins/)
})

test('production configuration accepts complete server-side credentials and HTTPS origins', () => {
  const result = loadProductionConfig({
    CLIENT_ORIGIN: 'https://issue-ache.example',
    DATABASE_URL: 'postgresql://runtime:password@db.example:5432/issue_ache',
    DIRECT_URL: 'postgresql://migrator:password@db.example:5432/issue_ache',
    FIREBASE_PROJECT_ID: 'issue-ache',
    FIREBASE_CLIENT_EMAIL: 'firebase-admin@example.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'test-private-key',
  })

  assert.equal(result.status, 0, result.stderr)
})
