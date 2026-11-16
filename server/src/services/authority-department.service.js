const ApiError = require('../utils/api-error')

function getDatabase() {
  return require('../config/prisma')
}

function authorityNotFound() {
  return new ApiError(404, 'AUTHORITY_NOT_FOUND', 'Authority account was not found')
}

function departmentIdsNotFound() {
  return new ApiError(
    400,
    'DEPARTMENT_ASSIGNMENT_INVALID',
    'Every assigned department must belong to this institution',
  )
}

async function assertDepartmentsBelongToInstitution(
  institutionId,
  departmentIds,
  database = getDatabase(),
) {
  if (!Array.isArray(departmentIds)) {
    throw new ApiError(
      400,
      'DEPARTMENT_ASSIGNMENT_REQUIRED',
      'Assign an Authority to at least one department',
    )
  }
  const uniqueIds = [...new Set(departmentIds)]
  if (uniqueIds.length !== departmentIds.length || uniqueIds.length === 0) {
    throw new ApiError(
      400,
      'DEPARTMENT_ASSIGNMENT_REQUIRED',
      'Assign an Authority to at least one distinct department',
    )
  }
  const count = await database.department.count({
    where: { institutionId, id: { in: uniqueIds } },
  })
  if (count !== uniqueIds.length) throw departmentIdsNotFound()
  return uniqueIds
}

async function replaceAuthorityDepartments(
  institutionId,
  authorityMembershipId,
  departmentIds,
  assignedById,
  database = getDatabase(),
) {
  const uniqueIds = [...new Set(departmentIds)]
  if (uniqueIds.length === 0 || uniqueIds.length !== departmentIds.length) {
    throw new ApiError(
      400,
      'DEPARTMENT_ASSIGNMENT_REQUIRED',
      'An Authority must be assigned to at least one distinct department',
    )
  }

  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`authority-departments:${authorityMembershipId}`}))`

    const membership = await transaction.institutionMembership.findFirst({
      where: {
        id: authorityMembershipId,
        institutionId,
        role: 'AUTHORITY',
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!membership) throw authorityNotFound()

    const departmentCount = await transaction.department.count({
      where: { institutionId, id: { in: uniqueIds } },
    })
    if (departmentCount !== uniqueIds.length) throw departmentIdsNotFound()

    const currentAssignments = await transaction.authorityDepartment.findMany({
      where: { institutionId, authorityMembershipId },
      select: { departmentId: true },
    })
    const currentIds = currentAssignments.map(({ departmentId }) => departmentId)
    const added = uniqueIds.filter((id) => !currentIds.includes(id))
    const removed = currentIds.filter((id) => !uniqueIds.includes(id))

    if (added.length || removed.length) {
      await transaction.authorityDepartment.deleteMany({
        where: { institutionId, authorityMembershipId },
      })
      await transaction.authorityDepartment.createMany({
        data: uniqueIds.map((departmentId) => ({
          institutionId,
          authorityMembershipId,
          departmentId,
          assignedById,
        })),
      })

      for (const departmentId of added) {
        await transaction.auditLog.create({
          data: {
            institutionId,
            departmentId,
            actorId: assignedById,
            action: 'AUTHORITY_DEPARTMENT_ASSIGNED',
            entityType: 'InstitutionMembership',
            entityId: authorityMembershipId,
            metadata: { departmentId },
          },
        })
      }
      for (const departmentId of removed) {
        await transaction.auditLog.create({
          data: {
            institutionId,
            departmentId,
            actorId: assignedById,
            action: 'AUTHORITY_DEPARTMENT_UNASSIGNED',
            entityType: 'InstitutionMembership',
            entityId: authorityMembershipId,
            metadata: { departmentId },
          },
        })
      }
    }

    return transaction.authorityDepartment.findMany({
      where: { institutionId, authorityMembershipId },
      orderBy: { department: { name: 'asc' } },
      select: {
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
    })
  })
}

module.exports = {
  assertDepartmentsBelongToInstitution,
  replaceAuthorityDepartments,
}