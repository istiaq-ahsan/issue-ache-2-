const { getFirebaseAuth } = require('../config/firebase-admin')
const ApiError = require('../utils/api-error')
const asyncHandler = require('../utils/async-handler')
const { ensureActiveSubscription } = require('../services/subscription.service')
const { attachAuthorityScope } = require('./authority-scope')

function getPrisma() {
  return require('../config/prisma')
}

const INVALID_TOKEN_CODES = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-id-token',
  'auth/tenant-id-mismatch',
])

function getBearerToken(req) {
  const authorization = req.get('authorization')
  if (!authorization) {
    throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A Firebase ID token is required')
  }

  const match = authorization.match(/^Bearer\s+(\S+)$/i)
  if (!match) {
    throw new ApiError(
      401,
      'INVALID_AUTHORIZATION_HEADER',
      'Authorization must use the Bearer token scheme',
    )
  }

  return match[1]
}

async function verifyFirebaseIdentity(req, firebaseAuth) {
  const token = getBearerToken(req)
  let decodedToken

  try {
    decodedToken = await firebaseAuth().verifyIdToken(token, true)
  } catch (error) {
    if (INVALID_TOKEN_CODES.has(error.code)) {
      throw new ApiError(401, 'INVALID_ID_TOKEN', 'Firebase ID token is invalid or expired')
    }
    throw error
  }

  if (!decodedToken.uid) {
    throw new ApiError(401, 'INVALID_ID_TOKEN', 'Firebase ID token has no user identifier')
  }

  return decodedToken
}

function createVerifyFirebaseToken({ firebaseAuth = getFirebaseAuth } = {}) {
  return asyncHandler(async (req, res, next) => {
    req.firebaseIdentity = await verifyFirebaseIdentity(req, firebaseAuth)
    return next()
  })
}

function createRequireAuth({
  firebaseAuth = getFirebaseAuth,
  database = getPrisma,
} = {}) {
  return asyncHandler(async (req, res, next) => {
    const decodedToken =
      req.firebaseIdentity || (await verifyFirebaseIdentity(req, firebaseAuth))

    const user = await resolveDatabase(database).user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        memberships: {
          where: { deletedAt: null },
          select: {
            id: true,
            institutionId: true,
            role: true,
            status: true,
            studentId: true,
            teacherId: true,
            requestedDepartmentId: true,
            reviewedById: true,
            reviewedAt: true,
            deletedAt: true,
            institution: {
              select: { id: true, name: true, institutionCode: true },
            },
            requestedDepartment: {
              select: { id: true, name: true },
            },
            authorityDepartments: {
              orderBy: { department: { name: 'asc' } },
              select: {
                departmentId: true,
                department: {
                  select: { id: true, name: true },
                },
              },
            },
            departmentMemberships: {
              where: { isActive: true },
              select: {
                isPrimary: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        administeredInstitutions: {
          select: { id: true, name: true, institutionCode: true },
        },
      },
    })

    if (!user) {
      throw new ApiError(
        403,
        'APPLICATION_ACCOUNT_NOT_FOUND',
        'This Firebase account is not linked to an application user',
      )
    }

    req.auth = {
      firebaseUid: decodedToken.uid,
      user,
      memberships: user.memberships,
      administeredInstitutions: user.administeredInstitutions,
    }

    return next()
  })
}

function resolveInstitutionId(req) {
  return req.params.institutionId || req.get('x-institution-id')
}

function resolveDepartmentId(req) {
  return req.params.departmentId || req.get('x-department-id')
}

function resolveDatabase(database) {
  return typeof database === 'function' ? database() : database
}

function createRequireInstitutionAccess({
  database = getPrisma,
  allowAdministrator = false,
} = {}) {
  return asyncHandler(async (req, res, next) => {
    if (!req.auth?.user) {
      throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required')
    }

    const institutionId = resolveInstitutionId(req)
    if (!institutionId) {
      throw new ApiError(
        400,
        'INSTITUTION_CONTEXT_REQUIRED',
        'Select an institution using the route or X-Institution-Id header',
      )
    }

    const db = resolveDatabase(database)
    const membership = await db.institutionMembership.findFirst({
      where: {
        institutionId,
        userId: req.auth.user.id,
      },
      select: {
        id: true,
        institutionId: true,
        userId: true,
        role: true,
        status: true,
        deletedAt: true,
        institution: {
          select: { id: true, name: true, institutionCode: true },
        },
        departmentMemberships: {
          where: { isActive: true },
          select: {
            id: true,
            departmentId: true,
            isPrimary: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (membership) {
      if (membership.deletedAt || membership.status !== 'ACTIVE') {
        throw new ApiError(
          403,
          'MEMBERSHIP_NOT_ACTIVE',
          'An active institution membership is required',
        )
      }

      const departmentId = resolveDepartmentId(req)
      const memberDepartments = membership.departmentMemberships

      if (
        membership.role !== 'AUTHORITY' &&
        (memberDepartments.length === 0 ||
          (departmentId &&
            !memberDepartments.some(
              ({ departmentId: memberDepartmentId }) =>
                memberDepartmentId === departmentId,
            )))
      ) {
        throw new ApiError(
          403,
          'DEPARTMENT_ACCESS_DENIED',
          'An active membership in at least one institution department is required',
        )
      }

      if (membership.role === 'AUTHORITY' && departmentId) {
        const department = await db.department.findFirst({
          where: {
            id: departmentId,
            institutionId,
          },
          select: { id: true, name: true },
        })

        if (!department) {
          throw new ApiError(
            403,
            'DEPARTMENT_ACCESS_DENIED',
            'The selected department was not found in this institution',
          )
        }
      }

      req.auth.institutionId = institutionId
      req.auth.institution = membership.institution
      req.auth.membership = membership
      req.auth.departmentId = departmentId
      return next()
    }

    if (allowAdministrator) {
      const institution = await db.institution.findFirst({
        where: { id: institutionId, adminUserId: req.auth.user.id },
        select: { id: true, name: true, institutionCode: true },
      })

      if (institution) {
        req.auth.institutionId = institutionId
        req.auth.institution = institution
        req.auth.institutionAdministrator = true
        return next()
      }
    }

    throw new ApiError(
      403,
      'INSTITUTION_ACCESS_DENIED',
      'You do not have access to this institution',
    )
  })
}

function requireInstitutionAccess(options) {
  return createRequireInstitutionAccess(options)
}

function createRequireInstitutionAdministrator({ database = getPrisma } = {}) {
  return asyncHandler(async (req, res, next) => {
    if (!req.auth?.user) {
      throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required')
    }

    const institutionId = resolveInstitutionId(req)
    if (!institutionId) {
      throw new ApiError(
        400,
        'INSTITUTION_CONTEXT_REQUIRED',
        'Select an institution using the route or X-Institution-Id header',
      )
    }

    const institution = await resolveDatabase(database).institution.findFirst({
      where: { id: institutionId, adminUserId: req.auth.user.id },
      select: {
        id: true,
        name: true,
        institutionCode: true,
        contactPersonName: true,
        contactEmail: true,
        campusType: true,
        campusSize: true,
        location: true,
      },
    })

    if (!institution) {
      throw new ApiError(
        403,
        'INSTITUTION_ACCESS_DENIED',
        'You are not the administrator of this institution',
      )
    }

    req.auth.institutionId = institutionId
    req.auth.institution = institution
    req.auth.institutionAdministrator = true
    return next()
  })
}

function requireInstitutionAdministrator(options) {
  return createRequireInstitutionAdministrator(options)
}

function createRequireActiveSubscription({
  database = getPrisma,
  ensureSubscription = ensureActiveSubscription,
  now = () => new Date(),
} = {}) {
  return asyncHandler(async (req, res, next) => {
    if (!req.auth?.institutionId) {
      throw new ApiError(
        400,
        'INSTITUTION_CONTEXT_REQUIRED',
        'Institution access must be verified before subscription access',
      )
    }

    await ensureSubscription(req.auth.institutionId, {
      database: resolveDatabase(database),
      now: now(),
    })
    return next()
  })
}

const requireActiveSubscription = createRequireActiveSubscription()

function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat()
  if (roles.length === 0) {
    throw new TypeError('requireRole must be given at least one application role')
  }

  return function roleAuthorization(req, res, next) {
    const membership = req.auth?.membership
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.deletedAt ||
      !roles.includes(membership.role)
    ) {
      return next(
        new ApiError(
          403,
          'ROLE_NOT_AUTHORIZED',
          'Your active institution role is not permitted to access this resource',
        ),
      )
    }

    return next()
  }
}

const requireAuth = createRequireAuth()

module.exports = {
  createRequireActiveSubscription,
  createRequireAuth,
  createRequireDepartmentAccess: attachAuthorityScope,
  createRequireInstitutionAdministrator,
  createRequireInstitutionAccess,
  createVerifyFirebaseToken,
  requireAuth,
  requireActiveSubscription,
  requireDepartmentAccess: attachAuthorityScope,
  requireInstitutionAdministrator,
  requireInstitutionAccess,
  requireRole,
}
