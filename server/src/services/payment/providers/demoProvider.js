const env = require('../../../config/env')
const ApiError = require('../../../utils/api-error')

const paymentStatuses = new Set(['SUCCESSFUL', 'FAILED', 'CANCELLED'])

async function initiate({ payment }) {
  if (!payment || typeof payment.id !== 'string' || payment.id.length === 0) {
    throw new TypeError('A payment with an id is required to initiate demo payment')
  }

  const redirectUrl = new URL(
    `/payment/demo/${encodeURIComponent(payment.id)}`,
    env.CLIENT_ORIGIN[0],
  )
  if (payment.institutionId) {
    redirectUrl.searchParams.set('institutionId', payment.institutionId)
  }

  return {
    redirectUrl: redirectUrl.toString(),
    providerTransactionId: `demo-${payment.id}`,
  }
}

async function verify({ callbackPayload }) {
  const status = callbackPayload?.status ?? callbackPayload?.result

  if (!paymentStatuses.has(status)) {
    throw new ApiError(
      400,
      'INVALID_DEMO_PAYMENT_RESULT',
      'Demo payment result must be SUCCESSFUL, FAILED, or CANCELLED',
    )
  }

  return { status, raw: callbackPayload }
}

module.exports = { initiate, verify }
