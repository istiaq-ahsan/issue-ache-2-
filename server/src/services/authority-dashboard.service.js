const { ensureAuthorityDepartmentInScope } = require('../middlewares/authority-scope')

function getDatabase() {
  return require('../config/prisma')
}

async function getAuthorityDashboard(
  institutionId,
  scope,
  database = getDatabase(),
  departmentId,
) {
  if (departmentId) ensureAuthorityDepartmentInScope(scope, departmentId)
  const departmentIds = Array.isArray(scope?.departmentIds)
    ? scope.departmentIds.filter((id) => !departmentId || id === departmentId)
    : []
  if (departmentIds.length === 0) {
    return {
      departmentIds: [],
      departments: [],
      pendingRegistrations: 0,
      pendingDepartmentChanges: 0,
      activeIssues: 0,
      issuesByStatus: [],
    }
  }

  const [
    pendingRegistrations,
    pendingDepartmentChanges,
    issueGroups,
    departments,
  ] = await Promise.all([
    database.institutionMembership.count({
      where: {
        institutionId,
        role: { in: ['STUDENT', 'TEACHER'] },
        status: 'PENDING',
        deletedAt: null,
        requestedDepartmentId: { in: departmentIds },
      },
    }),
    database.departmentChangeRequest.count({
      where: {
        institutionId,
        status: 'PENDING',
        OR: [
          { requestedDepartmentId: { in: departmentIds } },
          { currentDepartmentId: { in: departmentIds } },
          { replacementDepartmentId: { in: departmentIds } },
        ],
      },
    }),
    database.issue.groupBy({
      by: ['status'],
      where: { institutionId, departmentId: { in: departmentIds }, archivedAt: null },
      _count: { _all: true },
    }),
    database.department.findMany({
      where: { institutionId, id: { in: departmentIds } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])
  const issuesByStatus = issueGroups.map(({ status, _count }) => ({
    status,
    count: _count._all,
  }))

  return {
    departmentIds,
    departments,
    pendingRegistrations,
    pendingDepartmentChanges,
    activeIssues: issueGroups.reduce((total, group) => total + group._count._all, 0),
    issuesByStatus,
  }
}

module.exports = { getAuthorityDashboard }
