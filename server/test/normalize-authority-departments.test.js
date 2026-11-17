const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  applyNormalization,
  loadNormalizationReport,
} = require('../scripts/normalize-authority-departments')

const now = new Date('2026-11-17T00:00:00.000Z')
const institutionId = 'institution-fixture'
const institution = {
  id: institutionId,
  name: 'Fixture Institution',
  adminUserId: 'admin-fixture',
  subscriptions: [{
    planCode: 'BASIC',
    status: 'ACTIVE',
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: new Date('2027-01-01T00:00:00.000Z'),
    trialEndsAt: null,
  }],
}

function department(id, createdAt) {
  return { id, institutionId, name: `Department ${id}`, createdAt: new Date(createdAt) }
}

function membership(id, {
  status = 'ACTIVE',
  deletedAt = null,
  departmentIds = [],
} = {}) {
  return {
    id,
    institutionId,
    status,
    deletedAt,
    user: { name: `Authority ${id}` },
    authorityDepartments: departmentIds.map((departmentId) => ({
      id: `assignment-${id}-${departmentId}`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      department: { id: departmentId },
    })),
  }
}

function createFixtures({ includeUnassignedAuthority = false } = {}) {
  const departments = [
    department('dept-a', '2020-01-01T00:00:00.000Z'),
    department('dept-b', '2020-01-01T00:00:00.000Z'),
    department('dept-c', '2021-01-01T00:00:00.000Z'),
    department('dept-over-limit', '2022-01-01T00:00:00.000Z'),
    department('dept-soft-a', '2023-01-01T00:00:00.000Z'),
    department('dept-soft-b', '2024-01-01T00:00:00.000Z'),
  ]
  const memberships = [
    membership('authority-multi', { departmentIds: ['dept-c', 'dept-b', 'dept-a'] }),
    membership('authority-over-1', { departmentIds: ['dept-over-limit'] }),
    membership('authority-over-2', { departmentIds: ['dept-over-limit'] }),
    membership('authority-soft-deleted', {
      status: 'DISABLED',
      deletedAt: new Date('2025-01-01T00:00:00.000Z'),
      departmentIds: ['dept-soft-a', 'dept-soft-b'],
    }),
  ]
  if (includeUnassignedAuthority) {
    memberships.push(membership('authority-unassigned'))
  }

  return { departments, memberships }
}

function createMockDatabase(fixtures) {
  return {
    institution: { findMany: async () => [institution] },
    department: { findMany: async () => fixtures.departments },
    institutionMembership: { findMany: async () => fixtures.memberships },
  }
}

test('reports normalization choices and audits each assignment before deleting it', async () => {
  const fixtures = createFixtures()
  const report = await loadNormalizationReport(createMockDatabase(fixtures), now)

  assert.equal(report.multiDepartmentAuthorities.length, 1)
  assert.equal(report.multiDepartmentAuthorities[0].keptDepartment.id, 'dept-a')
  assert.deepEqual(
    report.multiDepartmentAuthorities[0].assignments.map(({ id }) => id),
    ['dept-a', 'dept-b', 'dept-c'],
  )
  assert.deepEqual(
    report.softDeletedAuthorities.map(({ membershipId, assignmentCount }) => ({
      membershipId,
      assignmentCount,
    })),
    [{ membershipId: 'authority-soft-deleted', assignmentCount: 2 }],
  )
  assert.deepEqual(report.departmentsOverPlanLimit, [{
    institutionName: institution.name,
    departmentId: 'dept-over-limit',
    departmentName: 'Department dept-over-limit',
    planCode: 'BASIC',
    enabledAuthorities: 2,
    limit: 1,
  }])

  const assignments = new Map(
    fixtures.memberships.flatMap((item) =>
      item.authorityDepartments.map((assignment) => [
        assignment.id,
        {
          membershipId: item.id,
          departmentId: assignment.department.id,
        },
      ]),
    ),
  )
  const events = []
  const transaction = {
    department: {
      findFirst: async ({ where }) => {
        const found = fixtures.departments.find(
          (item) => item.id === where.id && item.institutionId === where.institutionId,
        )
        return found ? { id: found.id, name: found.name } : null
      },
    },
    auditLog: {
      create: async ({ data }) => {
        events.push({ type: 'audit', data })
        return data
      },
    },
    authorityDepartment: {
      delete: async ({ where }) => {
        const assignment = assignments.get(where.id)
        assert.ok(assignment, `expected assignment ${where.id} to exist`)
        const precedingEvent = events.at(-1)
        assert.equal(precedingEvent.type, 'audit')
        assert.equal(precedingEvent.data.entityId, assignment.membershipId)
        assert.equal(precedingEvent.data.departmentId, assignment.departmentId)
        assert.equal(
          precedingEvent.data.metadata.departmentName,
          `Department ${assignment.departmentId}`,
        )
        events.push({ type: 'delete', id: where.id })
        assignments.delete(where.id)
      },
    },
  }

  await applyNormalization(transaction, report)

  const expectedDeletedIds = [
    'assignment-authority-multi-dept-b',
    'assignment-authority-multi-dept-c',
    'assignment-authority-soft-deleted-dept-soft-a',
    'assignment-authority-soft-deleted-dept-soft-b',
  ]
  assert.deepEqual(
    events.filter(({ type }) => type === 'delete').map(({ id }) => id),
    expectedDeletedIds,
  )
  assert.equal(events.length, expectedDeletedIds.length * 2)
  assert.equal(assignments.has('assignment-authority-over-1-dept-over-limit'), true)
  assert.equal(assignments.has('assignment-authority-over-2-dept-over-limit'), true)
  assert.equal(assignments.has('assignment-authority-multi-dept-a'), true)
})

test('refuses to normalize when a non-deleted Authority has no department', async () => {
  const fixtures = createFixtures({ includeUnassignedAuthority: true })
  const report = await loadNormalizationReport(createMockDatabase(fixtures), now)
  const calls = []
  const transaction = {
    department: {
      findFirst: async () => {
        calls.push('department.findFirst')
        return null
      },
    },
    auditLog: {
      create: async () => calls.push('auditLog.create'),
    },
    authorityDepartment: {
      delete: async () => calls.push('authorityDepartment.delete'),
    },
  }

  await assert.rejects(
    applyNormalization(transaction, report),
    /non-deleted Authorities have no department assignment/,
  )
  assert.deepEqual(calls, [])
})
