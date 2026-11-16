const { getFirebaseAuth } = require('../config/firebase-admin')
const ApiError = require('../utils/api-error')
const { assertPlanLimit, ensureActiveSubscription } = require('./subscription.service')

function getDatabase() {
  return require('../config/prisma')
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function getFirebaseErrorCode(error) {
  return typeof error?.code === 'string' ? error.code : 'unknown'
}

function isDuplicateEmailError(error) {
  return error?.code === 'auth/email-already-exists' || error?.code === 'P2002'
}

function uniqueConstraintTarget(error) {
  if (error?.code !== 'P2002') return ''
  const target = error.meta?.target
  return Array.isArray(target) ? target.join(',') : String(target || '')
}

function registrationError(statusCode, code, message) {
  return new ApiError(statusCode, code, message)
}

function getInstitutionOrThrow(institution) {
  if (!institution) {
    throw registrationError(404, 'INSTITUTION_CODE_NOT_FOUND', 'Institution Code was not found')
  }
  return institution
}

function getDepartmentOrThrow(department) {
  if (!department) {
    throw registrationError(
      404,
      'DEPARTMENT_NOT_FOUND',
      'The selected department was not found for this institution',
    )
  }
  return department
}

async function lookupInstitutionDepartments(institutionCode, database = getDatabase()) {
  const institution = getInstitutionOrThrow(await database.institution.findUnique({
    where: { institutionCode: institutionCode.trim().toUpperCase() },
    select: { id: true, name: true, institutionCode: true },
  }))

  const departments = await database.department.findMany({
    where: { institutionId: institution.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return { institution, departments }
}

async function registerMember(
  role,
  input,
  {
    database = getDatabase(),
    firebaseAuth = getFirebaseAuth(),
    logger = console,
    now = new Date(),
  } = {},
) {
  const institution = getInstitutionOrThrow(await database.institution.findUnique({
    where: { institutionCode: input.institutionCode.trim().toUpperCase() },
    select: { id: true, name: true },
  }))
  const subscription = await ensureActiveSubscription(institution.id, { database, now })
  const memberCount = await database.institutionMembership.count({
    where: {
      institutionId: institution.id,
      role: { in: ['STUDENT', 'TEACHER'] },
      deletedAt: null,
    },
  })
  assertPlanLimit(subscription, 'maxMembers', memberCount)
  const department = getDepartmentOrThrow(await database.department.findFirst({
    where: {
      id: input.departmentId,
      institutionId: institution.id,
    },
    select: { id: true, name: true },
  }))

  const officialIdField = role === 'STUDENT' ? 'studentId' : 'teacherId'
  const officialId = input[officialIdField].trim()
  const email = normalizeEmail(input.email)

  const existingOfficialId = await database.institutionMembership.findFirst({
    where: {
      institutionId: institution.id,
      [officialIdField]: officialId,
    },
    select: { id: true },
  })
  if (existingOfficialId) {
    throw registrationError(
      409,
      `${role}_ID_ALREADY_REGISTERED`,
      `This ${role === 'STUDENT' ? 'Student' : 'Teacher'} ID is already registered at this institution`,
    )
  }

  const existingEmail = await database.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingEmail) {
    throw registrationError(409, 'EMAIL_ALREADY_REGISTERED', 'An account already exists with this email')
  }

  let firebaseUser
  try {
    firebaseUser = await firebaseAuth.createUser({
      email,
      password: input.password,
      displayName: input.name,
      disabled: false,
    })
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      throw registrationError(409, 'EMAIL_ALREADY_REGISTERED', 'An account already exists with this email')
    }
    if (error?.code === 'auth/invalid-email' || error?.code === 'auth/weak-password') {
      throw registrationError(400, 'INVALID_REGISTRATION_CREDENTIALS', 'The email or password is not accepted')
    }
    throw error
  }

  try {
    return await database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`member-limit:${institution.id}`}))`
      const currentSubscription = await ensureActiveSubscription(institution.id, {
        database: transaction,
        now,
      })
      const currentMemberCount = await transaction.institutionMembership.count({
        where: {
          institutionId: institution.id,
          role: { in: ['STUDENT', 'TEACHER'] },
          deletedAt: null,
        },
      })
      assertPlanLimit(currentSubscription, 'maxMembers', currentMemberCount)

      const currentDepartment = await transaction.department.findFirst({
        where: {
          id: department.id,
          institutionId: institution.id,
        },
        select: { id: true, name: true },
      })
      if (!currentDepartment) {
        throw registrationError(
          409,
          'DEPARTMENT_NOT_FOUND',
          'The selected department no longer belongs to this institution',
        )
      }

      const user = await transaction.user.create({
        data: {
          firebaseUid: firebaseUser.uid,
          email,
          name: input.name,
          phone: input.phone.trim(),
        },
        select: { id: true },
      })

      const membership = await transaction.institutionMembership.create({
        data: {
          institutionId: institution.id,
          userId: user.id,
          role,
          status: 'PENDING',
          [officialIdField]: officialId,
          requestedDepartmentId: department.id,
        },
        select: { id: true },
      })

      await transaction.auditLog.create({
        data: {
          institutionId: institution.id,
          actorId: user.id,
          actorMembershipId: membership.id,
          action: `${role}_REGISTRATION_SUBMITTED`,
          entityType: 'InstitutionMembership',
          entityId: membership.id,
          metadata: {
            role,
            officialId,
            departmentId: currentDepartment.id,
          },
        },
      })

      const authorities = await transaction.institutionMembership.findMany({
        where: {
          institutionId: institution.id,
          role: 'AUTHORITY',
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true, userId: true },
      })

      if (authorities.length > 0) {
        await transaction.notification.createMany({
          data: authorities.map((authority) => ({
            institutionId: institution.id,
            recipientId: authority.userId,
            recipientMembershipId: authority.id,
            type: 'MEMBERSHIP_REGISTRATION_PENDING',
            title: `New ${role.toLowerCase()} registration`,
            message: `${input.name} submitted a registration for ${currentDepartment.name}.`,
            relatedEntityType: 'InstitutionMembership',
            relatedEntityId: membership.id,
          })),
        })
      }

      return {
        membershipId: membership.id,
        institution: { id: institution.id, name: institution.name },
        role,
        status: 'PENDING',
      }
    })
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
      logger.error('Member registration Firebase compensation failed', {
        firebaseUid: firebaseUser.uid,
        role,
        errorCode: getFirebaseErrorCode(cleanupError),
      })
      throw registrationError(
        500,
        'REGISTRATION_PROVISIONING_CLEANUP_FAILED',
        'Registration failed and its Firebase account could not be removed. Contact support.',
      )
    }

    const target = uniqueConstraintTarget(error)
    if (target.includes(officialIdField)) {
      throw registrationError(
        409,
        `${role}_ID_ALREADY_REGISTERED`,
        `This ${role === 'STUDENT' ? 'Student' : 'Teacher'} ID is already registered at this institution`,
      )
    }
    if (target.includes('email') || target.includes('firebaseUid')) {
      throw registrationError(409, 'EMAIL_ALREADY_REGISTERED', 'An account already exists with this email')
    }
    throw error
  }
}

function registerStudent(input, options) {
  return registerMember('STUDENT', input, options)
}

function registerTeacher(input, options) {
  return registerMember('TEACHER', input, options)
}

function registrationSelection() {
  return {
    id: true,
    institutionId: true,
    role: true,
    status: true,
    studentId: true,
    teacherId: true,
    requestedDepartmentId: true,
    reviewedAt: true,
    createdAt: true,
    institution: { select: { id: true, name: true, institutionCode: true } },
    requestedDepartment: { select: { id: true, name: true } },
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    },
  }
}

function serializeRegistration(membership) {
  return {
    id: membership.id,
    institutionId: membership.institutionId,
    role: membership.role,
    status: membership.status,
    studentId: membership.studentId,
    teacherId: membership.teacherId,
    reviewedAt: membership.reviewedAt,
    createdAt: membership.createdAt,
    institution: membership.institution,
    department: membership.requestedDepartment,
    applicant: membership.user,
  }
}

async function listPendingRegistrations(institutionId, role, database = getDatabase()) {
  const memberships = await database.institutionMembership.findMany({
    where: {
      institutionId,
      status: 'PENDING',
      deletedAt: null,
      role: role ? role : { in: ['STUDENT', 'TEACHER'] },
    },
    orderBy: { createdAt: 'asc' },
    select: registrationSelection(),
  })
  return memberships.map(serializeRegistration)
}

async function getPendingRegistration(institutionId, membershipId, database = getDatabase()) {
  const membership = await database.institutionMembership.findFirst({
    where: {
      id: membershipId,
      institutionId,
      status: 'PENDING',
      deletedAt: null,
      role: { in: ['STUDENT', 'TEACHER'] },
    },
    select: registrationSelection(),
  })
  if (!membership) {
    throw registrationError(404, 'PENDING_REGISTRATION_NOT_FOUND', 'Pending registration was not found')
  }
  return serializeRegistration(membership)
}

async function decideRegistration(
  institutionId,
  membershipId,
  reviewer,
  decision,
  { database = getDatabase(), now = new Date() } = {},
) {
  const result = await database.$transaction(async (transaction) => {
    const membership = await transaction.institutionMembership.findFirst({
      where: {
        id: membershipId,
        institutionId,
        status: 'PENDING',
        deletedAt: null,
        role: { in: ['STUDENT', 'TEACHER'] },
      },
      select: {
        id: true,
        institutionId: true,
        userId: true,
        role: true,
        requestedDepartmentId: true,
        studentId: true,
        teacherId: true,
        institution: { select: { name: true } },
        requestedDepartment: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    })

    if (!membership) {
      throw registrationError(404, 'PENDING_REGISTRATION_NOT_FOUND', 'Pending registration was not found')
    }
    if (membership.userId === reviewer.userId) {
      throw registrationError(403, 'SELF_APPROVAL_NOT_ALLOWED', 'You cannot approve or reject your own registration')
    }

    if (decision === 'APPROVED') {
      const department = await transaction.department.findFirst({
        where: {
          id: membership.requestedDepartmentId,
          institutionId,
        },
        select: { id: true },
      })
      if (!department) {
        throw registrationError(
          409,
          'REGISTRATION_DEPARTMENT_NOT_FOUND',
          'The requested department no longer belongs to this institution',
        )
      }
    }

    const updated = await transaction.institutionMembership.updateMany({
      where: {
        id: membershipId,
        institutionId,
        status: 'PENDING',
        deletedAt: null,
      },
      data: {
        status: decision === 'APPROVED' ? 'ACTIVE' : 'REJECTED',
        reviewedById: reviewer.userId,
        reviewedByMembershipId: reviewer.membershipId,
        reviewedAt: now,
      },
    })
    if (updated.count !== 1) {
      throw registrationError(409, 'REGISTRATION_ALREADY_REVIEWED', 'This registration has already been reviewed')
    }

    if (decision === 'APPROVED') {
      await transaction.departmentMembership.create({
        data: {
          institutionId,
          membershipId,
          departmentId: membership.requestedDepartmentId,
          isPrimary: true,
          isActive: true,
        },
      })
    }

    await transaction.notification.create({
      data: {
        institutionId,
        recipientId: membership.userId,
        recipientMembershipId: membership.id,
        type: decision === 'APPROVED' ? 'MEMBERSHIP_REGISTRATION_APPROVED' : 'MEMBERSHIP_REGISTRATION_REJECTED',
        title: `Registration ${decision.toLowerCase()}`,
        message:
          decision === 'APPROVED'
            ? `Your registration at ${membership.institution.name} was approved.`
            : `Your registration at ${membership.institution.name} was rejected.`,
        relatedEntityType: 'InstitutionMembership',
        relatedEntityId: membership.id,
      },
    })

    await transaction.auditLog.create({
      data: {
        institutionId,
        actorId: reviewer.userId,
        actorMembershipId: reviewer.membershipId,
        action: `${membership.role}_REGISTRATION_${decision}`,
        entityType: 'InstitutionMembership',
        entityId: membership.id,
        metadata: {
          role: membership.role,
          departmentId: membership.requestedDepartmentId,
          applicantId: membership.userId,
        },
      },
    })

    return {
      id: membership.id,
      institutionId,
      role: membership.role,
      status: decision === 'APPROVED' ? 'ACTIVE' : 'REJECTED',
      decision,
      reviewedAt: now,
      applicantName: membership.user.name,
      department: membership.requestedDepartment,
    }
  })

  return result
}

module.exports = {
  decideRegistration,
  getPendingRegistration,
  listPendingRegistrations,
  lookupInstitutionDepartments,
  registerStudent,
  registerTeacher,
}
