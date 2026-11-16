const env = require('../../../config/env')
const demoProvider = require('./demoProvider')
const sslcommerzProvider = require('./sslcommerzProvider')

const providers = {
  demo: demoProvider,
  sslcommerz: sslcommerzProvider,
}

function getProvider(name = env.PAYMENT_PROVIDER) {
  const provider = providers[name]

  if (!provider) {
    throw new Error(`Unsupported payment provider: ${name}`)
  }

  return provider
}

module.exports = { getProvider }
