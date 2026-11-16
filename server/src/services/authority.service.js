const { getFirebaseAuth } = require('../config/firebase-admin')
const ApiError = require('../utils/api-error')
const { notifyInstitutionAdministrator } = require('../utils/institution-notification')
const { assertPlanLimit, ensureActiveSubscription } = require('./subscription.service')

function getDatabase() {
  return require('../config/prisma')
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function firebaseErrorCode(error) {
  return typeof error?.code === 'string' ? error.code : 'unknown'
}

function isDuplicateEmailError(error) {
  return error?.code === 'auth/email-already-exists' || error?.code === 'P2002'
}

function duplicateEmailError() {
  return new ApiError(
    409,
    'AUTHORITY_EMAIL_EXISTS',
    'An account already exists with this email address',
  )
}

function authorityNotFoundError() {
  return new ApiError(404, 'AUTHORITY_NOT_FOUND', 'Authority account was not found')
}

function serializeAuthority(membership) {
  return {
    id: membership.id,
    status: membership.status,
    deletedAt: membership.deletedAt,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    user: {
      name: membership.user.name,
      email: membership.user.email,
    },
  }
}

function getAuthoritySelection() {
  return {
    id: true,
    status: true,
    deletedAt: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        firebaseUid: true,
        name: true,
        email: true,
      },
    },
  }
}

function getMembershipWhere(institutionId, membershipId) {
  return {
    id: membershipId,
    institutionId,
    role: 'AUTHORITY',
  }
}

function createAuthority(
  input,
  institutionId,
  actorId,
  {
    database = getDatabase(),
    firebaseAuth = getFirebaseAuth(),
    logger = console,
  } = {},
) {
  return createAuthorityAccount(input, institutionId, actorId, database, firebaseAuth, logger)
}

async function createAuthorityAccount(input, institutionId, actorId, database, firebaseAuth, logger) {
  const subscription = await ensureActiveSubscription(institutionId, { database })
  const authorityCount = await database.institutionMembership.count({
    where: { institutionId, role: 'AUTHORITY', deletedAt: null },
  })
  assertPlanLimit(subscription, 'maxAuthorities', authorityCount)

  const email = normalizeEmail(input.email)
  const existingUser = await database.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingUser) throw duplicateEmailError()

  let firebaseUser
  try {
    firebaseUser = await firebaseAuth.createUser({
      email,
      password: input.password,
      displayName: input.name,
      disabled: false,
    })
  } catch (error) {
    if (isDuplicateEmailError(error)) throw duplicateEmailError()
    if (error?.code === 'auth/invalid-email' || error?.code === 'auth/weak-password') {
      throw new ApiError(400, 'INVALID_AUTHORITY_CREDENTIALS', 'The email or password is not accepted')
    }
    throw error
  }

  try {
    const membership = await database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`authority-limit:${institutionId}`}))`
      const currentSubscription = await ensureActiveSubscription(institutionId, {
        database: transaction,
      })
      const currentAuthorityCount = await transaction.institutionMembership.count({
        where: { institutionId, role: 'AUTHORITY', deletedAt: null },
      })
      assertPlanLimit(currentSubscription, 'maxAuthorities', currentAuthorityCount)

      const user = await transaction.user.create({
        data: {
          firebaseUid: firebaseUser.uid,
          email,
          name: input.name,
        },
        select: { id: true },
      })

      const createdMembership = await transaction.institutionMembership.create({
        data: {
          institutionId,
          userId: user.id,
          role: 'AUTHORITY',
          status: 'ACTIVE',
        },
        select: getAuthoritySelection(),
      })

      await transaction.auditLog.create({
        data: {
          institutionId,
          actorId,
          action: 'AUTHORITY_CREATED',
          entityType: 'InstitutionMembership',
          entityId: createdMembership.id,
          metadata: { email },
        },
      })
      await notifyInstitutionAdministrator(transaction, {
        institutionId,
        type: 'AUTHORITY_CREATED',
        title: 'Authority account created',
        message: `Authority account ${email} was created.`,
        relatedEntityType: 'InstitutionMembership',
        relatedEntityId: createdMembership.id,
      })

      return createdMembership
    })

    return serializeAuthority(membership)
  } catch (error) {
    let cleanupError
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await firebaseAuth.deleteUser(firebaseUser.uid)
        cleanupError = undefined
        break
      } catch (deleteError) {
        cleanupError = deleteError
      }
    }

    if (cleanupError) {
      logger.error('Authority creation compensation failed', {
        firebaseUid: firebaseUser.uid,
        errorCode: firebaseErrorCode(cleanupError),
      })
      throw new ApiError(
        500,
        'AUTHORITY_PROVISIONING_CLEANUP_FAILED',
        'Authority creation failed and the Firebase account could not be removed. Contact support.',
      )
    }

    if (isDuplicateEmailError(error)) throw duplicateEmailError()
    throw error
  }
}

async function listAuthorities(institutionId, database = getDatabase()) {
  const memberships = await database.institutionMembership.findMany({
    where: { institutionId, role: 'AUTHORITY' },
    orderBy: { createdAt: 'desc' },
    select: getAuthoritySelection(),
  })
  return memberships.map(serializeAuthority)
}

async function updateAuthority(
  institutionId,
  membershipId,
  input,
  actorId,
  {
    database = getDatabase(),
    firebaseAuth = getFirebaseAuth(),
    logger = console,
  } = {},
) {
  const where = getMembershipWhere(institutionId, membershipId)
  const current = await database.institutionMembership.findFirst({
    where: { ...where, deletedAt: null },
    select: getAuthoritySelection(),
  })
  if (!current) throw authorityNotFoundError()

  const data = {}
  if (input.name !== undefined) data.name = input.name
  if (input.email !== undefined) data.email = normalizeEmail(input.email)
  if (data.email && data.email !== current.user.email) {
    const existing = await database.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    })
    if (existing && existing.id !== current.user.id) throw duplicateEmailError()
  }

  const firebaseChanges = {}
  if (data.name !== undefined) firebaseChanges.displayName = data.name
  if (data.email !== undefined) firebaseChanges.email = data.email

  if (Object.keys(firebaseChanges).length > 0) {
    try {
      await firebaseAuth.updateUser(current.user.firebaseUid, firebaseChanges)
    } catch (error) {
      if (isDuplicateEmailError(error)) throw duplicateEmailError()
      if (error?.code === 'auth/invalid-email') {
        throw new ApiError(400, 'INVALID_AUTHORITY_EMAIL', 'The email address is not accepted')
      }
      throw error
    }
  }

  try {
    const updated = await database.$transaction(async (transaction) => {
      if (Object.keys(data).length > 0) {
        await transaction.user.update({
          where: { id: current.user.id },
          data,
        })
      }

      const membership = await transaction.institutionMembership.findFirst({
        where: { ...where, deletedAt: null },
        select: { id: true },
      })
      if (!membership) throw authorityNotFoundError()

      const result = await transaction.institutionMembership.findUnique({
        where: { id: membership.id },
        select: getAuthoritySelection(),
      })

      await transaction.auditLog.create({
        data: {
          institutionId,
          actorId,
          action: 'AUTHORITY_UPDATED',
          entityType: 'InstitutionMembership',
          entityId: membershipId,
          metadata: { updatedFields: Object.keys(data) },
        },
      })
      await notifyInstitutionAdministrator(transaction, {
        institutionId,
        type: 'AUTHORITY_UPDATED',
        title: 'Authority account updated',
        message: 'An Authority account profile was updated.',
        relatedEntityType: 'InstitutionMembership',
        relatedEntityId: membershipId,
      })

      return result
    })

    return serializeAuthority(updated)
  } catch (error) {
    if (Object.keys(firebaseChanges).length > 0) {
      try {
        await firebaseAuth.updateUser(current.user.firebaseUid, {
          email: current.user.email,
          displayName: current.user.name,
        })
      } catch (compensationError) {
        logger.error('Authority update compensation failed', {
          firebaseUid: current.user.firebaseUid,
          errorCode: firebaseErrorCode(compensationError),
        })
        throw new ApiError(
          500,
          'AUTHORITY_UPDATE_RECONCILIATION_REQUIRED',
          'The account update could not be completed consistently. Contact support.',
        )
      }
    }

    if (isDuplicateEmailError(error)) throw duplicateEmailError()
    throw error
  }
}

async function setAuthorityEnabled(
  institutionId,
  membershipId,
  enabled,
  actorId,
  { database = getDatabase(), firebaseAuth = getFirebaseAuth(), logger = console } = {},
) {
  const where = getMembershipWhere(institutionId, membershipId)
  const current = await database.institutionMembership.findFirst({
    where,
    select: getAuthoritySelection(),
  })
  if (!current || current.deletedAt) throw authorityNotFoundError()

  const status = enabled ? 'ACTIVE' : 'INACTIVE'
  if (current.status !== status) {
    await database.$transaction(async (transaction) => {
      await transaction.institutionMembership.update({
        where: { id: membershipId },
        data: { status },
      })
      await transaction.auditLog.create({
        data: {
          institutionId,
          actorId,
          action: enabled ? 'AUTHORITY_ENABLED' : 'AUTHORITY_DISABLED',
          entityType: 'InstitutionMembership',
          entityId: membershipId,
          metadata: { status },
        },
      })
      await notifyInstitutionAdministrator(transaction, {
        institutionId,
        type: enabled ? 'AUTHORITY_ENABLED' : 'AUTHORITY_DISABLED',
        title: enabled ? 'Authority account enabled' : 'Authority account disabled',
        message: `An Authority account was ${enabled ? 'enabled' : 'disabled'}.`,
        relatedEntityType: 'InstitutionMembership',
        relatedEntityId: membershipId,
      })
    })
  }

  const firebaseAccessSynced = await synchronizeFirebaseAccess(
    current.user.id,
    database,
    firebaseAuth,
    logger,
  )
  const authority = {
    ...serializeAuthority(current),
    status,
  }
  return {
    authority,
    firebaseAccessSynced,
    ...(firebaseAccessSynced
      ? {}
      : { warning: 'Institution access was updated, but Firebase account status could not be synchronized.' }),
  }
}

async function deleteAuthority(
  institutionId,
  membershipId,
  actorId,
  { database = getDatabase(), firebaseAuth = getFirebaseAuth(), logger = console, now = new Date() } = {},
) {
  const where = getMembershipWhere(institutionId, membershipId)
  const current = await database.institutionMembership.findFirst({
    where,
    select: getAuthoritySelection(),
  })
  if (!current || current.deletedAt) throw authorityNotFoundError()

  await database.$transaction(async (transaction) => {
    await transaction.institutionMembership.update({
      where: { id: membershipId },
      data: { status: 'INACTIVE', deletedAt: now },
    })
    await transaction.auditLog.create({
      data: {
        institutionId,
        actorId,
        action: 'AUTHORITY_DELETED',
        entityType: 'InstitutionMembership',
        entityId: membershipId,
        metadata: { softDeleted: true },
      },
    })
    await notifyInstitutionAdministrator(transaction, {
      institutionId,
      type: 'AUTHORITY_DELETED',
      title: 'Authority account deleted',
      message: 'An Authority account was removed from this institution.',
      relatedEntityType: 'InstitutionMembership',
      relatedEntityId: membershipId,
    })
  })

  const firebaseAccessSynced = await synchronizeFirebaseAccess(
    current.user.id,
    database,
    firebaseAuth,
    logger,
  )
  return {
    authority: {
      ...serializeAuthority(current),
      status: 'INACTIVE',
      deletedAt: now,
    },
    firebaseAccessSynced,
    ...(firebaseAccessSynced
      ? {}
      : { warning: 'Institution access was removed, but Firebase account status could not be synchronized.' }),
  }
}

async function synchronizeFirebaseAccess(userId, database, firebaseAuth, logger) {
  const user = await database.user.findUnique({
    where: { id: userId },
    select: {
      firebaseUid: true,
      memberships: {
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      },
      administeredInstitutions: { select: { id: true } },
    },
  })
  if (!user) throw new Error('Authority user disappeared while synchronizing Firebase access')

  const hasAccess =
    user.memberships.length > 0 || user.administeredInstitutions.length > 0
  let syncError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await firebaseAuth.updateUser(user.firebaseUid, { disabled: !hasAccess })
      return true
    } catch (error) {
      syncError = error
    }
  }

  logger.error('Authority Firebase access synchronization failed', {
    firebaseUid: user.firebaseUid,
    disabled: !hasAccess,
    errorCode: firebaseErrorCode(syncError),
  })
  return false
}

module.exports = {
  createAuthority,
  deleteAuthority,
  listAuthorities,
  setAuthorityEnabled,
  updateAuthority,
}
