const ApiError = require('../utils/api-error')

function getDatabase() {
  return require('../config/prisma')
}

function departmentNotFound() {
  return new ApiError(404, 'DEPARTMENT_NOT_FOUND', 'Department was not found')
}

function departmentSelection() {
  return {
    id: true,
    institutionId: true,
    name: true,
    createdAt: true,
    updatedAt: true,
  }
}

async function createDepartment(institutionId, name, actorId, database = getDatabase()) {
  return database.$transaction(async (transaction) => {
    const department = await transaction.department.create({
      data: { institutionId, name },
      select: departmentSelection(),
    })
    await transaction.auditLog.create({
      data: {
        institutionId,
        actorId,
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: department.id,
        metadata: { name: department.name },
      },
    })
    return department
  })
}

async function listDepartments(institutionId, database = getDatabase()) {
  return database.department.findMany({
    where: { institutionId },
    orderBy: { name: 'asc' },
    select: departmentSelection(),
  })
}

async function getDepartmentDetails(institutionId, departmentId, database = getDatabase()) {
  const [department, students, teachers, issues] = await Promise.all([
    database.department.findFirst({
      where: { id: departmentId, institutionId },
      select: {
        ...departmentSelection(),
        authorityAssignments: {
          orderBy: { authorityMembership: { user: { name: 'asc' } } },
          select: {
            authorityMembership: {
              select: {
                id: true,
                status: true,
                deletedAt: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        subscriptions: {
          where: { departmentId: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            planName: true,
            status: true,
            startsAt: true,
            endsAt: true,
            createdAt: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            provider: true,
            transactionReference: true,
            createdAt: true,
          },
        },
      },
    }),
    database.departmentMembership.count({
      where: {
        institutionId,
        departmentId,
        isActive: true,
        membership: { role: 'STUDENT', status: 'ACTIVE', deletedAt: null },
      },
    }),
    database.departmentMembership.count({
      where: {
        institutionId,
        departmentId,
        isActive: true,
        membership: { role: 'TEACHER', status: 'ACTIVE', deletedAt: null },
      },
    }),
    database.issue.count({ where: { institutionId, departmentId } }),
  ])
  if (!department) throw departmentNotFound()

  const {
    authorityAssignments,
    subscriptions,
    payments,
    ...departmentDetails
  } = department
  return {
    ...departmentDetails,
    authorityAssignments: authorityAssignments
      .filter(({ authorityMembership }) => !authorityMembership.deletedAt)
      .map(({ authorityMembership }) => ({
        id: authorityMembership.id,
        status: authorityMembership.status,
        user: authorityMembership.user,
      })),
    usage: {
      students,
      teachers,
      issues,
      authorities: authorityAssignments.filter(
        ({ authorityMembership }) => !authorityMembership.deletedAt,
      ).length,
    },
    legacyBillingHistory: { subscriptions, payments },
  }
}

async function updateDepartment(
  institutionId,
  departmentId,
  name,
  actorId,
  database = getDatabase(),
) {
  return database.$transaction(async (transaction) => {
    const existing = await transaction.department.findFirst({
      where: { id: departmentId, institutionId },
      select: { id: true, name: true },
    })
    if (!existing) throw departmentNotFound()

    const department = await transaction.department.update({
      where: { id: departmentId },
      data: { name },
      select: departmentSelection(),
    })
    await transaction.auditLog.create({
      data: {
        institutionId,
        actorId,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'Department',
        entityId: departmentId,
        metadata: { previousName: existing.name, name: department.name },
      },
    })
    return department
  })
}

async function getDepartmentReferences(transaction, institutionId, departmentId) {
  const [
    departmentMemberships,
    issues,
    assignedAuthorities,
    departmentChangeRequests,
    requestedRegistrations,
    legacySubscriptions,
    legacyPayments,
    auditLogs,
  ] = await Promise.all([
    transaction.departmentMembership.count({ where: { institutionId, departmentId } }),
    transaction.issue.count({ where: { institutionId, departmentId } }),
    transaction.authorityDepartment.count({ where: { institutionId, departmentId } }),
    transaction.departmentChangeRequest.count({
      where: {
        institutionId,
        OR: [
          { currentDepartmentId: departmentId },
          { requestedDepartmentId: departmentId },
          { replacementDepartmentId: departmentId },
        ],
      },
    }),
    transaction.institutionMembership.count({
      where: { institutionId, requestedDepartmentId: departmentId },
    }),
    transaction.subscription.count({ where: { institutionId, departmentId } }),
    transaction.payment.count({ where: { institutionId, departmentId } }),
    transaction.auditLog.count({ where: { institutionId, departmentId } }),
  ])
  return {
    departmentMemberships,
    issues,
    assignedAuthorities,
    departmentChangeRequests,
    requestedRegistrations,
    legacySubscriptions,
    legacyPayments,
    auditLogs,
  }
}

async function deleteDepartment(
  institutionId,
  departmentId,
  actorId,
  database = getDatabase(),
) {
  try {
    return await database.$transaction(async (transaction) => {
      const department = await transaction.department.findFirst({
        where: { id: departmentId, institutionId },
        select: { id: true, name: true },
      })
      if (!department) throw departmentNotFound()

      const references = await getDepartmentReferences(transaction, institutionId, departmentId)
      const usedBy = Object.entries(references)
        .filter(([, count]) => count > 0)
        .map(([name]) => name)
      if (usedBy.length > 0) {
        throw new ApiError(
          409,
          'DEPARTMENT_IN_USE',
          `Department cannot be deleted because it is referenced by: ${usedBy.join(', ')}`,
          { references, usedBy },
        )
      }

      await transaction.department.delete({ where: { id: departmentId } })
      await transaction.auditLog.create({
        data: {
          institutionId,
          actorId,
          action: 'DEPARTMENT_DELETED',
          entityType: 'Department',
          entityId: departmentId,
          metadata: { name: department.name },
        },
      })
      return { id: departmentId, deleted: true }
    })
  } catch (error) {
    if (error?.code === 'P2003') {
      throw new ApiError(
        409,
        'DEPARTMENT_IN_USE',
        'Department cannot be deleted because another record references it',
      )
    }
    throw error
  }
}

module.exports = {
  createDepartment,
  deleteDepartment,
  getDepartmentDetails,
  listDepartments,
  updateDepartment,
}
