const { getPlan } = require('../src/config/plans')
const { writeAuditLog } = require('../src/services/audit-log.service')
const env = require('../src/config/env')
const {
  assertNonProductionDatabaseTargets,
} = require('../src/utils/supabase-project-target')

function assertConfirmedProject(confirmProject, targetProjectRef) {
  if (confirmProject !== targetProjectRef) {
    throw new Error(
      `--confirm-project must exactly match the non-production target project ref ${targetProjectRef}`,
    )
  }
}

function currentPlan(institution, now) {
  const active = institution.subscriptions.find((subscription) =>
    subscription.startsAt <= now &&
    ((subscription.status === 'ACTIVE' && subscription.endsAt > now) ||
      (subscription.status === 'TRIALING' &&
        subscription.trialEndsAt &&
        subscription.trialEndsAt > now)),
  )
  return active?.planCode || null
}

async function loadNormalizationReport(database, now = new Date()) {
  const [institutions, departments, memberships] = await Promise.all([
    database.institution.findMany({
      select: {
        id: true,
        name: true,
        adminUserId: true,
        subscriptions: {
          where: {
            departmentId: null,
            status: { in: ['ACTIVE', 'TRIALING'] },
            startsAt: { lte: now },
          },
          orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            planCode: true,
            status: true,
            startsAt: true,
            endsAt: true,
            trialEndsAt: true,
          },
        },
      },
    }),
    database.department.findMany({
      select: {
        id: true,
        institutionId: true,
        name: true,
        createdAt: true,
      },
    }),
    database.institutionMembership.findMany({
      where: { role: 'AUTHORITY' },
      select: {
        id: true,
        institutionId: true,
        status: true,
        deletedAt: true,
        user: { select: { name: true } },
        authorityDepartments: {
          select: {
            id: true,
            createdAt: true,
            department: { select: { id: true, name: true, createdAt: true } },
          },
        },
      },
    }),
  ])
  const institutionsById = new Map(institutions.map((item) => [item.id, item]))
  const departmentsById = new Map(departments.map((item) => [item.id, item]))
  const multiDepartmentAuthorities = []
  const softDeletedAuthorities = []
  const authoritiesWithoutDepartment = []
  const enabledCounts = new Map()
  const institutionsWithAuthorityAssignments = new Set()
  const removals = []

  for (const membership of memberships) {
    const institution = institutionsById.get(membership.institutionId)
    const assignments = membership.authorityDepartments
      .map((assignment) => ({
        ...assignment,
        department: departmentsById.get(assignment.department.id),
      }))
      .filter(({ department }) => department)
      .sort((left, right) =>
        left.department.createdAt.getTime() - right.department.createdAt.getTime() ||
        left.department.id.localeCompare(right.department.id),
      )

    if (membership.deletedAt) {
      if (assignments.length > 0) {
        softDeletedAuthorities.push({
          membershipId: membership.id,
          institutionName: institution?.name || membership.institutionId,
          assignmentCount: assignments.length,
          assignments: assignments.map(({ department }) => ({
            id: department.id,
            name: department.name,
          })),
        })
        for (const assignment of assignments) {
          removals.push({
            institution,
            membership,
            assignment,
            newDepartment: null,
            softDeleted: true,
          })
        }
      }
      continue
    }

    if (assignments.length === 0) {
      authoritiesWithoutDepartment.push({
        membershipId: membership.id,
        institutionName: institution?.name || membership.institutionId,
        authorityName: membership.user.name,
      })
      continue
    }
    institutionsWithAuthorityAssignments.add(membership.institutionId)

    const [kept, ...extraAssignments] = assignments
    if (extraAssignments.length > 0) {
      multiDepartmentAuthorities.push({
        membershipId: membership.id,
        institutionName: institution?.name || membership.institutionId,
        authorityName: membership.user.name,
        assignments: assignments.map(({ department }) => ({
          id: department.id,
          name: department.name,
        })),
        keptDepartment: { id: kept.department.id, name: kept.department.name },
      })
      for (const assignment of extraAssignments) {
        removals.push({
          institution,
          membership,
          assignment,
          newDepartment: kept.department,
          softDeleted: false,
        })
      }
    }

    if (membership.status === 'ACTIVE') {
      const key = `${membership.institutionId}\u0000${kept.department.id}`
      enabledCounts.set(key, (enabledCounts.get(key) || 0) + 1)
    }
  }

  const institutionsWithoutCurrentPlan = []
  const departmentsOverPlanLimit = []
  for (const department of departments) {
    const institution = institutionsById.get(department.institutionId)
    const planCode = institution ? currentPlan(institution, now) : null
    if (!planCode) {
      if (
        institutionsWithAuthorityAssignments.has(department.institutionId) &&
        !institutionsWithoutCurrentPlan.some(({ institutionId }) =>
          institutionId === department.institutionId,
        )
      ) {
        institutionsWithoutCurrentPlan.push({
          institutionId: department.institutionId,
          institutionName: institution?.name || department.institutionId,
        })
      }
      continue
    }
    const limit = getPlan(planCode)?.limits?.maxAuthoritiesPerDepartment
    const enabledAuthorities =
      enabledCounts.get(`${department.institutionId}\u0000${department.id}`) || 0
    if (Number.isInteger(limit) && enabledAuthorities > limit) {
      departmentsOverPlanLimit.push({
        institutionName: institution.name,
        departmentId: department.id,
        departmentName: department.name,
        planCode,
        enabledAuthorities,
        limit,
      })
    }
  }

  return {
    multiDepartmentAuthorities,
    softDeletedAuthorities,
    departmentsOverPlanLimit,
    authoritiesWithoutDepartment,
    institutionsWithoutCurrentPlan,
    removals,
  }
}

function printableReport(report, mode) {
  return {
    mode,
    multiDepartmentAuthorities: report.multiDepartmentAuthorities,
    softDeletedAuthorities: report.softDeletedAuthorities,
    departmentsOverPlanLimit: report.departmentsOverPlanLimit,
    authoritiesWithoutDepartment: report.authoritiesWithoutDepartment,
    institutionsWithoutCurrentPlan: report.institutionsWithoutCurrentPlan,
    assignmentsToRemove: report.removals.length,
  }
}

async function applyNormalization(transaction, report) {
  if (report.authoritiesWithoutDepartment.length > 0) {
    const membershipIds = report.authoritiesWithoutDepartment
      .map(({ membershipId }) => membershipId)
      .join(', ')
    throw new Error(
      `Cannot normalize: non-deleted Authorities have no department assignment (${membershipIds}). Assign them explicitly first.`,
    )
  }

  for (const removal of report.removals) {
    const { institution, membership, assignment, newDepartment, softDeleted } = removal
    await writeAuditLog(transaction, {
      data: {
        institutionId: membership.institutionId,
        departmentId: assignment.department.id,
        actorId: institution.adminUserId,
        action: softDeleted
          ? 'AUTHORITY_DEPARTMENT_CLEANED_SOFT_DELETED'
          : 'AUTHORITY_DEPARTMENT_NORMALIZED',
        entityType: 'InstitutionMembership',
        entityId: membership.id,
        metadata: {
          departmentName: assignment.department.name,
          oldDepartmentId: assignment.department.id,
          oldDepartmentName: assignment.department.name,
          newDepartmentId: newDepartment?.id || null,
          newDepartmentName: newDepartment?.name || null,
        },
      },
    })
    await transaction.authorityDepartment.delete({
      where: { id: assignment.id },
    })
  }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const confirmationArgs = args.filter((arg) => arg.startsWith('--confirm-project='))
  if (
    args.some((arg) => arg !== '--apply' && !arg.startsWith('--confirm-project=')) ||
    confirmationArgs.length > 1 ||
    (confirmationArgs.length > 0 && !apply)
  ) {
    throw new Error(
      'Usage: node scripts/normalize-authority-departments.js [--apply --confirm-project=<project-ref>]',
    )
  }
  const confirmProject = confirmationArgs[0]?.slice('--confirm-project='.length)
  if (apply && !confirmProject) {
    throw new Error('Apply mode requires --confirm-project=<project-ref>')
  }
  const { directTarget } = assertNonProductionDatabaseTargets({
    databaseUrl: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
    productionProjectRef: process.env.PRODUCTION_PROJECT_REF,
  })
  if (apply) assertConfirmedProject(confirmProject, directTarget.projectRef)

  const database = require('../src/config/prisma')
  try {
    let report
    if (apply) {
      report = await database.$transaction(async (transaction) => {
        const snapshot = await loadNormalizationReport(transaction)
        await applyNormalization(transaction, snapshot)
        return snapshot
      }, { isolationLevel: 'Serializable' })
    } else {
      report = await loadNormalizationReport(database)
    }
    console.log(JSON.stringify(printableReport(report, apply ? 'apply' : 'dry-run'), null, 2))
    if (!apply) {
      console.log('Dry run only. No database rows were changed.')
    }
  } finally {
    await database.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Authority department normalization failed: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = {
  applyNormalization,
  loadNormalizationReport,
  printableReport,
}
