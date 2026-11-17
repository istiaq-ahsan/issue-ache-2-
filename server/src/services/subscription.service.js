const env = require('../config/env')
const { getPlan } = require('../config/plans')
const ApiError = require('../utils/api-error')
const { notifyInstitutionAdministrator } = require('../utils/institution-notification')
const paymentService = require('./payment/paymentService')
const {
  getDepartmentsOverAuthorityLimit,
  planDowngradeBlockedError,
} = require('./authority-limit.service')

function getDatabase() {
  return require('../config/prisma')
}

function minorUnits(value) {
  const text = value?.toString()
  if (typeof text !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

function providerResponseData(raw) {
  if (raw === undefined || raw === null) return {}
  const redact = (value) => {
    if (Array.isArray(value)) return value.map(redact)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/(password|token|secret|authorization|credential|private.?key)/i.test(key))
        .map(([key, entry]) => [key, redact(entry)]),
    )
  }
  return { rawResponse: redact(raw) }
}

function subscriptionExpired(subscription, now) {
  if (subscription.status === 'TRIALING') {
    return !subscription.trialEndsAt || subscription.trialEndsAt <= now
  }
  return subscription.endsAt <= now
}

function inactiveSubscriptionError(subscription) {
  return new ApiError(
    402,
    'SUBSCRIPTION_INACTIVE',
    'The institution subscription is inactive. Renew the subscription to continue.',
    subscription
      ? {
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          planCode: subscription.planCode,
        }
      : undefined,
  )
}

async function expireEndedSubscriptions(database, institutionId, now = new Date()) {
  const where = {
    departmentId: null,
    status: 'TRIALING',
    trialEndsAt: { lte: now },
    ...(institutionId ? { institutionId } : {}),
  }
  const activeExpiredWhere = {
    departmentId: null,
    status: 'ACTIVE',
    endsAt: { lte: now },
    ...(institutionId ? { institutionId } : {}),
  }

  const [expiredTrials, expiredPaid] = await Promise.all([
    database.subscription.updateMany({
      where,
      data: { status: 'EXPIRED' },
    }),
    database.subscription.updateMany({
      where: activeExpiredWhere,
      data: { status: 'EXPIRED' },
    }),
  ])
  return expiredTrials.count + expiredPaid.count
}

async function getCurrentSubscription(institutionId, {
  database = getDatabase(),
  now = new Date(),
} = {}) {
  await expireEndedSubscriptions(database, institutionId, now)
  return database.subscription.findFirst({
    where: {
      institutionId,
      departmentId: null,
      status: { in: ['ACTIVE', 'TRIALING'] },
      startsAt: { lte: now },
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      institutionId: true,
      planName: true,
      planCode: true,
      billingCycle: true,
      status: true,
      startsAt: true,
      endsAt: true,
      trialEndsAt: true,
    },
  })
}

async function ensureActiveSubscription(institutionId, options = {}) {
  const now = options.now || new Date()
  const database = options.database || getDatabase()
  const subscription = await getCurrentSubscription(institutionId, { ...options, database })
  if (subscription && subscriptionExpired(subscription, now)) {
    await database.subscription.updateMany({
      where: { id: subscription.id, status: subscription.status },
      data: { status: 'EXPIRED' },
    })
  }
  if (!subscription || subscriptionExpired(subscription, now)) {
    throw inactiveSubscriptionError(subscription)
  }
  return subscription
}

function assertPlanLimit(subscription, resource, currentCount) {
  const plan = getPlan(subscription.planCode)
  const limit = plan?.limits?.[resource]
  if (!Number.isInteger(limit)) {
    throw new ApiError(
      409,
      'SUBSCRIPTION_PLAN_INVALID',
      'The institution subscription does not have a valid plan limit',
    )
  }
  if (currentCount >= limit) {
    throw new ApiError(
      409,
      'PLAN_LIMIT_REACHED',
      'The member limit for this plan has been reached',
      { limit, current: currentCount, resource },
    )
  }
  return limit
}

function addMonths(date, months) {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

function endDate(startedAt, billingCycle) {
  return addMonths(startedAt, billingCycle === 'MONTHLY' ? 1 : 12)
}

async function getBillingSummary(institutionId, {
  database = getDatabase(),
  now = new Date(),
} = {}) {
  await expireEndedSubscriptions(database, institutionId, now)
  const [current, subscriptions, payments] = await Promise.all([
    database.subscription.findFirst({
      where: { institutionId, departmentId: null, startsAt: { lte: now } },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        planName: true,
        planCode: true,
        billingCycle: true,
        status: true,
        startsAt: true,
        endsAt: true,
        trialEndsAt: true,
      },
    }),
    database.subscription.findMany({
      where: { institutionId, departmentId: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        planName: true,
        planCode: true,
        billingCycle: true,
        status: true,
        startsAt: true,
        endsAt: true,
        trialEndsAt: true,
        createdAt: true,
      },
    }),
    database.payment.findMany({
      where: { institutionId, departmentId: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        subscriptionId: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        planCode: true,
        billingCycle: true,
        createdAt: true,
      },
    }),
  ])
  return { current, subscriptions, payments }
}

async function startSubscriptionRenewal(institutionId, actorId, input, {
  database = getDatabase(),
  payment = paymentService,
} = {}) {
  const plan = getPlan(input.planCode)
  const amount = plan?.prices?.[input.billingCycle]
  if (!plan || !amount) {
    throw new ApiError(400, 'INVALID_SUBSCRIPTION_PLAN', 'The selected plan or billing cycle is not available')
  }
  if (plan.code === 'BASIC') {
    const overLimitDepartments = await getDepartmentsOverAuthorityLimit(
      database,
      institutionId,
      plan.code,
    )
    if (overLimitDepartments.length > 0) {
      throw planDowngradeBlockedError(overLimitDepartments)
    }
  }

  const pendingPayment = await database.payment.findFirst({
    where: {
      institutionId,
      departmentId: null,
      registrationIntentId: null,
      status: 'PENDING',
    },
    select: { id: true },
  })
  if (pendingPayment) {
    throw new ApiError(
      409,
      'SUBSCRIPTION_PAYMENT_PENDING',
      'An institution subscription payment is already pending',
      { paymentId: pendingPayment.id },
    )
  }

  const provider = env.PAYMENT_PROVIDER.toUpperCase()
  const paymentRecord = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`subscription-payment:${institutionId}`}))`
    const pending = await transaction.payment.findFirst({
      where: {
        institutionId,
        departmentId: null,
        registrationIntentId: null,
        status: 'PENDING',
      },
      select: { id: true },
    })
    if (pending) {
      throw new ApiError(
        409,
        'SUBSCRIPTION_PAYMENT_PENDING',
        'An institution subscription payment is already pending',
        { paymentId: pending.id },
      )
    }

    const created = await transaction.payment.create({
      data: {
        institutionId,
        amount: amount.toFixed(2),
        currency: plan.currency,
        status: 'PENDING',
        provider,
        planCode: plan.code,
        billingCycle: input.billingCycle,
      },
    })
    await transaction.auditLog.create({
      data: {
        institutionId,
        actorId,
        action: 'SUBSCRIPTION_PAYMENT_INITIATED',
        entityType: 'Payment',
        entityId: created.id,
        metadata: { planCode: plan.code, billingCycle: input.billingCycle },
      },
    })
    return created
  })

  try {
    const initiation = await payment.initiatePayment({
      payment: paymentRecord,
      intent: null,
      returnUrls: {},
    })
    if (
      typeof initiation?.redirectUrl !== 'string' ||
      typeof initiation?.providerTransactionId !== 'string' ||
      initiation.providerTransactionId.length === 0
    ) {
      throw new Error('Payment provider returned an invalid initiation response')
    }
    await database.payment.update({
      where: { id: paymentRecord.id },
      data: { providerTransactionId: initiation.providerTransactionId },
    })
    return { redirectUrl: initiation.redirectUrl, paymentId: paymentRecord.id }
  } catch (error) {
    await database.payment.updateMany({
      where: { id: paymentRecord.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    })
    if (/not implemented/i.test(error?.message || '')) {
      throw new ApiError(501, 'PAYMENT_PROVIDER_NOT_IMPLEMENTED', 'The selected payment provider is not implemented yet')
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'PAYMENT_INITIATION_FAILED', 'The payment provider could not start this payment')
  }
}

function verifySubscriptionPaymentAmount(record, verification, plan) {
  const expected = minorUnits(plan.prices[record.billingCycle])
  if (
    expected === null ||
    minorUnits(record.amount) !== expected ||
    record.planCode !== plan.code ||
    record.currency !== plan.currency
  ) {
    throw new ApiError(409, 'PAYMENT_AMOUNT_MISMATCH', 'The payment amount does not match the subscription plan')
  }

  const raw = verification.raw && typeof verification.raw === 'object' ? verification.raw : {}
  const reportedAmount = raw.amount ?? raw.Amount
  const reportedCurrency = raw.currency ?? raw.currency_type
  if (reportedAmount !== undefined && minorUnits(reportedAmount) !== expected) {
    throw new ApiError(409, 'PAYMENT_AMOUNT_MISMATCH', 'The verified provider amount does not match the subscription plan')
  }
  if (
    record.provider === 'SSLCOMMERZ' &&
    (reportedAmount === undefined || reportedCurrency === undefined)
  ) {
    throw new ApiError(502, 'PAYMENT_AMOUNT_UNVERIFIED', 'The payment provider did not return a verifiable amount and currency')
  }
  if (reportedCurrency !== undefined && String(reportedCurrency).toUpperCase() !== record.currency) {
    throw new ApiError(409, 'PAYMENT_CURRENCY_MISMATCH', 'The verified provider currency does not match the subscription currency')
  }
}

async function processSubscriptionPaymentCallback(paymentId, callbackPayload, {
  database = getDatabase(),
  payment = paymentService,
  now = new Date(),
} = {}) {
  const record = await database.payment.findUnique({ where: { id: paymentId } })
  if (!record || record.registrationIntentId || !record.institutionId || record.departmentId) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Institution subscription payment was not found')
  }
  if (record.status === 'SUCCESSFUL' && record.subscriptionId) {
    return { paymentId: record.id, paymentStatus: record.status, subscriptionId: record.subscriptionId, alreadyProcessed: true }
  }
  if (record.status !== 'PENDING') {
    return { paymentId: record.id, paymentStatus: record.status, subscriptionId: record.subscriptionId, alreadyProcessed: true }
  }

  const plan = getPlan(record.planCode)
  if (!plan || !record.billingCycle || !plan.prices[record.billingCycle]) {
    throw new ApiError(409, 'SUBSCRIPTION_PLAN_INVALID', 'The payment does not reference a valid subscription plan')
  }
  const verification = await payment.verifyPayment({ payment: record, callbackPayload })
  if (!['SUCCESSFUL', 'FAILED', 'CANCELLED'].includes(verification.status)) {
    throw new ApiError(400, 'INVALID_PAYMENT_STATUS', 'The provider returned an unsupported payment status')
  }
  if (verification.status === 'SUCCESSFUL') {
    verifySubscriptionPaymentAmount(record, verification, plan)
  }

  try {
    const result = await database.$transaction(async (transaction) => {
      const changed = await transaction.payment.updateMany({
        where: { id: record.id, status: 'PENDING', subscriptionId: null },
        data: {
          status: verification.status,
          ...providerResponseData(verification.raw),
        },
      })
      if (changed.count !== 1) {
        throw new ApiError(409, 'PAYMENT_ALREADY_PROCESSED', 'This subscription payment has already been processed')
      }

      if (verification.status !== 'SUCCESSFUL') {
        await transaction.auditLog.create({
          data: {
            institutionId: record.institutionId,
            action: `SUBSCRIPTION_PAYMENT_${verification.status}`,
            entityType: 'Payment',
            entityId: record.id,
          },
        })
        return { subscription: null }
      }

      const overLimitDepartments = plan.code === 'BASIC'
        ? await getDepartmentsOverAuthorityLimit(transaction, record.institutionId, plan.code)
        : []
      const currentSubscription = await transaction.subscription.findFirst({
        where: {
          institutionId: record.institutionId,
          departmentId: null,
          status: { in: ['ACTIVE', 'TRIALING'] },
          startsAt: { lte: now },
        },
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          status: true,
          endsAt: true,
          trialEndsAt: true,
        },
      })
      const currentEnd = currentSubscription?.status === 'TRIALING'
        ? currentSubscription.trialEndsAt
        : currentSubscription?.endsAt
      const startsAt = currentEnd && currentEnd > now ? currentEnd : now
      const subscription = await transaction.subscription.create({
        data: {
          institutionId: record.institutionId,
          departmentId: null,
          planName: plan.name,
          planCode: plan.code,
          billingCycle: record.billingCycle,
          status: 'ACTIVE',
          startsAt,
          endsAt: endDate(startsAt, record.billingCycle),
          trialEndsAt: null,
        },
        select: {
          id: true,
          planName: true,
          planCode: true,
          billingCycle: true,
          status: true,
          startsAt: true,
          endsAt: true,
        },
      })
      await transaction.payment.update({
        where: { id: record.id },
        data: { subscriptionId: subscription.id },
      })
      await transaction.auditLog.create({
        data: {
          institutionId: record.institutionId,
          action: 'SUBSCRIPTION_PAYMENT_SUCCESSFUL',
          entityType: 'Payment',
          entityId: record.id,
          metadata: { subscriptionId: subscription.id, planCode: plan.code },
        },
      })
      await transaction.auditLog.create({
        data: {
          institutionId: record.institutionId,
          action: 'SUBSCRIPTION_CREATED',
          entityType: 'Subscription',
          entityId: subscription.id,
          metadata: {
            planCode: plan.code,
            billingCycle: record.billingCycle,
            startsAt: startsAt.toISOString(),
            ...(overLimitDepartments.length > 0 ? { overLimitDepartments } : {}),
          },
        },
      })
      await notifyInstitutionAdministrator(transaction, {
        institutionId: record.institutionId,
        type: 'SUBSCRIPTION_PAYMENT_SUCCESSFUL',
        title: overLimitDepartments.length > 0
          ? 'Subscription payment successful; Authority limits need attention'
          : 'Subscription payment successful',
        message: overLimitDepartments.length > 0
          ? `${plan.name} ${record.billingCycle.toLowerCase()} subscription is scheduled to start ${startsAt.toLocaleDateString()}. Reduce enabled Authorities to ${getPlan('BASIC').limits.maxAuthoritiesPerDepartment} in these departments before the term starts: ${overLimitDepartments.map(({ name, enabledAuthorities }) => `${name} (${enabledAuthorities})`).join(', ')}.`
          : `${plan.name} ${record.billingCycle.toLowerCase()} subscription is scheduled to start ${startsAt.toLocaleDateString()}.`,
        relatedEntityType: 'Subscription',
        relatedEntityId: subscription.id,
      })
      return { subscription, overLimitDepartments }
    })

    return {
      paymentId: record.id,
      paymentStatus: verification.status,
      subscriptionId: result.subscription?.id || null,
      subscription: result.subscription,
      ...(result.overLimitDepartments?.length > 0
        ? { overLimitDepartments: result.overLimitDepartments }
        : {}),
      alreadyProcessed: false,
    }
  } catch (error) {
    if (error.code !== 'PAYMENT_ALREADY_PROCESSED') throw error
    const latest = await database.payment.findUnique({ where: { id: record.id } })
    if (latest?.status === 'SUCCESSFUL' && latest.subscriptionId) {
      return {
        paymentId: latest.id,
        paymentStatus: latest.status,
        subscriptionId: latest.subscriptionId,
        alreadyProcessed: true,
      }
    }
    throw error
  }
}

module.exports = {
  assertPlanLimit,
  ensureActiveSubscription,
  expireEndedSubscriptions,
  getBillingSummary,
  getCurrentSubscription,
  processSubscriptionPaymentCallback,
  startSubscriptionRenewal,
}
