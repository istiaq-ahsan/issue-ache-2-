const assert = require('node:assert/strict')
const { test } = require('node:test')
const env = require('../src/config/env')
const { getProvider } = require('../src/services/payment/providers')
const { initiatePayment, verifyPayment } = require('../src/services/payment/paymentService')

test('demo provider creates a frontend demo-payment URL and transaction id', async () => {
  const result = await initiatePayment({
    payment: { id: 'payment-123' },
    intent: {},
    returnUrls: {},
  })

  assert.equal(
    result.redirectUrl,
    new URL('/payment/demo/payment-123', env.CLIENT_ORIGIN[0]).toString(),
  )
  assert.equal(result.providerTransactionId, 'demo-payment-123')
})

test('payment service verifies each supported demo payment result', async (context) => {
  for (const status of ['SUCCESSFUL', 'FAILED', 'CANCELLED']) {
    await context.test(status, async () => {
      const callbackPayload = { status }
      assert.deepEqual(await verifyPayment({ callbackPayload }), {
        status,
        raw: callbackPayload,
      })
    })
  }
})

test('demo provider rejects unsupported payment results', async () => {
  await assert.rejects(
    getProvider('demo').verify({ callbackPayload: { status: 'PENDING' } }),
    { code: 'INVALID_DEMO_PAYMENT_RESULT' },
  )
})

test('SSLCommerz provider methods fail explicitly until implemented', async () => {
  const provider = getProvider('sslcommerz')

  await assert.rejects(provider.initiate({}), /not implemented/)
  await assert.rejects(provider.verify({}), /not implemented/)
})

test('provider factory rejects unsupported provider names', () => {
  assert.throws(() => getProvider('unknown'), /Unsupported payment provider/)
})

test('provider factory defaults to the configured provider', () => {
  assert.equal(getProvider(), getProvider(env.PAYMENT_PROVIDER))
})
