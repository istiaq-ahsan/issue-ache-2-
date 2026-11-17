const ApiError = require('../utils/api-error')
const { writeAuditLog } = require('./audit-log.service')
const { getPlan } = require('../config/plans')
const { getCurrentSubscription } = require('./subscription.service')

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
    await writeAuditLog(transaction, {
      data: {
        institutionId,
        departmentId: department.id,
        actorId,
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: department.id,
        metadata: { name: department.name, departmentName: department.name },
      },
    })
    return department
  })
}

async function getAuthorityCapacity(database, institutionId) {
  const subscription = await getCurrentSubscription(institutionId, { database })
  const plan = getPlan(subscription?.planCode)
  return {
    limit: plan?.limits?.maxAuthoritiesPerDepartment ?? null,
    planCode: subscription?.planCode || null,
  }
}

async function listDepartments(institutionId, database = getDatabase()) {
  const [departments, authorityCapacity] = await Promise.all([
    database.department.findMany({
      where: { institutionId },
      orderBy: { name: 'asc' },
      select: {
        ...departmentSelection(),
        authorityAssignments: {
          where: {
            authorityMembership: { role: 'AUTHORITY' },
          },
          select: {
            authorityMembership: {
              select: { status: true, deletedAt: true },
            },
          },
        },
      },
    }),
    getAuthorityCapacity(database, institutionId),
  ])
  return departments.map(({ authorityAssignments, ...department }) => ({
    ...department,
    authorityUsage: {
      used: authorityAssignments.filter(({ authorityMembership }) =>
        authorityMembership.status === 'ACTIVE' && !authorityMembership.deletedAt,
      ).length,
      ...authorityCapacity,
    },
  }))
}

async function getDepartmentDetails(institutionId, departmentId, database = getDatabase()) {
  const [department, students, teachers, issues, authorityCapacity] = await Promise.all([
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
                role: true,
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
    getAuthorityCapacity(database, institutionId),
  ])
  if (!department) throw departmentNotFound()

  const {
    authorityAssignments,
    subscriptions,
    payments,
    ...departmentDetails
  } = department
  const used = authorityAssignments.filter(
    ({ authorityMembership }) =>
      authorityMembership.role === 'AUTHORITY' &&
      !authorityMembership.deletedAt &&
      authorityMembership.status === 'ACTIVE',
  ).length
  return {
    ...departmentDetails,
    authorityAssignments: authorityAssignments
      .filter(({ authorityMembership }) =>
        authorityMembership.role === 'AUTHORITY' && !authorityMembership.deletedAt,
      )
      .map(({ authorityMembership }) => ({
        id: authorityMembership.id,
        status: authorityMembership.status,
        user: authorityMembership.user,
      })),
    usage: {
      students,
      teachers,
      issues,
      authorities: used,
    },
    authorityUsage: { used, ...authorityCapacity },
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
    await writeAuditLog(transaction, {
      data: {
        institutionId,
        departmentId,
        actorId,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'Department',
        entityId: departmentId,
        metadata: {
          previousName: existing.name,
          name: department.name,
          departmentName: department.name,
        },
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
  ] = await Promise.all([
    transaction.departmentMembership.count({ where: { institutionId, departmentId } }),
    transaction.issue.count({ where: { institutionId, departmentId } }),
    transaction.authorityDepartment.count({
      where: {
        institutionId,
        departmentId,
        authorityMembership: { deletedAt: null },
      },
    }),
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
  ])
  return {
    departmentMemberships,
    issues,
    assignedAuthorities,
    departmentChangeRequests,
    requestedRegistrations,
    legacySubscriptions,
    legacyPayments,
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

      await transaction.authorityDepartment.deleteMany({
        where: {
          institutionId,
          departmentId,
          authorityMembership: { deletedAt: { not: null } },
        },
      })
      await writeAuditLog(transaction, {
        data: {
          institutionId,
          departmentId,
          actorId,
          action: 'DEPARTMENT_DELETED',
          entityType: 'Department',
          entityId: departmentId,
          metadata: { name: department.name, departmentName: department.name },
        },
      })
      await transaction.department.delete({ where: { id: departmentId } })
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
