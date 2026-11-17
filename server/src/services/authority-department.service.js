const ApiError = require('../utils/api-error')
const { writeAuditLog } = require('./audit-log.service')
const { assertDepartmentAuthoritySlot } = require('./authority-limit.service')

function getDatabase() {
  return require('../config/prisma')
}

function departmentNotFound() {
  return new ApiError(
    400,
    'DEPARTMENT_ASSIGNMENT_INVALID',
    'The assigned department must belong to this institution',
  )
}

function assignmentRequired() {
  return new ApiError(
    409,
    'DEPARTMENT_ASSIGNMENT_REQUIRED',
    'An Authority must remain assigned to one department',
  )
}

function authorityNotFound() {
  return new ApiError(404, 'AUTHORITY_NOT_FOUND', 'Authority account was not found')
}

async function assertDepartmentBelongsToInstitution(
  institutionId,
  departmentId,
  database = getDatabase(),
) {
  if (typeof departmentId !== 'string' || departmentId.length === 0) {
    throw new ApiError(
      400,
      'DEPARTMENT_ASSIGNMENT_REQUIRED',
      'Assign the Authority to exactly one department',
    )
  }
  const department = await database.department.findFirst({
    where: { institutionId, id: departmentId },
    select: { id: true },
  })
  if (!department) throw departmentNotFound()
  return department.id
}

async function changeAuthorityDepartment(
  institutionId,
  authorityMembershipId,
  departmentId,
  assignedById,
  database = getDatabase(),
) {
  if (typeof departmentId !== 'string' || departmentId.length === 0) {
    throw new ApiError(
      400,
      'DEPARTMENT_ASSIGNMENT_REQUIRED',
      'Assign the Authority to exactly one department',
    )
  }

  return database.$transaction(async (transaction) => {
    const membership = await transaction.institutionMembership.findFirst({
      where: {
        id: authorityMembershipId,
        institutionId,
        role: 'AUTHORITY',
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    })
    if (!membership) throw authorityNotFound()

    const currentAssignments = await transaction.authorityDepartment.findMany({
      where: { institutionId, authorityMembershipId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
    })
    if (currentAssignments.length === 0) throw assignmentRequired()
    if (currentAssignments.length > 1) {
      throw new ApiError(
        409,
        'AUTHORITY_ASSIGNMENTS_NOT_NORMALIZED',
        'This Authority has legacy department assignments that must be normalized before it can be moved',
      )
    }
    const [currentAssignment] = currentAssignments
    if (currentAssignment.departmentId === departmentId) {
      return currentAssignment.department
    }

    if (membership.status === 'ACTIVE') {
      await assertDepartmentAuthoritySlot(
        transaction,
        institutionId,
        departmentId,
        { lockDepartment: true },
      )
    } else {
      const { ensureActiveSubscription } = require('./subscription.service')
      await ensureActiveSubscription(institutionId, { database: transaction })
      await assertDepartmentBelongsToInstitution(
        institutionId,
        departmentId,
        transaction,
      )
    }

    const updatedAssignment = await transaction.authorityDepartment.update({
      where: { id: currentAssignment.id },
      data: { departmentId, assignedById },
      select: {
        department: { select: { id: true, name: true } },
      },
    })
    const oldAndNewDepartments = {
      oldDepartmentId: currentAssignment.departmentId,
      oldDepartmentName: currentAssignment.department.name,
      newDepartmentId: departmentId,
      newDepartmentName: updatedAssignment.department.name,
    }

    await writeAuditLog(transaction, {
      data: {
        institutionId,
        departmentId: currentAssignment.departmentId,
        actorId: assignedById,
        action: 'AUTHORITY_DEPARTMENT_UNASSIGNED',
        entityType: 'InstitutionMembership',
        entityId: authorityMembershipId,
        metadata: oldAndNewDepartments,
      },
    })
    await writeAuditLog(transaction, {
      data: {
        institutionId,
        departmentId,
        actorId: assignedById,
        action: 'AUTHORITY_DEPARTMENT_ASSIGNED',
        entityType: 'InstitutionMembership',
        entityId: authorityMembershipId,
        metadata: oldAndNewDepartments,
      },
    })
    await transaction.notification.create({
      data: {
        institutionId,
        departmentId,
        recipientId: membership.userId,
        recipientMembershipId: membership.id,
        type: 'AUTHORITY_DEPARTMENT_CHANGED',
        title: 'Your department assignment changed',
        message: `Your Authority access is now assigned to ${updatedAssignment.department.name}.`,
        relatedEntityType: 'InstitutionMembership',
        relatedEntityId: membership.id,
      },
    })

    return updatedAssignment.department
  })
}

module.exports = {
  assertDepartmentBelongsToInstitution,
  changeAuthorityDepartment,
}
