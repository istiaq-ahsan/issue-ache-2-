const ApiError = require('../utils/api-error')
const { ensureAuthorityDepartmentInScope } = require('../middlewares/authority-scope')

function getDatabase() {
  return require('../config/prisma')
}

function scopedDepartmentMemberships(scope, departmentId) {
  return {
    where: {
      isActive: true,
      ...(Array.isArray(scope?.departmentIds)
        ? { departmentId: { in: scope.departmentIds } }
        : {}),
      ...(departmentId ? { departmentId } : {}),
    },
    select: {
      departmentId: true,
      isPrimary: true,
      department: { select: { id: true, name: true } },
    },
  }
}

function membershipWhere(institutionId, role, scope, membershipId) {
  return {
    ...(membershipId ? { id: membershipId } : {}),
    institutionId,
    role,
    deletedAt: null,
    departmentMemberships: {
      some: {
        isActive: true,
        ...(Array.isArray(scope?.departmentIds)
          ? { departmentId: { in: scope.departmentIds } }
          : {}),
      },
    },
  }
}

function serializeMember(member) {
  return {
    id: member.id,
    institutionId: member.institutionId,
    role: member.role,
    status: member.status,
    studentId: member.studentId,
    teacherId: member.teacherId,
    createdAt: member.createdAt,
    user: member.user,
    departments: member.departmentMemberships.map(({ department, isPrimary }) => ({
      ...department,
      isPrimary,
    })),
  }
}

async function listDepartmentMembers(
  institutionId,
  role,
  scope,
  database = getDatabase(),
  departmentId,
) {
  if (departmentId) ensureAuthorityDepartmentInScope(scope, departmentId)
  const where = membershipWhere(institutionId, role, scope)
  if (departmentId) {
    where.departmentMemberships.some.departmentId = departmentId
  }
  const memberships = await database.institutionMembership.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      institutionId: true,
      role: true,
      status: true,
      studentId: true,
      teacherId: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      departmentMemberships: scopedDepartmentMemberships(scope, departmentId),
    },
  })
  return memberships.map(serializeMember)
}

async function getDepartmentMember(institutionId, role, membershipId, scope, database = getDatabase()) {
  const membership = await database.institutionMembership.findFirst({
    where: membershipWhere(institutionId, role, scope, membershipId),
    select: {
      id: true,
      institutionId: true,
      role: true,
      status: true,
      studentId: true,
      teacherId: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      departmentMemberships: scopedDepartmentMemberships(scope),
    },
  })
  if (!membership) {
    throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Student or teacher was not found')
  }
  return serializeMember(membership)
}

async function setDepartmentMemberEnabled(
  institutionId,
  role,
  membershipId,
  enabled,
  actor,
  scope,
  database = getDatabase(),
) {
  return database.$transaction(async (transaction) => {
    const where = membershipWhere(institutionId, role, scope, membershipId)
    const membership = await transaction.institutionMembership.findFirst({
      where,
      select: {
        id: true,
        userId: true,
        status: true,
        studentId: true,
        teacherId: true,
        departmentMemberships: scopedDepartmentMemberships(scope),
      },
    })
    if (!membership) {
      throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Student or teacher was not found')
    }
    if (!['ACTIVE', 'INACTIVE'].includes(membership.status)) {
      throw new ApiError(409, 'MEMBERSHIP_STATUS_INVALID', 'Only active or inactive memberships can be changed')
    }

    const status = enabled ? 'ACTIVE' : 'INACTIVE'
    if (membership.status !== status) {
      const changed = await transaction.institutionMembership.updateMany({
        where: { ...where, status: membership.status },
        data: { status },
      })
      if (changed.count !== 1) {
        throw new ApiError(409, 'MEMBERSHIP_CHANGED', 'The membership changed; reload and try again')
      }

      for (const { departmentId } of membership.departmentMemberships) {
        await transaction.auditLog.create({
          data: {
            institutionId,
            departmentId,
            actorId: actor.userId,
            actorMembershipId: actor.membershipId,
            action: `${role}_${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`,
            entityType: 'InstitutionMembership',
            entityId: membershipId,
            metadata: {
              role,
              status,
              officialId: membership.studentId || membership.teacherId,
            },
          },
        })
      }
    }
    return { id: membershipId, role, status }
  })
}

module.exports = {
  getDepartmentMember,
  listDepartmentMembers,
  setDepartmentMemberEnabled,
}
