const ApiError = require('../utils/api-error')

function getDatabase() {
  return require('../config/prisma')
}

function getMembershipOrThrow(membership) {
  if (!membership || membership.deletedAt || membership.status !== 'ACTIVE') {
    throw new ApiError(403, 'MEMBERSHIP_NOT_ACTIVE', 'An active institution membership is required')
  }
  if (membership.role !== 'STUDENT' && membership.role !== 'TEACHER') {
    throw new ApiError(403, 'ROLE_NOT_AUTHORIZED', 'This feature is only available to students and teachers')
  }
  return membership
}

function profileSelection() {
  return {
    id: true,
    institutionId: true,
    role: true,
    status: true,
    studentId: true,
    teacherId: true,
    institution: {
      select: {
        id: true,
        name: true,
        institutionCode: true,
      },
    },
    departmentMemberships: {
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        departmentId: true,
        isPrimary: true,
        department: {
          select: { id: true, name: true },
        },
      },
    },
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

function serializeProfile(membership) {
  return {
    membershipId: membership.id,
    institutionId: membership.institutionId,
    role: membership.role,
    status: membership.status,
    officialId: membership.role === 'STUDENT' ? membership.studentId : membership.teacherId,
    institution: membership.institution,
    user: membership.user,
    departments: membership.departmentMemberships.map((item) => ({
      id: item.department.id,
      name: item.department.name,
      isPrimary: item.isPrimary,
    })),
  }
}

async function getMemberProfile(
  institutionId,
  membershipId,
  database = getDatabase(),
  now = new Date(),
) {
  const membership = await database.institutionMembership.findFirst({
    where: { id: membershipId, institutionId, deletedAt: null },
    select: profileSelection(),
  })
  getMembershipOrThrow(membership)
  const availableDepartments = await database.department.findMany({
    where: { institutionId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return { ...serializeProfile(membership), availableDepartments }
}

async function updateMemberProfile(
  institutionId,
  membershipId,
  input,
  database = getDatabase(),
) {
  const membership = getMembershipOrThrow(await database.institutionMembership.findFirst({
    where: { id: membershipId, institutionId, deletedAt: null },
    select: { id: true, institutionId: true, role: true, status: true, deletedAt: true, userId: true },
  }))

  await database.user.update({
    where: { id: membership.userId },
    data: input,
  })

  return getMemberProfile(institutionId, membershipId, database)
}

module.exports = {
  getMemberProfile,
  updateMemberProfile,
}
