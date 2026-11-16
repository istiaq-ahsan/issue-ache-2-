const { expireEndedSubscriptions } = require('./subscription.service')

function getDatabase() {
  return require('../config/prisma')
}

async function getInstitutionDashboard(institutionId, institution, database = getDatabase()) {
  const now = new Date()
  await expireEndedSubscriptions(database, institutionId, now)
  const [
    departmentRows,
    membershipGroups,
    issueGroups,
    subscriptionGroups,
    paymentGroups,
    subscriptions,
    payments,
  ] = await Promise.all([
    database.department.count({
      where: { institutionId },
    }),
    database.institutionMembership.groupBy({
      by: ['role', 'status'],
      where: { institutionId, deletedAt: null },
      _count: { _all: true },
    }),
    database.issue.groupBy({
      by: ['audience', 'status'],
      where: { institutionId },
      _count: { _all: true },
    }),
    database.subscription.groupBy({
      by: ['status'],
      where: { institutionId, departmentId: null },
      _count: { _all: true },
    }),
    database.payment.groupBy({
      by: ['status'],
      where: { institutionId, departmentId: null },
      _count: { _all: true },
    }),
    database.subscription.findMany({
      where: { institutionId, departmentId: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        planName: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    }),
    database.payment.findMany({
      where: { institutionId, departmentId: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        createdAt: true,
      },
    }),
  ])

  const countBy = (groups, key) =>
    Object.fromEntries(groups.map((group) => [group[key], group._count._all]))

  const memberships = membershipGroups.map((group) => ({
    role: group.role,
    status: group.status,
    count: group._count._all,
  }))
  const issues = issueGroups.map((group) => ({
    audience: group.audience,
    status: group.status,
    count: group._count._all,
  }))

  return {
    institution,
    departments: {
      total: departmentRows,
    },
    memberships,
    issues,
    subscriptions: {
      byStatus: countBy(subscriptionGroups, 'status'),
      recent: subscriptions,
    },
    payments: {
      byStatus: countBy(paymentGroups, 'status'),
      recent: payments,
    },
  }
}

module.exports = { getInstitutionDashboard }
