const ApiError = require('../utils/api-error')

function createRateLimiter({
  windowMs,
  max,
  keyGenerator,
  code = 'RATE_LIMITED',
  message = 'Too many requests. Please try again later.',
  maxEntries = 20000,
}) {
  if (!Number.isInteger(windowMs) || windowMs < 1) {
    throw new TypeError('Rate limit windowMs must be a positive integer')
  }
  if (!Number.isInteger(max) || max < 1) {
    throw new TypeError('Rate limit max must be a positive integer')
  }
  if (typeof keyGenerator !== 'function') {
    throw new TypeError('Rate limiter requires a key generator')
  }

  const buckets = new Map()
  let requestsSinceCleanup = 0

  return function rateLimit(req, res, next) {
    const now = Date.now()
    const key = String(keyGenerator(req) || 'unknown')
    let bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size >= maxEntries) {
        for (const [bucketKey, entry] of buckets) {
          if (entry.resetAt <= now) buckets.delete(bucketKey)
        }
      }

      if (buckets.size >= maxEntries && !buckets.has(key)) {
        return next(new ApiError(503, 'RATE_LIMIT_CAPACITY', 'Rate limiting is temporarily unavailable'))
      }

      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    requestsSinceCleanup += 1
    if (requestsSinceCleanup >= 1000) {
      for (const [bucketKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(bucketKey)
      }
      requestsSinceCleanup = 0
    }

    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count - 1)))
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count >= max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))))
      return next(new ApiError(429, code, message))
    }

    bucket.count += 1
    return next()
  }
}

function ipKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

module.exports = { createRateLimiter, ipKey }
