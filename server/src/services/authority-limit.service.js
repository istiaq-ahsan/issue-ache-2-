const { getPlan } = require('../config/plans')
const ApiError = require('../utils/api-error')

function enabledAuthorityWhere(institutionId, departmentId) {
  return {
    institutionId,
    departmentId,
    authorityMembership: {
      institutionId,
      role: 'AUTHORITY',
      status: 'ACTIVE',
      deletedAt: null,
    },
  }
}

async function assertDepartmentAuthoritySlot(
  database,
  institutionId,
  departmentId,
  { lockDepartment = false, now = new Date() } = {},
) {
  if (lockDepartment) {
    const departments = await database.$queryRaw`
      SELECT "id"
      FROM public."Department"
      WHERE "id" = ${departmentId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `
    if (departments.length === 0) {
      throw new ApiError(
        404,
        'DEPARTMENT_NOT_FOUND',
        'The selected department was not found for this institution',
      )
    }
  }

  const { ensureActiveSubscription } = require('./subscription.service')
  const subscription = await ensureActiveSubscription(institutionId, { database, now })
  const plan = getPlan(subscription.planCode)
  const limit = plan?.limits?.maxAuthoritiesPerDepartment
  if (!Number.isInteger(limit)) {
    throw new ApiError(
      409,
      'SUBSCRIPTION_PLAN_INVALID',
      'The institution subscription does not have a valid Authority limit',
    )
  }

  const current = await database.authorityDepartment.count({
    where: enabledAuthorityWhere(institutionId, departmentId),
  })
  if (current >= limit) {
    throw new ApiError(
      409,
      'PLAN_LIMIT_REACHED',
      `This department has reached its limit of ${limit} enabled Authorities`,
      { limit, current, departmentId, planCode: subscription.planCode },
    )
  }

  return { limit, current, departmentId, planCode: subscription.planCode }
}

async function getDepartmentsOverAuthorityLimit(
  database,
  institutionId,
  planCode,
) {
  const plan = getPlan(planCode)
  const limit = plan?.limits?.maxAuthoritiesPerDepartment
  if (!Number.isInteger(limit)) {
    throw new ApiError(
      409,
      'SUBSCRIPTION_PLAN_INVALID',
      'The selected plan does not have a valid Authority limit',
    )
  }

  const counts = await database.authorityDepartment.groupBy({
    by: ['departmentId'],
    where: {
      institutionId,
      authorityMembership: {
        institutionId,
        role: 'AUTHORITY',
        status: 'ACTIVE',
        deletedAt: null,
      },
    },
    _count: { _all: true },
  })
  const overLimit = counts
    .filter(({ _count }) => _count._all > limit)
    .map(({ departmentId, _count }) => ({
      departmentId,
      enabledAuthorities: _count._all,
      limit,
      planCode,
    }))
  if (overLimit.length === 0) return []

  const departments = await database.department.findMany({
    where: {
      institutionId,
      id: { in: overLimit.map(({ departmentId }) => departmentId) },
    },
    select: { id: true, name: true },
  })
  const departmentById = new Map(departments.map((department) => [department.id, department]))
  return overLimit.map((entry) => ({
    ...entry,
    name: departmentById.get(entry.departmentId)?.name || entry.departmentId,
  }))
}

function planDowngradeBlockedError(departments) {
  return new ApiError(
    409,
    'PLAN_DOWNGRADE_BLOCKED',
    'The Basic plan allows one enabled Authority per department. Reduce Authority assignments in the listed departments before selecting Basic.',
    { planCode: 'BASIC', departments },
  )
}

module.exports = {
  assertDepartmentAuthoritySlot,
  enabledAuthorityWhere,
  getDepartmentsOverAuthorityLimit,
  planDowngradeBlockedError,
}
