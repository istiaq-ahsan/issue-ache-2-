const ApiError = require('../utils/api-error')
const asyncHandler = require('../utils/async-handler')

function getDatabase() {
  return require('../config/prisma')
}

async function getAuthorityDepartmentIds(authorityMembershipId, database = getDatabase()) {
  const assignment = await database.authorityDepartment.findFirst({
    where: { authorityMembershipId },
    select: { departmentId: true },
  })
  return assignment ? [assignment.departmentId] : []
}

function attachAuthorityScope({ database = getDatabase } = {}) {
  return asyncHandler(async (req, res, next) => {
    if (
      req.auth?.institutionAdministrator ||
      req.auth?.administeredInstitutions?.some(({ id }) => id === req.auth.institutionId)
    ) {
      req.scope = { departmentIds: null }
      return next()
    }

    const membership = req.auth?.membership
    if (!membership || membership.role !== 'AUTHORITY') {
      req.scope = { departmentIds: null }
      return next()
    }

    const departmentIds = await getAuthorityDepartmentIds(
      membership.id,
      typeof database === 'function' ? database() : database,
    )
    if (departmentIds.length === 0) {
      throw new ApiError(
        403,
        'AUTHORITY_DEPARTMENT_ASSIGNMENT_REQUIRED',
        'An Authority must be assigned to at least one department',
      )
    }
    if (
      req.auth.departmentId &&
      !departmentIds.includes(req.auth.departmentId)
    ) {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found')
    }
    req.scope = { departmentIds }
    return next()
  })
}

function getDepartmentScopeWhere(scope, field = 'departmentId') {
  if (!Array.isArray(scope?.departmentIds)) return {}
  return { [field]: { in: scope.departmentIds } }
}

function ensureAuthorityDepartmentInScope(scope, departmentId) {
  if (
    Array.isArray(scope?.departmentIds) &&
    !scope.departmentIds.includes(departmentId)
  ) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found')
  }
}

module.exports = {
  attachAuthorityScope,
  ensureAuthorityDepartmentInScope,
  getAuthorityDepartmentIds,
  getDepartmentScopeWhere,
}