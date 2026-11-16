const { randomUUID } = require('node:crypto')

function requestLogger(req, res, next) {
  const requestId = randomUUID()
  const startedAt = process.hrtime.bigint()
  const path = req.originalUrl.split('?')[0]

  res.locals.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6

    console.info(
      JSON.stringify({
        requestId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      }),
    )
  })

  next()
}

module.exports = requestLogger
