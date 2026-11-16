const cors = require('cors')
const express = require('express')
const env = require('./config/env')
const { notFoundHandler } = require('./middlewares/not-found')
const errorHandler = require('./middlewares/error-handler')
const requestLogger = require('./middlewares/request-logger')
const createApiRouter = require('./routes')

function createApp({
  authenticate,
  institutionRouterOptions,
  registrationOptions,
  paymentOptions,
  subscriptionRouterOptions,
} = {}) {
  const app = express()

  app.set('trust proxy', 1)
  app.use(cors({ origin: env.CLIENT_ORIGIN }))
  app.use(requestLogger)
  app.use(express.json({ limit: '1mb' }))
  app.use(
    '/api',
    createApiRouter({
      authenticate,
      institutionRouterOptions,
      registrationOptions,
      paymentOptions,
      subscriptionRouterOptions,
    }),
  )
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

module.exports = createApp()
module.exports.createApp = createApp
