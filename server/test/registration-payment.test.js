const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createApp } = require('../src/app')
const { createRegistrationController } = require('../src/controllers/registration.controller')
const { createPaymentController } = require('../src/controllers/payment.controller')
const {
  cleanupExpiredIntents,
  completeRegistration,
  processPaymentCallback,
  startRegistration,
} = require('../src/services/registration.service')

const now = new Date('2026-01-31T12:00:00.000Z')

function registrationInput(overrides = {}) {
  return {
    planCode: 'BASIC',
    billingCycle: 'MONTHLY',
    institutionName: '  North   Campus ',
    contactPersonName: 'Contact Person',
    contactEmail: 'contact@example.edu',
    campusType: 'University',
    campusSize: 'Large',
    location: 'North district',
    adminName: 'Campus Admin',
    adminEmail: 'admin@example.edu',
    password: 'a-secret-password',
    startTrial: false,
    ...overrides,
  }
}

function createDatabase() {
  const state = {
    institutions: [],
    users: [],
    intents: [],
    payments: [],
    subscriptions: [],
    auditLogs: [],
    notifications: [],
    nextId: 1,
  }

  function id(prefix) {
    return `${prefix}-${state.nextId++}`
  }

  function matchConditions(record, where = {}) {
    for (const [key, condition] of Object.entries(where)) {
      if (key === 'OR') {
        if (!condition.some((entry) => matchConditions(record, entry))) return false
      } else if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
        if ('gt' in condition && !(record[key] > condition.gt)) return false
        if ('lte' in condition && !(record[key] <= condition.lte)) return false
        if ('not' in condition && record[key] === condition.not) return false
        if ('in' in condition && !condition.in.includes(record[key])) return false
      } else if (record[key] !== condition) {
        return false
      }
    }
    return true
  }

  function registrationIntentRecord(intent, include = {}) {
    if (!intent) return null
    const record = { ...intent }
    if (include.payment) {
      record.payment = state.payments.find(
        (payment) => payment.registrationIntentId === intent.id,
      ) || null
    }
    if (include.institution) {
      record.institution = state.institutions.find(
        (institution) => institution.id === intent.institutionId,
      ) || null
    }
    return record
  }

  const models = {
    institution: {
      findFirst: async ({ where }) =>
        state.institutions.find((record) => matchConditions(record, where)) || null,
      create: async ({ data }) => {
        const record = { id: id('institution'), createdAt: new Date(now), ...data }
        state.institutions.push(record)
        return record
      },
    },
    user: {
      findUnique: async ({ where }) =>
        state.users.find((record) => matchConditions(record, where)) || null,
      create: async ({ data }) => {
        const record = { id: id('user'), ...data }
        state.users.push(record)
        return record
      },
    },
    registrationIntent: {
      findFirst: async ({ where }) =>
        state.intents.find((record) => matchConditions(record, where)) || null,
      findUnique: async ({ where, include, select }) => {
        const intent = state.intents.find((record) => record.id === where.id)
        if (select) {
          if (!intent) return null
          return Object.fromEntries(
            Object.keys(select).map((field) => [field, intent[field]]),
          )
        }
        return registrationIntentRecord(intent, include)
      },
      findMany: async ({ where, select }) =>
        state.intents
          .filter((record) => matchConditions(record, where))
          .map((record) =>
            Object.fromEntries(Object.keys(select).map((field) => [field, record[field]])),
          ),
      create: async ({ data }) => {
        const record = { id: id('intent'), createdAt: new Date(now), ...data }
        state.intents.push(record)
        return record
      },
      update: async ({ where, data }) => {
        const record = state.intents.find((intent) => intent.id === where.id)
        Object.assign(record, data)
        return record
      },
      updateMany: async ({ where, data }) => {
        const matches = state.intents.filter((record) => matchConditions(record, where))
        matches.forEach((record) => Object.assign(record, data))
        return { count: matches.length }
      },
    },
    payment: {
      findUnique: async ({ where, include }) => {
        const record = state.payments.find((payment) => payment.id === where.id)
        if (!record) return null
        return {
          ...record,
          ...(include?.registrationIntent
            ? {
                registrationIntent: state.intents.find(
                  (intent) => intent.id === record.registrationIntentId,
                ) || null,
              }
            : {}),
        }
      },
      findFirst: async ({ where, select }) => {
        const record = state.payments.find((payment) => matchConditions(payment, where))
        if (!record) return null
        if (!select) return record
        return {
          id: record.id,
          status: record.status,
          createdAt: record.createdAt,
          registrationIntent: {
            status: state.intents.find((intent) => intent.id === record.registrationIntentId)?.status,
            institutionId: state.intents.find((intent) => intent.id === record.registrationIntentId)?.institutionId,
          },
        }
      },
      create: async ({ data }) => {
        const record = { id: id('payment'), createdAt: new Date(now), ...data }
        state.payments.push(record)
        return record
      },
      update: async ({ where, data }) => {
        const record = state.payments.find((payment) => payment.id === where.id)
        Object.assign(record, data)
        return record
      },
      updateMany: async ({ where, data }) => {
        const matches = state.payments.filter((record) => matchConditions(record, where))
        matches.forEach((record) => Object.assign(record, data))
        return { count: matches.length }
      },
    },
    subscription: {
      create: async ({ data }) => {
        const record = { id: id('subscription'), ...data }
        state.subscriptions.push(record)
        return record
      },
      updateMany: async () => ({ count: 0 }),
    },
    auditLog: {
      create: async ({ data }) => {
        const record = { id: id('audit'), ...data }
        state.auditLogs.push(record)
        return record
      },
    },
    notification: {
      create: async ({ data }) => {
        const record = { id: id('notification'), ...data }
        state.notifications.push(record)
        return record
      },
    },
  }

  return {
    ...models,
    $transaction: (callback) =>
      callback({
        ...models,
        $queryRaw: async () => [],
      }),
    state,
  }
}

function createFirebaseAuth() {
  const state = { created: [], enabled: [], deleted: [] }
  return {
    state,
    createUser: async (account) => {
      state.created.push(account)
      return { uid: `firebase-${state.created.length}` }
    },
    updateUser: async (uid, changes) => {
      state.enabled.push({ uid, ...changes })
    },
    deleteUser: async (uid) => {
      state.deleted.push(uid)
    },
  }
}

function createPaymentProvider() {
  const state = { verifyCalls: 0 }
  return {
    state,
    initiatePayment: async ({ payment }) => ({
      redirectUrl: `https://client.example/payment/demo/${payment.id}`,
      providerTransactionId: `demo-${payment.id}`,
    }),
    verifyPayment: async ({ payment, callbackPayload }) => {
      state.verifyCalls += 1
      return {
        status: callbackPayload.status,
        raw: {
          amount: payment.amount.toString(),
          currency: payment.currency,
        },
      }
    },
  }
}

test('plans endpoint exposes the server plan catalog and old bypass route is gone', async (context) => {
  const app = createApp()
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const plansResponse = await fetch(`${baseUrl}/api/plans`)
  const plansBody = await plansResponse.json()
  assert.equal(plansResponse.status, 200)
  assert.deepEqual(plansBody.data.plans.map(({ code }) => code), ['BASIC', 'PRO'])
  assert.equal(plansBody.data.plans[0].prices.YEARLY, 14990)

  const legacyResponse = await fetch(`${baseUrl}/api/institutions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registrationInput()),
  })
  assert.equal(legacyResponse.status, 404)
})

test('Basic trial provisions a disabled Firebase user then completes atomically and idempotently', async () => {
  const database = createDatabase()
  const firebaseAuth = createFirebaseAuth()
  const payment = createPaymentProvider()

  const result = await startRegistration(
    registrationInput({ startTrial: true }),
    { database, firebaseAuth, payment, now },
  )

  assert.equal(result.registrationStatus, 'COMPLETED')
  assert.equal(result.subscriptionStatus, 'TRIALING')
  assert.equal(firebaseAuth.state.created[0].disabled, true)
  assert.deepEqual(firebaseAuth.state.enabled, [{ uid: 'firebase-1', disabled: false }])
  assert.equal(payment.state.verifyCalls, 0)
  assert.equal(database.state.payments.length, 0)
  assert.equal(database.state.users.length, 1)
  assert.equal(database.state.institutions.length, 1)
  assert.equal(database.state.intents[0].status, 'COMPLETED')
  assert.equal('password' in database.state.intents[0], false)
  assert.equal(database.state.subscriptions[0].status, 'TRIALING')
  assert.equal(database.state.subscriptions[0].trialEndsAt.toISOString(), '2026-02-14T12:00:00.000Z')
  assert.equal(database.state.auditLogs.length, 2)
  assert.equal(database.state.notifications.length, 1)

  await completeRegistration(database.state.intents[0].id, {
    database,
    firebaseAuth,
    payment,
    now,
    subscriptionStatus: 'TRIALING',
  })
  assert.equal(database.state.institutions.length, 1)
  assert.equal(database.state.users.length, 1)
})

test('existing institutions and live pending intents block duplicate registration before Firebase provisioning', async () => {
  const firebaseAuth = createFirebaseAuth()
  const payment = createPaymentProvider()
  const existingInstitutionDatabase = createDatabase()
  existingInstitutionDatabase.state.institutions.push({
    id: 'existing',
    normalizedName: 'north campus',
    contactEmail: 'other@example.edu',
  })

  await assert.rejects(
    startRegistration(registrationInput(), {
      database: existingInstitutionDatabase,
      firebaseAuth,
      payment,
      now,
    }),
    (error) => error.code === 'INSTITUTION_ALREADY_EXISTS',
  )

  const pendingIntentDatabase = createDatabase()
  pendingIntentDatabase.state.intents.push({
    id: 'pending-intent',
    normalizedName: 'other campus',
    contactEmail: 'contact@example.edu',
    status: 'PENDING_PAYMENT',
    expiresAt: new Date('2026-01-31T12:15:00.000Z'),
  })
  await assert.rejects(
    startRegistration(registrationInput(), {
      database: pendingIntentDatabase,
      firebaseAuth,
      payment,
      now,
    }),
    (error) => error.code === 'INSTITUTION_CONTACT_EMAIL_EXISTS',
  )
  assert.equal(firebaseAuth.state.created.length, 0)
})

test('payment initiation failure closes the intent and deletes the provisional Firebase user', async () => {
  const database = createDatabase()
  const firebaseAuth = createFirebaseAuth()
  const payment = createPaymentProvider()
  payment.initiatePayment = async () => {
    throw new Error('SSLCommerz payment initiation not implemented')
  }

  await assert.rejects(
    startRegistration(registrationInput(), { database, firebaseAuth, payment, now }),
    (error) => error.code === 'PAYMENT_PROVIDER_NOT_IMPLEMENTED',
  )

  assert.equal(database.state.intents[0].status, 'FAILED')
  assert.equal(database.state.payments[0].status, 'FAILED')
  assert.deepEqual(firebaseAuth.state.deleted, ['firebase-1'])
  assert.equal(database.state.institutions.length, 0)
})

test('paid registration completes from verified callback and repeated callback is idempotent', async () => {
  const database = createDatabase()
  const firebaseAuth = createFirebaseAuth()
  const payment = createPaymentProvider()
  let verifyCalls = 0
  payment.verifyPayment = async ({ payment: paymentRecord }) => {
    verifyCalls += 1
    return {
      status: 'SUCCESSFUL',
      raw: {
        amount: paymentRecord.amount.toString(),
        currency: paymentRecord.currency,
        password: 'must-not-be-persisted',
      },
    }
  }
  const started = await startRegistration(
    registrationInput({ planCode: 'PRO', billingCycle: 'YEARLY', price: 1 }),
    { database, firebaseAuth, payment, now },
  )

  assert.equal(started.redirectUrl, `https://client.example/payment/demo/${started.paymentId}`)
  assert.equal(database.state.payments[0].amount, '39990.00')
  assert.equal(database.state.intents[0].expiresAt.toISOString(), '2026-01-31T12:30:00.000Z')

  const callback = await processPaymentCallback(
    started.paymentId,
    { status: 'SUCCESSFUL' },
    { database, firebaseAuth, payment, now },
  )
  assert.equal(callback.paymentStatus, 'SUCCESSFUL')
  assert.equal(callback.registrationStatus, 'COMPLETED')
  assert.equal(database.state.institutions.length, 1)
  assert.equal(database.state.payments[0].institutionId, database.state.institutions[0].id)
  assert.equal(database.state.payments[0].subscriptionId, database.state.subscriptions[0].id)
  assert.equal(database.state.subscriptions[0].status, 'ACTIVE')
  assert.equal(database.state.subscriptions[0].endsAt.toISOString(), '2027-01-31T12:00:00.000Z')
  assert.equal(database.state.auditLogs.length, 3)
  assert.equal('password' in database.state.payments[0].rawResponse, false)

  await processPaymentCallback(
    started.paymentId,
    { status: 'SUCCESSFUL' },
    { database, firebaseAuth, payment, now },
  )
  assert.equal(database.state.institutions.length, 1)
  assert.equal(database.state.users.length, 1)
  assert.equal(verifyCalls, 1)
})

test('failed and cancelled payments close the intent and delete the disabled Firebase user', async (context) => {
  for (const status of ['FAILED', 'CANCELLED']) {
    await context.test(status, async () => {
      const database = createDatabase()
      const firebaseAuth = createFirebaseAuth()
      const payment = createPaymentProvider()
      const started = await startRegistration(
        registrationInput(),
        { database, firebaseAuth, payment, now },
      )

      const result = await processPaymentCallback(
        started.paymentId,
        { status },
        { database, firebaseAuth, payment, now },
      )

      assert.equal(result.paymentStatus, status)
      assert.equal(result.registrationStatus, status)
      assert.deepEqual(firebaseAuth.state.deleted, ['firebase-1'])
      assert.equal(database.state.institutions.length, 0)
      assert.equal(database.state.payments[0].status, status)
    })
  }
})

test('verified provider amount mismatch leaves registration pending and creates no institution', async () => {
  const database = createDatabase()
  const firebaseAuth = createFirebaseAuth()
  const payment = createPaymentProvider()
  const started = await startRegistration(
    registrationInput(),
    { database, firebaseAuth, payment, now },
  )
  payment.verifyPayment = async () => ({
    status: 'SUCCESSFUL',
    raw: { amount: '1.00', currency: 'BDT' },
  })

  await assert.rejects(
    processPaymentCallback(
      started.paymentId,
      { status: 'SUCCESSFUL' },
      { database, firebaseAuth, payment, now },
    ),
    (error) => error.code === 'PAYMENT_AMOUNT_MISMATCH',
  )
  assert.equal(database.state.intents[0].status, 'PENDING_PAYMENT')
  assert.equal(database.state.payments[0].status, 'PENDING')
  assert.equal(database.state.institutions.length, 0)
})

test('failed completion transaction leaves payment intent retryable and Firebase disabled', async () => {
  const database = createDatabase()
  const firebaseAuth = createFirebaseAuth()
  const payment = createPaymentProvider()
  const started = await startRegistration(
    registrationInput(),
    { database, firebaseAuth, payment, now },
  )
  const transaction = database.$transaction
  database.$transaction = async () => {
    throw new Error('transaction unavailable')
  }

  await assert.rejects(
    processPaymentCallback(
      started.paymentId,
      { status: 'SUCCESSFUL' },
      { database, firebaseAuth, payment, now },
    ),
    /transaction unavailable/,
  )
  assert.equal(database.state.intents[0].status, 'PENDING_PAYMENT')
  assert.equal(database.state.institutions.length, 0)
  assert.equal(firebaseAuth.state.enabled.length, 0)
  assert.deepEqual(firebaseAuth.state.deleted, [])

  database.$transaction = transaction
  const result = await processPaymentCallback(
    started.paymentId,
    { status: 'SUCCESSFUL' },
    { database, firebaseAuth, payment, now },
  )
  assert.equal(result.registrationStatus, 'COMPLETED')
  assert.equal(database.state.institutions.length, 1)
})

test('expired pending intents are marked expired, payments cancelled, and Firebase users deleted', async () => {
  const database = createDatabase()
  const firebaseAuth = createFirebaseAuth()
  const payment = createPaymentProvider()
  await startRegistration(registrationInput(), { database, firebaseAuth, payment, now })

  const result = await cleanupExpiredIntents({
    database,
    firebaseAuth,
    now: new Date('2026-01-31T12:31:00.000Z'),
  })

  assert.deepEqual(result, {
    expiredCount: 1,
    deletedCount: 1,
    subscriptionExpiredCount: 0,
  })
  assert.equal(database.state.intents[0].status, 'EXPIRED')
  assert.equal(database.state.payments[0].status, 'CANCELLED')
  assert.deepEqual(firebaseAuth.state.deleted, ['firebase-1'])
})

test('callback route validates params and delegates provider verification', async (context) => {
  const controller = createPaymentController({
    processCallback: async (paymentId, payload) => ({ paymentId, payload }),
  })
  const app = createApp({
    paymentOptions: { controller },
    registrationOptions: {
      controller: createRegistrationController({
        start: async () => ({ redirectUrl: 'https://client.example/pay', paymentId: 'p-1' }),
      }),
    },
  })
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const response = await fetch(`${baseUrl}/api/payments/p-1/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'SUCCESSFUL' }),
  })
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(body.data, {
    paymentId: 'p-1',
    payload: { status: 'SUCCESSFUL' },
  })

  test('registration start validates requests and rate limits by contact email', async (context) => {
    let startCount = 0
    const controller = createRegistrationController({
      start: async (input) => {
        startCount += 1
        assert.equal(input.contactEmail, 'contact@example.edu')
        return { paymentId: `payment-${startCount}`, redirectUrl: 'https://client.example/pay' }
      },
    })
    const app = createApp({ registrationOptions: { controller } })
    const server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    context.after(() => new Promise((resolve) => server.close(resolve)))
    const url = `http://127.0.0.1:${server.address().port}/api/registration/start`

    const invalidResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationInput({ planCode: 'PRO', startTrial: true })),
    })
    assert.equal(invalidResponse.status, 400)

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationInput({
          contactEmail: 'CONTACT@example.edu',
          adminEmail: `admin-${attempt}@example.edu`,
        })),
      })
      assert.equal(response.status, attempt < 3 ? 201 : 429)
    }
    assert.equal(startCount, 3)
  })

  const invalidResponse = await fetch(`${baseUrl}/api/payments/p-1/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([]),
  })
  assert.equal(invalidResponse.status, 400)
})

test('registration validation rejects paid plan trial requests', () => {
  const { startRegistrationSchema } = require('../src/validators/registration.validators')
  const result = startRegistrationSchema.safeParse(
    registrationInput({ planCode: 'PRO', startTrial: true }),
  )
  assert.equal(result.success, false)
})

test('cleanup route fails closed without a configured cron secret', async () => {
  const { createApp: createApplication } = require('../src/app')
  const server = createApplication().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/registration/cleanup-expired`,
    )
    const body = await response.json()
    assert.ok([401, 503].includes(response.status))
    assert.ok(
      ['CRON_AUTHENTICATION_REQUIRED', 'CRON_SECRET_NOT_CONFIGURED'].includes(body.error.code),
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
