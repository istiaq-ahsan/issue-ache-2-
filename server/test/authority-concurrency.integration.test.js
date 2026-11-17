const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { test } = require('node:test')
const {
  assertNonProductionDatabaseTargets,
} = require('../src/utils/supabase-project-target')

const allowedProjectRef = process.env.ALLOW_DB_INTEGRATION_TESTS
const enabled = Boolean(allowedProjectRef)

test('real PostgreSQL allows only one concurrent Authority creation for the last slot', {
  skip: !enabled,
}, async () => {
  const env = require('../src/config/env')
  const { directTarget } = assertNonProductionDatabaseTargets({
    databaseUrl: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
    productionProjectRef: process.env.PRODUCTION_PROJECT_REF,
  })
  assert.equal(
    allowedProjectRef,
    directTarget.projectRef,
    'ALLOW_DB_INTEGRATION_TESTS must exactly match the DIRECT_URL project ref',
  )

  const database = require('../src/config/prisma')
  const withTestTransaction = (callback, options) =>
    database.$transaction((transaction) =>
      callback(new Proxy(transaction, {
        get(target, property, receiver) {
          if (property === 'auditLog') {
            return { create: async () => undefined }
          }
          if (property === 'notification') {
            return { create: async () => undefined }
          }
          const value = Reflect.get(target, property, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })),
    options)
  const authorityDatabase = {
    user: database.user,
    department: database.department,
    subscription: database.subscription,
    authorityDepartment: database.authorityDepartment,
    $transaction: withTestTransaction,
  }
  const runId = randomUUID()
  const institutionId = `authority-race-${runId}`
  const adminUserId = `authority-race-admin-${runId}`
  const adminUid = `authority-race-admin-uid-${runId}`
  const actorEmail = `${runId}@authority-race.test`
  let seeded = false
  let firebaseCleanupCount = 0

  try {
    await database.$transaction(async (transaction) => {
      await transaction.user.create({
        data: {
          id: adminUserId,
          firebaseUid: adminUid,
          email: actorEmail,
          name: 'Concurrency test administrator',
        },
      })
      await transaction.institution.create({
        data: {
          id: institutionId,
          name: `Authority race ${runId}`,
          normalizedName: `authority-race-${runId}`,
          institutionCode: `RACE${runId.replace(/-/g, '').slice(0, 12)}`,
          contactPersonName: 'Concurrency test administrator',
          contactEmail: actorEmail,
          campusType: 'University',
          campusSize: 'Small',
          location: 'Automated test',
          adminUserId,
        },
      })
      const department = await transaction.department.create({
        data: { institutionId, name: 'Race test department' },
        select: { id: true },
      })
      await transaction.subscription.create({
        data: {
          institutionId,
          planName: 'Basic',
          planCode: 'BASIC',
          billingCycle: 'MONTHLY',
          status: 'ACTIVE',
          startsAt: new Date(Date.now() - 60_000),
          endsAt: new Date(Date.now() + 86_400_000),
        },
      })
    })
    seeded = true

    const { createAuthority } = require('../src/services/authority.service')
    let firebaseCreates = 0
    let releaseFirebaseBarrier
    const firebaseBarrier = new Promise((resolve) => { releaseFirebaseBarrier = resolve })
    const firebaseAuth = {
      createUser: async ({ email }) => {
        firebaseCreates += 1
        if (firebaseCreates === 2) releaseFirebaseBarrier()
        await firebaseBarrier
        return { uid: `authority-race-${runId}-${email.split('@')[0]}` }
      },
      deleteUser: async () => { firebaseCleanupCount += 1 },
    }

    const inputFor = (number) => ({
      name: `Concurrent Authority ${number}`,
      email: `concurrent-${number}-${runId}@authority-race.test`,
      password: 'Temporary-test-password-9!',
    })
    const department = await database.department.findFirst({
      where: { institutionId },
      select: { id: true },
    })
    const requests = [1, 2].map((number) =>
      createAuthority(
        { ...inputFor(number), departmentId: department.id },
        institutionId,
        adminUserId,
        { database: authorityDatabase, firebaseAuth },
      ),
    )
    const results = await Promise.allSettled(requests)
    const succeeded = results.filter(({ status }) => status === 'fulfilled')
    const rejected = results.filter(({ status }) => status === 'rejected')

    assert.equal(
      succeeded.length,
      1,
      JSON.stringify(results.map(({ status, reason }) => ({
        status,
        code: reason?.code,
        message: reason?.message,
      }))),
    )
    assert.equal(rejected.length, 1)
    assert.equal(rejected[0].reason.code, 'PLAN_LIMIT_REACHED')
    assert.equal(firebaseCleanupCount, 1)
    assert.equal(
      await database.authorityDepartment.count({ where: { institutionId } }),
      1,
    )
  } finally {
    if (seeded) {
      await database.$transaction(async (transaction) => {
        await transaction.authorityDepartment.deleteMany({ where: { institutionId } })
        await transaction.subscription.deleteMany({ where: { institutionId } })
        await transaction.institutionMembership.deleteMany({ where: { institutionId } })
        await transaction.department.deleteMany({ where: { institutionId } })
        await transaction.institution.delete({ where: { id: institutionId } })
        await transaction.user.deleteMany({
          where: { id: adminUserId },
        })
      })
    }
    await database.$disconnect()
  }
})
