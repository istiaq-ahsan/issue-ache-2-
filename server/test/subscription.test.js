const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createRequireActiveSubscription } = require('../src/middlewares/auth')
const {
  ensureActiveSubscription,
  processSubscriptionPaymentCallback,
  startSubscriptionRenewal,
} = require('../src/services/subscription.service')

function createSubscriptionDatabase(subscription) {
  const state = { subscription: { ...subscription }, updates: [] }
  const model = {
    updateMany: async ({ where, data }) => {
      state.updates.push({ where, data })
      if (
        state.subscription &&
        state.subscription.status === where.status &&
        state.subscription.departmentId === null &&
        (where.trialEndsAt?.lte === undefined ||
          state.subscription.trialEndsAt <= where.trialEndsAt.lte) &&
        (where.endsAt?.lte === undefined ||
          state.subscription.endsAt <= where.endsAt.lte)
      ) {
        Object.assign(state.subscription, data)
        return { count: 1 }
      }
      return { count: 0 }
    },
    findFirst: async ({ where }) => {
      const current = state.subscription
      if (
        !current ||
        current.institutionId !== where.institutionId ||
        current.departmentId !== null ||
        !where.status.in.includes(current.status) ||
        current.startsAt > where.startsAt.lte
      ) {
        return null
      }
      return { ...current }
    },
  }
  return { state, subscription: model }
}

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error))
  })
}

test('active and trialing institution subscriptions pass enforcement', async () => {
  const now = new Date('2026-11-16T12:00:00Z')
  for (const subscription of [
    {
      id: 'paid',
      institutionId: 'institution-1',
      departmentId: null,
      planCode: 'PRO',
      status: 'ACTIVE',
      startsAt: new Date('2026-11-01T00:00:00Z'),
      endsAt: new Date('2026-12-01T00:00:00Z'),
    },
    {
      id: 'trial',
      institutionId: 'institution-1',
      departmentId: null,
      planCode: 'BASIC',
      status: 'TRIALING',
      startsAt: new Date('2026-11-01T00:00:00Z'),
      endsAt: new Date('2026-11-20T00:00:00Z'),
      trialEndsAt: new Date('2026-11-20T00:00:00Z'),
    },
  ]) {
    const database = createSubscriptionDatabase(subscription)
    const result = await ensureActiveSubscription('institution-1', {
      database,
      now,
    })
    assert.equal(result.id, subscription.id)
  }
})

test('expired subscription enforcement marks the term expired and returns 402', async () => {
  const now = new Date('2026-11-16T12:00:00Z')
  const database = createSubscriptionDatabase({
    id: 'expired-trial',
    institutionId: 'institution-1',
    departmentId: null,
    planCode: 'BASIC',
    status: 'TRIALING',
    startsAt: new Date('2026-11-01T00:00:00Z'),
    endsAt: new Date('2026-11-15T00:00:00Z'),
    trialEndsAt: new Date('2026-11-15T00:00:00Z'),
  })
  const middleware = createRequireActiveSubscription({ database, now: () => now })
  const error = await runMiddleware(middleware, { auth: { institutionId: 'institution-1' } })

  assert.equal(error.statusCode, 402)
  assert.equal(error.code, 'SUBSCRIPTION_INACTIVE')
  assert.equal(database.state.subscription.status, 'EXPIRED')
})

test('renewal creates a server-priced pending payment and uses the selected provider', async () => {
  const createdPayments = []
  let updatedPayment
  const database = {
    payment: {
      findFirst: async () => null,
      update: async ({ data }) => { updatedPayment = data },
    },
    $transaction: async (callback) => callback({
      $queryRaw: async () => [],
      payment: {
        findFirst: async () => null,
        create: async ({ data }) => {
          createdPayments.push(data)
          return { id: 'payment-1', ...data }
        },
      },
      auditLog: { create: async () => undefined },
    }),
  }
  const result = await startSubscriptionRenewal(
    'institution-1',
    'admin-1',
    { planCode: 'PRO', billingCycle: 'YEARLY' },
    {
      database,
      payment: {
        initiatePayment: async ({ payment, intent }) => {
          assert.equal(payment.amount, '39990.00')
          assert.equal(intent, null)
          return {
            redirectUrl: 'https://client.example/payment/demo/payment-1',
            providerTransactionId: 'provider-transaction-1',
          }
        },
      },
    },
  )

  assert.equal(createdPayments[0].institutionId, 'institution-1')
  assert.equal(createdPayments[0].amount, '39990.00')
  assert.equal(createdPayments[0].status, 'PENDING')
  assert.equal(updatedPayment.providerTransactionId, 'provider-transaction-1')
  assert.equal(result.paymentId, 'payment-1')
})

test('renewal rechecks pending payments under an institution-scoped transaction lock', async () => {
  let created = false
  const database = {
    payment: { findFirst: async () => null },
    $transaction: async (callback) => callback({
      $queryRaw: async () => [],
      payment: {
        findFirst: async () => ({ id: 'existing-payment' }),
        create: async () => {
          created = true
          return { id: 'unexpected-payment' }
        },
      },
    }),
  }

  await assert.rejects(
    startSubscriptionRenewal(
      'institution-1',
      'admin-1',
      { planCode: 'PRO', billingCycle: 'YEARLY' },
      { database },
    ),
    (error) => error.code === 'SUBSCRIPTION_PAYMENT_PENDING',
  )
  assert.equal(created, false)
})

test('successful renewal verifies amount and schedules the new term after the current term', async () => {
  const now = new Date('2026-11-16T12:00:00Z')
  const currentEnd = new Date('2026-12-01T00:00:00Z')
  const state = {
    payment: {
      id: 'payment-1',
      institutionId: 'institution-1',
      departmentId: null,
      registrationIntentId: null,
      subscriptionId: null,
      planCode: 'BASIC',
      billingCycle: 'MONTHLY',
      amount: '1499.00',
      currency: 'BDT',
      provider: 'DEMO',
      status: 'PENDING',
    },
    subscriptions: [],
  }
  const database = {
    payment: {
      findUnique: async () => ({ ...state.payment }),
    },
    $transaction: async (callback) => callback({
      payment: {
        updateMany: async ({ data }) => {
          Object.assign(state.payment, data)
          return { count: 1 }
        },
        update: async ({ data }) => Object.assign(state.payment, data),
      },
      subscription: {
        findFirst: async () => ({
          id: 'current-subscription',
          status: 'ACTIVE',
          endsAt: currentEnd,
        }),
        create: async ({ data }) => {
          const created = { id: 'new-subscription', ...data }
          state.subscriptions.push(created)
          return created
        },
      },
      auditLog: { create: async () => undefined },
      institution: { findUnique: async () => ({ adminUserId: 'admin-1' }) },
      notification: { create: async () => undefined },
    }),
  }

  const result = await processSubscriptionPaymentCallback(
    'payment-1',
    { status: 'SUCCESSFUL' },
    {
      database,
      now,
      payment: {
        verifyPayment: async () => ({
          status: 'SUCCESSFUL',
          raw: { amount: '1499.00', currency: 'BDT' },
        }),
      },
    },
  )

  assert.equal(result.paymentStatus, 'SUCCESSFUL')
  assert.equal(state.payment.subscriptionId, 'new-subscription')
  assert.equal(state.subscriptions[0].startsAt.toISOString(), currentEnd.toISOString())
  assert.equal(state.subscriptions[0].endsAt.toISOString(), '2027-01-01T00:00:00.000Z')
})
