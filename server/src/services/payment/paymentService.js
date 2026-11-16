const { getProvider } = require('./providers')

function getPaymentProvider(payment) {
  const providerName = payment?.provider?.toLowerCase()
  return getProvider(providerName)
}

async function initiatePayment({ payment, intent, returnUrls }) {
  return getPaymentProvider(payment).initiate({ payment, intent, returnUrls })
}

async function verifyPayment({ payment, callbackPayload }) {
  return getPaymentProvider(payment).verify({ payment, callbackPayload })
}

module.exports = { initiatePayment, verifyPayment }
