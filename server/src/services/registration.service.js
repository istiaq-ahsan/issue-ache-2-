const { randomBytes } = require('node:crypto')
const env = require('../config/env')
const { getPlan } = require('../config/plans')
const { getFirebaseAuth } = require('../config/firebase-admin')
const ApiError = require('../utils/api-error')
const paymentService = require('./payment/paymentService')
const {
  expireEndedSubscriptions,
  processSubscriptionPaymentCallback,
} = require('./subscription.service')

function getDatabase() {
  return require('../config/prisma')
}

function normalizeInstitutionName(name) {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function generateInstitutionCode() {
  return `IA-${randomBytes(6).toString('hex').toUpperCase()}`
}

function uniqueConstraintTarget(error) {
  if (error?.code !== 'P2002') return ''
  const target = error.meta?.target
  return Array.isArray(target) ? target.join(',') : String(target || '')
}

function firebaseErrorCode(error) {
  return typeof error?.code === 'string' ? error.code : 'unknown'
}

function isFirebaseUserNotFound(error) {
  return error?.code === 'auth/user-not-found'
}

function isFirebaseEmailConflict(error) {
  return error?.code === 'auth/email-already-exists'
}

function redactProviderResponse(value) {
  if (Array.isArray(value)) return value.map(redactProviderResponse)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(password|token|secret|authorization|credential|private.?key)/i.test(key))
      .map(([key, entry]) => [key, redactProviderResponse(entry)]),
  )
}

function providerResponseData(raw) {
  return raw === undefined || raw === null
    ? {}
    : { rawResponse: redactProviderResponse(raw) }
}

function duplicateInstitutionError(field) {
  if (field === 'contactEmail') {
    return new ApiError(
      409,
      'INSTITUTION_CONTACT_EMAIL_EXISTS',
      'An institution is already registered with this contact email',
    )
  }

  return new ApiError(
    409,
    'INSTITUTION_ALREADY_EXISTS',
    'An institution with this name is already registered',
  )
}

function duplicateIntentField(record, normalizedName, contactEmail) {
  if (record.contactEmail === contactEmail) return 'contactEmail'
  if (record.normalizedName === normalizedName) return 'normalizedName'
  return 'normalizedName'
}

async function assertRegistrationAvailable(
  database,
  { normalizedName, contactEmail, adminEmail, now },
) {
  const existingInstitution = await database.institution.findFirst({
    where: { OR: [{ normalizedName }, { contactEmail }] },
    select: { normalizedName: true, contactEmail: true },
  })

  if (existingInstitution) {
    throw duplicateInstitutionError(
      existingInstitution.contactEmail === contactEmail ? 'contactEmail' : 'normalizedName',
    )
  }

  const existingIntent = await database.registrationIntent.findFirst({
    where: {
      status: 'PENDING_PAYMENT',
      expiresAt: { gt: now },
      OR: [{ normalizedName }, { contactEmail }],
    },
    select: { normalizedName: true, contactEmail: true },
  })

  if (existingIntent) {
    throw duplicateInstitutionError(
      duplicateIntentField(existingIntent, normalizedName, contactEmail),
    )
  }

  const existingUser = await database.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  })

  if (existingUser) {
    throw new ApiError(
      409,
      'ADMIN_EMAIL_ALREADY_REGISTERED',
      'An application account already uses this administrator email',
    )
  }
}

async function deleteFirebaseUser(firebaseAuth, firebaseUid, logger, context) {
  let lastError

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await firebaseAuth.deleteUser(firebaseUid)
      return
    } catch (error) {
      if (isFirebaseUserNotFound(error)) return
      lastError = error
    }
  }

  logger.error('Registration Firebase cleanup failed', {
    context,
    errorCode: firebaseErrorCode(lastError),
  })
  throw new ApiError(
    500,
    'REGISTRATION_FIREBASE_CLEANUP_FAILED',
    'Registration could not be completed and its Firebase account could not be removed. Contact support.',
  )
}

async function enableFirebaseUser(firebaseAuth, firebaseUid, logger) {
  let lastError

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await firebaseAuth.updateUser(firebaseUid, { disabled: false })
      return
    } catch (error) {
      lastError = error
    }
  }

  logger.error('Registration Firebase activation failed', {
    errorCode: firebaseErrorCode(lastError),
  })
  throw new ApiError(
    503,
    'REGISTRATION_FIREBASE_ENABLE_FAILED',
    'Registration is saved, but administrator sign-in could not be enabled. Retry completion.',
  )
}

function minorUnits(value) {
  const text = value?.toString()
  if (typeof text !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

function assertPaymentAmountMatches(payment, intent, verification, plan) {
  const expectedAmount = minorUnits(plan.prices[intent.billingCycle])
  const intentAmount = minorUnits(intent.amount)
  const paymentAmount = minorUnits(payment.amount)

  if (
    expectedAmount === null ||
    intentAmount !== expectedAmount ||
    paymentAmount === null ||
    expectedAmount !== paymentAmount ||
    payment.planCode !== intent.planCode ||
    payment.billingCycle !== intent.billingCycle ||
    payment.currency !== intent.currency ||
    intent.currency !== plan.currency
  ) {
    throw new ApiError(
      409,
      'PAYMENT_AMOUNT_MISMATCH',
      'The payment amount does not match the registration plan',
    )
  }

  const reportedAmount =
    verification.raw && typeof verification.raw === 'object'
      ? verification.raw.amount ?? verification.raw.Amount
      : undefined

  if (reportedAmount !== undefined && minorUnits(reportedAmount) !== expectedAmount) {
    throw new ApiError(
      409,
      'PAYMENT_AMOUNT_MISMATCH',
      'The verified provider amount does not match the registration plan',
    )
  }

  const reportedCurrency =
    verification.raw && typeof verification.raw === 'object'
      ? verification.raw.currency ?? verification.raw.currency_type
      : undefined

  if (
    payment.provider === 'SSLCOMMERZ' &&
    (reportedAmount === undefined || reportedCurrency === undefined)
  ) {
    throw new ApiError(
      502,
      'PAYMENT_AMOUNT_UNVERIFIED',
      'The payment provider did not return a verifiable amount and currency',
    )
  }

  if (
    reportedCurrency !== undefined &&
    String(reportedCurrency).toUpperCase() !== intent.currency
  ) {
    throw new ApiError(
      409,
      'PAYMENT_CURRENCY_MISMATCH',
      'The verified provider currency does not match the registration currency',
    )
  }
}

function addMonths(date, months) {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

function subscriptionEndDate(startedAt, billingCycle) {
  return billingCycle === 'MONTHLY'
    ? addMonths(startedAt, 1)
    : addMonths(startedAt, 12)
}

function institutionCodeConflict(error) {
  return uniqueConstraintTarget(error).includes('institutionCode')
}

async function createRegistrationRecords(database, input, firebaseUid, plan, now, isTrial) {
  const amount = isTrial ? 0 : plan.prices[input.billingCycle]
  const provider = env.PAYMENT_PROVIDER.toUpperCase()
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000)

  return database.$transaction(async (transaction) => {
    const lockKeys = [
      `registration-name:${normalizeInstitutionName(input.institutionName)}`,
      `registration-contact:${normalizeEmail(input.contactEmail)}`,
    ].sort()
    for (const lockKey of lockKeys) {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
    }

    await assertRegistrationAvailable(transaction, {
      normalizedName: normalizeInstitutionName(input.institutionName),
      contactEmail: normalizeEmail(input.contactEmail),
      adminEmail: normalizeEmail(input.adminEmail),
      now,
    })

    const intent = await transaction.registrationIntent.create({
      data: {
        planCode: plan.code,
        billingCycle: input.billingCycle,
        status: 'PENDING_PAYMENT',
        amount: amount.toFixed(2),
        currency: plan.currency,
        institutionName: input.institutionName.trim(),
        normalizedName: normalizeInstitutionName(input.institutionName),
        contactPersonName: input.contactPersonName.trim(),
        contactEmail: normalizeEmail(input.contactEmail),
        campusType: input.campusType.trim(),
        campusSize: input.campusSize.trim(),
        location: input.location.trim(),
        adminName: input.adminName.trim(),
        adminEmail: normalizeEmail(input.adminEmail),
        firebaseUid,
        expiresAt,
      },
    })

    if (isTrial) return { intent, payment: null }

    const payment = await transaction.payment.create({
      data: {
        registrationIntentId: intent.id,
        amount: amount.toFixed(2),
        currency: plan.currency,
        status: 'PENDING',
        provider,
        planCode: plan.code,
        billingCycle: input.billingCycle,
      },
    })

    return { intent, payment }
  })
}

async function failPaymentStart(database, intentId, paymentId) {
  await database.$transaction(async (transaction) => {
    await transaction.registrationIntent.updateMany({
      where: { id: intentId, status: 'PENDING_PAYMENT' },
      data: { status: 'FAILED' },
    })
    if (paymentId) {
      await transaction.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: { status: 'FAILED' },
      })
    }
  })
}

async function startRegistration(input, {
  database = getDatabase(),
  firebaseAuth = getFirebaseAuth(),
  payment = paymentService,
  logger = console,
  now = new Date(),
} = {}) {
  const plan = getPlan(input.planCode)
  if (!plan) {
    throw new ApiError(400, 'INVALID_PLAN', 'The selected plan is not available')
  }
  if (!plan.prices[input.billingCycle]) {
    throw new ApiError(400, 'INVALID_BILLING_CYCLE', 'The selected billing cycle is not available')
  }

  const normalizedName = normalizeInstitutionName(input.institutionName)
  const contactEmail = normalizeEmail(input.contactEmail)
  const adminEmail = normalizeEmail(input.adminEmail)
  const isTrial = input.planCode === 'BASIC' && plan.trialDays > 0 && input.startTrial

  await assertRegistrationAvailable(database, {
    normalizedName,
    contactEmail,
    adminEmail,
    now,
  })

  let firebaseUser
  try {
    firebaseUser = await firebaseAuth.createUser({
      email: adminEmail,
      password: input.password,
      displayName: input.adminName.trim(),
      disabled: true,
    })
  } catch (error) {
    if (isFirebaseEmailConflict(error)) {
      throw new ApiError(
        409,
        'ADMIN_EMAIL_ALREADY_REGISTERED',
        'A Firebase account already uses this administrator email',
      )
    }
    if (
      error?.code === 'auth/invalid-email' ||
      error?.code === 'auth/weak-password' ||
      error?.code === 'auth/invalid-password'
    ) {
      throw new ApiError(
        400,
        'INVALID_ADMIN_CREDENTIALS',
        'The administrator email or password is not accepted',
      )
    }
    throw error
  }

  let records
  try {
    records = await createRegistrationRecords(
      database,
      input,
      firebaseUser.uid,
      plan,
      now,
      isTrial,
    )
  } catch (error) {
    await deleteFirebaseUser(firebaseAuth, firebaseUser.uid, logger, 'registration-start')
    const target = uniqueConstraintTarget(error)
    if (target.includes('normalizedName')) throw duplicateInstitutionError('normalizedName')
    if (target.includes('contactEmail')) throw duplicateInstitutionError('contactEmail')
    if (target.includes('email')) {
      throw new ApiError(
        409,
        'ADMIN_EMAIL_ALREADY_REGISTERED',
        'An application account already uses this administrator email',
      )
    }
    throw error
  }

  if (isTrial) {
    const result = await completeRegistration(records.intent.id, {
      database,
      firebaseAuth,
      payment,
      logger,
      now,
      subscriptionStatus: 'TRIALING',
    })
    return {
      registrationStatus: 'COMPLETED',
      subscriptionStatus: 'TRIALING',
      institution: result.institution,
    }
  }

  let initiation
  try {
    initiation = await payment.initiatePayment({
      payment: records.payment,
      intent: records.intent,
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
      where: { id: records.payment.id },
      data: { providerTransactionId: initiation.providerTransactionId },
    })
  } catch (error) {
    try {
      await failPaymentStart(database, records.intent.id, records.payment.id)
    } catch (stateError) {
      logger.error('Failed to close registration after payment initiation error', {
        intentId: records.intent.id,
        errorCode: stateError?.code || stateError?.name,
      })
    }
    await deleteFirebaseUser(firebaseAuth, firebaseUser.uid, logger, 'payment-initiation')

    if (/not implemented/i.test(error?.message || '')) {
      throw new ApiError(
        501,
        'PAYMENT_PROVIDER_NOT_IMPLEMENTED',
        'The selected payment provider is not implemented yet',
      )
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(
      502,
      'PAYMENT_INITIATION_FAILED',
      'The payment provider could not start this payment',
    )
  }

  return { redirectUrl: initiation.redirectUrl, paymentId: records.payment.id }
}

async function findIntentOrThrow(database, intentId) {
  const intent = await database.registrationIntent.findUnique({
    where: { id: intentId },
    include: {
      payment: true,
      institution: {
        select: { id: true, name: true, institutionCode: true, createdAt: true },
      },
    },
  })
  if (!intent) {
    throw new ApiError(404, 'REGISTRATION_INTENT_NOT_FOUND', 'Registration was not found')
  }
  return intent
}

function assertTrialIntent(intent) {
  const plan = getPlan(intent.planCode)
  if (
    intent.planCode !== 'BASIC' ||
    !plan?.trialDays ||
    !plan.prices[intent.billingCycle] ||
    intent.currency !== plan.currency ||
    intent.payment ||
    minorUnits(intent.amount) !== 0n
  ) {
    throw new ApiError(409, 'TRIAL_NOT_AVAILABLE', 'This registration is not eligible for a trial')
  }
  return plan
}

async function completeRegistration(intentId, {
  database = getDatabase(),
  firebaseAuth = getFirebaseAuth(),
  payment = paymentService,
  logger = console,
  now = new Date(),
  subscriptionStatus = 'ACTIVE',
  callbackPayload,
  verifiedPayment,
} = {}) {
  const intent = await findIntentOrThrow(database, intentId)

  if (intent.status === 'COMPLETED') {
    if (!intent.institution) {
      throw new Error('Completed registration intent has no linked institution')
    }
    await enableFirebaseUser(firebaseAuth, intent.firebaseUid, logger)
    return { institution: intent.institution, subscriptionStatus, alreadyCompleted: true }
  }

  if (intent.status !== 'PENDING_PAYMENT') {
    throw new ApiError(409, 'REGISTRATION_NOT_PENDING', 'This registration cannot be completed')
  }

  if (intent.expiresAt <= now) {
    throw new ApiError(410, 'REGISTRATION_INTENT_EXPIRED', 'This registration checkout has expired')
  }

  const isTrial = subscriptionStatus === 'TRIALING'
  const plan = isTrial ? assertTrialIntent(intent) : getPlan(intent.planCode)
  if (!plan) {
    throw new Error('Registration intent references an unknown plan')
  }

  let verification = verifiedPayment
  if (!isTrial) {
    if (!intent.payment) {
      throw new ApiError(409, 'REGISTRATION_PAYMENT_REQUIRED', 'A successful payment is required')
    }
    if (intent.payment.status === 'FAILED' || intent.payment.status === 'CANCELLED') {
      throw new ApiError(409, 'PAYMENT_NOT_PENDING', 'This payment cannot be completed')
    }
    verification =
      verification ||
      (await payment.verifyPayment({
        payment: intent.payment,
        callbackPayload,
      }))
    if (verification.status !== 'SUCCESSFUL') {
      throw new ApiError(402, 'PAYMENT_NOT_SUCCESSFUL', 'The payment has not been verified as successful')
    }
    assertPaymentAmountMatches(intent.payment, intent, verification, plan)
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const institutionCode = generateInstitutionCode()

    try {
      const result = await database.$transaction(async (transaction) => {
        const currentIntent = await transaction.registrationIntent.findUnique({
          where: { id: intentId },
          include: {
            payment: true,
            institution: {
              select: { id: true, name: true, institutionCode: true, createdAt: true },
            },
          },
        })

        if (currentIntent.status === 'COMPLETED') {
          return {
            institution: currentIntent.institution,
            subscriptionStatus,
            alreadyCompleted: true,
          }
        }
        if (
          currentIntent.status !== 'PENDING_PAYMENT' ||
          currentIntent.expiresAt <= now
        ) {
          throw new ApiError(
            409,
            'REGISTRATION_NOT_PENDING',
            'This registration is no longer available for completion',
          )
        }

        const user = await transaction.user.create({
          data: {
            firebaseUid: currentIntent.firebaseUid,
            email: currentIntent.adminEmail,
            name: currentIntent.adminName,
          },
          select: { id: true },
        })
        const institution = await transaction.institution.create({
          data: {
            name: currentIntent.institutionName,
            normalizedName: currentIntent.normalizedName,
            institutionCode,
            contactPersonName: currentIntent.contactPersonName,
            contactEmail: currentIntent.contactEmail,
            campusType: currentIntent.campusType,
            campusSize: currentIntent.campusSize,
            location: currentIntent.location,
            adminUserId: user.id,
          },
          select: { id: true, name: true, institutionCode: true, createdAt: true },
        })

        const startsAt = now
        const trialEndsAt = isTrial
          ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
          : null
        const endsAt = isTrial
          ? trialEndsAt
          : subscriptionEndDate(startsAt, currentIntent.billingCycle)
        const subscription = await transaction.subscription.create({
          data: {
            institutionId: institution.id,
            departmentId: null,
            planName: plan.name,
            planCode: currentIntent.planCode,
            billingCycle: currentIntent.billingCycle,
            status: subscriptionStatus,
            startsAt,
            endsAt,
            trialEndsAt,
          },
        })

        if (!isTrial) {
          const paymentUpdate = await transaction.payment.updateMany({
            where: { id: currentIntent.payment.id, status: 'PENDING' },
            data: {
              institutionId: institution.id,
              subscriptionId: subscription.id,
              status: 'SUCCESSFUL',
              ...providerResponseData(verification.raw),
            },
          })
          if (paymentUpdate.count !== 1) {
            throw new ApiError(
              409,
              'PAYMENT_NOT_PENDING',
              'This registration payment is no longer pending',
            )
          }
        }

        const intentUpdate = await transaction.registrationIntent.updateMany({
          where: { id: currentIntent.id, status: 'PENDING_PAYMENT' },
          data: { status: 'COMPLETED', institutionId: institution.id },
        })
        if (intentUpdate.count !== 1) {
          throw new ApiError(
            409,
            'REGISTRATION_NOT_PENDING',
            'This registration is no longer available for completion',
          )
        }

        await transaction.auditLog.create({
          data: {
            institutionId: institution.id,
            actorId: user.id,
            action: 'INSTITUTION_CREATED',
            entityType: 'Institution',
            entityId: institution.id,
            metadata: { institutionCode, planCode: currentIntent.planCode },
          },
        })
        await transaction.auditLog.create({
          data: {
            institutionId: institution.id,
            actorId: user.id,
            action: 'SUBSCRIPTION_CREATED',
            entityType: 'Subscription',
            entityId: subscription.id,
            metadata: {
              planCode: currentIntent.planCode,
              billingCycle: currentIntent.billingCycle,
              status: subscriptionStatus,
            },
          },
        })
        if (!isTrial) {
          await transaction.auditLog.create({
            data: {
              institutionId: institution.id,
              actorId: user.id,
              action: 'PAYMENT_SUCCESSFUL',
              entityType: 'Payment',
              entityId: currentIntent.payment.id,
              metadata: { amount: currentIntent.payment.amount.toString(), currency: currentIntent.currency },
            },
          })
        }
        await transaction.notification.create({
          data: {
            institutionId: institution.id,
            recipientId: user.id,
            type: 'INSTITUTION_REGISTRATION_COMPLETED',
            title: 'Institution registration complete',
            message: `${institution.name} is ready to use.`,
            relatedEntityType: 'Institution',
            relatedEntityId: institution.id,
          },
        })

        return { institution, subscription, subscriptionStatus, alreadyCompleted: false }
      })

      await enableFirebaseUser(firebaseAuth, intent.firebaseUid, logger)
      return result
    } catch (error) {
      if (error?.code === 'REGISTRATION_FIREBASE_ENABLE_FAILED') throw error
      if (institutionCodeConflict(error) && attempt < 2) continue

      const latestIntent = await database.registrationIntent.findUnique({
        where: { id: intentId },
        include: {
          payment: true,
          institution: {
            select: { id: true, name: true, institutionCode: true, createdAt: true },
          },
        },
      })
      if (latestIntent?.status === 'COMPLETED' && latestIntent.institution) {
        await enableFirebaseUser(firebaseAuth, latestIntent.firebaseUid, logger)
        return {
          institution: latestIntent.institution,
          subscriptionStatus,
          alreadyCompleted: true,
        }
      }

      const target = uniqueConstraintTarget(error)
      if (target.includes('normalizedName')) throw duplicateInstitutionError('normalizedName')
      if (target.includes('contactEmail')) throw duplicateInstitutionError('contactEmail')
      if (target.includes('email')) {
        throw new ApiError(
          409,
          'ADMIN_EMAIL_ALREADY_REGISTERED',
          'An application account already uses this administrator email',
        )
      }
      throw error
    }
  }

  throw new Error('Unable to generate a unique institution code after multiple attempts')
}

async function processPaymentCallback(paymentId, callbackPayload, {
  database = getDatabase(),
  firebaseAuth = getFirebaseAuth(),
  payment = paymentService,
  logger = console,
  now = new Date(),
} = {}) {
  const record = await database.payment.findUnique({
    where: { id: paymentId },
    include: { registrationIntent: true },
  })

  if (!record) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Registration payment was not found')
  }
  if (!record.registrationIntent) {
    return processSubscriptionPaymentCallback(paymentId, callbackPayload, {
      database,
      payment,
      now,
    })
  }

  const intent = record.registrationIntent
  if (record.status === 'SUCCESSFUL' && intent.status === 'COMPLETED') {
    await enableFirebaseUser(firebaseAuth, intent.firebaseUid, logger)
    return { paymentId: record.id, paymentStatus: record.status, registrationStatus: intent.status }
  }

  if (
    (record.status === 'FAILED' || record.status === 'CANCELLED') &&
    (intent.status === 'FAILED' || intent.status === 'CANCELLED')
  ) {
    await deleteFirebaseUser(firebaseAuth, intent.firebaseUid, logger, 'payment-callback')
    return { paymentId: record.id, paymentStatus: record.status, registrationStatus: intent.status }
  }

  if (record.status !== 'PENDING' || intent.status !== 'PENDING_PAYMENT') {
    throw new ApiError(409, 'PAYMENT_NOT_PENDING', 'This registration payment is no longer pending')
  }

  const verification = await payment.verifyPayment({
    payment: record,
    callbackPayload,
  })

  if (verification.status === 'SUCCESSFUL') {
    const result = await completeRegistration(intent.id, {
      database,
      firebaseAuth,
      payment,
      logger,
      now,
      verifiedPayment: verification,
    })
    return {
      paymentId: record.id,
      paymentStatus: 'SUCCESSFUL',
      registrationStatus: 'COMPLETED',
      institution: result.institution,
      subscriptionStatus: result.subscriptionStatus,
      alreadyProcessed: result.alreadyCompleted,
    }
  }

  if (!['FAILED', 'CANCELLED'].includes(verification.status)) {
    throw new ApiError(400, 'INVALID_PAYMENT_STATUS', 'The provider returned an unsupported payment status')
  }

  const result = await database.$transaction(async (transaction) => {
    const currentIntent = await transaction.registrationIntent.findUnique({
      where: { id: intent.id },
      include: { payment: true },
    })
    if (currentIntent.status !== 'PENDING_PAYMENT' || currentIntent.payment.status !== 'PENDING') {
      return {
        paymentStatus: currentIntent.payment.status,
        registrationStatus: currentIntent.status,
        firebaseUid: currentIntent.firebaseUid,
      }
    }

    const paymentUpdate = await transaction.payment.updateMany({
      where: { id: currentIntent.payment.id, status: 'PENDING' },
      data: {
        status: verification.status,
        ...providerResponseData(verification.raw),
      },
    })
    if (paymentUpdate.count !== 1) {
      const latestIntent = await transaction.registrationIntent.findUnique({
        where: { id: currentIntent.id },
        include: { payment: true },
      })
      return {
        paymentStatus: latestIntent.payment.status,
        registrationStatus: latestIntent.status,
        firebaseUid: latestIntent.firebaseUid,
      }
    }

    const intentUpdate = await transaction.registrationIntent.updateMany({
      where: { id: currentIntent.id, status: 'PENDING_PAYMENT' },
      data: {
        status: verification.status === 'FAILED' ? 'FAILED' : 'CANCELLED',
      },
    })
    if (intentUpdate.count !== 1) {
      throw new ApiError(
        409,
        'REGISTRATION_NOT_PENDING',
        'This registration is no longer available for completion',
      )
    }

    return {
      paymentStatus: verification.status,
      registrationStatus: verification.status === 'FAILED' ? 'FAILED' : 'CANCELLED',
      firebaseUid: currentIntent.firebaseUid,
    }
  })

  if (result.registrationStatus === 'FAILED' || result.registrationStatus === 'CANCELLED') {
    await deleteFirebaseUser(firebaseAuth, result.firebaseUid, logger, 'payment-callback')
  }

  return {
    paymentId: record.id,
    paymentStatus: result.paymentStatus,
    registrationStatus: result.registrationStatus,
  }
}

async function getRegistrationStatus(paymentId, database = getDatabase()) {
  const payment = await database.payment.findFirst({
    where: { id: paymentId, registrationIntentId: { not: null } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      registrationIntent: {
        select: { status: true, institutionId: true },
      },
    },
  })

  if (!payment?.registrationIntent) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Registration payment was not found')
  }

  return {
    paymentId: payment.id,
    paymentStatus: payment.status,
    registrationStatus: payment.registrationIntent.status,
    institutionId: payment.registrationIntent.institutionId,
    createdAt: payment.createdAt,
  }
}

async function cleanupExpiredIntents({
  database = getDatabase(),
  firebaseAuth = getFirebaseAuth(),
  logger = console,
  now = new Date(),
} = {}) {
  const subscriptionExpiredCount = await expireEndedSubscriptions(database, null, now)
  const intents = await database.registrationIntent.findMany({
    where: {
      status: { in: ['PENDING_PAYMENT', 'EXPIRED'] },
      expiresAt: { lte: now },
    },
    select: { id: true, firebaseUid: true, status: true },
  })

  let expiredCount = 0
  let deletedCount = 0
  const cleanupFailures = []

  for (const intent of intents) {
    let shouldDelete = intent.status === 'EXPIRED'

    if (intent.status === 'PENDING_PAYMENT') {
      const marked = await database.$transaction(async (transaction) => {
        const update = await transaction.registrationIntent.updateMany({
          where: {
            id: intent.id,
            status: 'PENDING_PAYMENT',
            expiresAt: { lte: now },
          },
          data: { status: 'EXPIRED' },
        })

        if (update.count === 0) return false

        await transaction.payment.updateMany({
          where: { registrationIntentId: intent.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        })
        return true
      })

      if (marked) {
        expiredCount += 1
        shouldDelete = true
      } else {
        const latest = await database.registrationIntent.findUnique({
          where: { id: intent.id },
          select: { status: true },
        })
        shouldDelete = latest?.status === 'EXPIRED'
      }
    }

    if (!shouldDelete) continue

    try {
      await deleteFirebaseUser(firebaseAuth, intent.firebaseUid, logger, 'expired-intent-cleanup')
      deletedCount += 1
    } catch {
      cleanupFailures.push(intent.id)
    }
  }

  if (cleanupFailures.length > 0) {
    logger.error('Expired registration cleanup incomplete', {
      expiredCount,
      cleanupFailureCount: cleanupFailures.length,
    })
    throw new ApiError(
      502,
      'REGISTRATION_CLEANUP_INCOMPLETE',
      'Some expired Firebase accounts could not be removed; the cleanup job should retry',
      { expiredCount, deletedCount, cleanupFailureCount: cleanupFailures.length },
    )
  }

  return { expiredCount, deletedCount, subscriptionExpiredCount }
}

module.exports = {
  assertPaymentAmountMatches,
  cleanupExpiredIntents,
  completeRegistration,
  getRegistrationStatus,
  normalizeEmail,
  normalizeInstitutionName,
  processPaymentCallback,
  startRegistration,
}
