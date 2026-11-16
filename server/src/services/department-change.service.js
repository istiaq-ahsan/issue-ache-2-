const ApiError = require('../utils/api-error')
const { ensureAuthorityDepartmentInScope } = require('../middlewares/authority-scope')

function getDatabase() {
  return require('../config/prisma')
}

function requestNotFound() {
  return new ApiError(404, 'DEPARTMENT_CHANGE_REQUEST_NOT_FOUND', 'Department change request was not found')
}

function conflict(message, code = 'DEPARTMENT_CHANGE_NOT_ALLOWED') {
  return new ApiError(409, code, message)
}

function decisionDepartmentId(request) {
  return request.requestedDepartmentId ||
    request.replacementDepartmentId ||
    request.currentDepartmentId
}

function visibleDepartmentScope(scope) {
  if (!Array.isArray(scope?.departmentIds)) return {}
  return {
    OR: [
      { requestedDepartmentId: { in: scope.departmentIds } },
      { currentDepartmentId: { in: scope.departmentIds } },
      { replacementDepartmentId: { in: scope.departmentIds } },
    ],
  }
}

function decisionDepartmentScope(scope) {
  if (!Array.isArray(scope?.departmentIds)) return {}
  return {
    OR: [
      { requestedDepartmentId: { in: scope.departmentIds } },
      {
        requestedDepartmentId: null,
        replacementDepartmentId: { in: scope.departmentIds },
      },
      {
        requestedDepartmentId: null,
        replacementDepartmentId: null,
        currentDepartmentId: { in: scope.departmentIds },
      },
    ],
  }
}

function validateRoleForType(role, changeType) {
  if (
    (role === 'STUDENT' && changeType !== 'STUDENT_CHANGE') ||
    (role === 'TEACHER' && changeType === 'STUDENT_CHANGE')
  ) {
    throw new ApiError(403, 'ROLE_NOT_AUTHORIZED', 'This department change type is not available for your role')
  }
}

async function getMemberForRequest(transaction, institutionId, membershipId) {
  const membership = await transaction.institutionMembership.findFirst({
    where: {
      id: membershipId,
      institutionId,
      status: 'ACTIVE',
      deletedAt: null,
      role: { in: ['STUDENT', 'TEACHER'] },
    },
    select: {
      id: true,
      institutionId: true,
      userId: true,
      role: true,
      departmentMemberships: {
        where: { isActive: true },
        select: {
          id: true,
          departmentId: true,
          isPrimary: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!membership) throw new ApiError(403, 'MEMBERSHIP_NOT_ACTIVE', 'An active student or teacher membership is required')
  return membership
}

function validateActivePrimary(membership) {
  const primary = membership.departmentMemberships.filter((item) => item.isPrimary)
  if (primary.length !== 1) {
    throw conflict('Your account must have exactly one active primary department', 'PRIMARY_DEPARTMENT_INVALID')
  }
  return primary[0]
}

async function validateRequestedDepartment(transaction, institutionId, departmentId, now) {
  const department = await transaction.department.findFirst({
    where: { id: departmentId, institutionId },
    select: { id: true, name: true },
  })
  if (!department) {
    throw new ApiError(404, 'DEPARTMENT_NOT_FOUND', 'The selected department was not found in this institution')
  }
  return department
}

function mapCreateError(error) {
  if (error?.code === 'P2002') {
    return conflict(
      'A pending department change already exists for this account',
      'PENDING_DEPARTMENT_CHANGE_EXISTS',
    )
  }
  return error
}

async function createDepartmentChangeRequest(
  institutionId,
  membershipId,
  userId,
  input,
  { database = getDatabase(), now = new Date() } = {},
) {
  try {
    return await database.$transaction(async (transaction) => {
      const membership = await getMemberForRequest(transaction, institutionId, membershipId)
      if (membership.userId !== userId) {
        throw new ApiError(403, 'MEMBERSHIP_ACCESS_DENIED', 'You can only request changes to your own membership')
      }

      validateRoleForType(membership.role, input.changeType)
      const primary = validateActivePrimary(membership)
      let currentDepartmentId = null
      let requestedDepartmentId = null
      let replacementDepartmentId = null

      if (input.changeType === 'STUDENT_CHANGE') {
        currentDepartmentId = primary.departmentId
        requestedDepartmentId = input.requestedDepartmentId
        if (requestedDepartmentId === currentDepartmentId) {
          throw conflict('Select a department different from your current primary department')
        }
        await validateRequestedDepartment(transaction, institutionId, requestedDepartmentId, now)
      }

      if (input.changeType === 'TEACHER_ADD') {
        requestedDepartmentId = input.requestedDepartmentId
        await validateRequestedDepartment(transaction, institutionId, requestedDepartmentId, now)
        if (membership.departmentMemberships.some((item) => item.departmentId === requestedDepartmentId)) {
          throw conflict('You already have an active membership in this department')
        }
      }

      if (input.changeType === 'TEACHER_REMOVE') {
        currentDepartmentId = input.currentDepartmentId
        const current = membership.departmentMemberships.find(
          (item) => item.departmentId === currentDepartmentId,
        )
        if (!current) {
          throw conflict('You do not have an active membership in the selected department')
        }
        if (current.isPrimary) {
          if (!input.replacementDepartmentId) {
            throw conflict('Removing your primary department requires a replacement department')
          }
          replacementDepartmentId = input.replacementDepartmentId
          const replacement = membership.departmentMemberships.find(
            (item) => item.departmentId === replacementDepartmentId,
          )
          if (!replacement || replacementDepartmentId === currentDepartmentId) {
            throw conflict('Replacement must be another active department membership')
          }
          await validateRequestedDepartment(transaction, institutionId, replacementDepartmentId, now)
        } else if (input.replacementDepartmentId) {
          throw conflict('A replacement department is only valid when removing your primary department')
        }
      }

      if (input.changeType === 'TEACHER_PRIMARY_CHANGE') {
        currentDepartmentId = primary.departmentId
        requestedDepartmentId = input.requestedDepartmentId
        if (requestedDepartmentId === currentDepartmentId) {
          throw conflict('Select a department different from your current primary department')
        }
        const requested = membership.departmentMemberships.find(
          (item) => item.departmentId === requestedDepartmentId,
        )
        if (!requested) {
          throw conflict('You can only choose a department you already belong to')
        }
        await validateRequestedDepartment(transaction, institutionId, requestedDepartmentId, now)
      }

      const request = await transaction.departmentChangeRequest.create({
        data: {
          institutionId,
          membershipId,
          changeType: input.changeType,
          currentDepartmentId,
          requestedDepartmentId,
          replacementDepartmentId,
          reason: input.reason,
          requestedById: userId,
        },
        select: { id: true, status: true, changeType: true, requestedAt: true },
      })

      const notificationDepartmentIds = [...new Set(
        [currentDepartmentId, requestedDepartmentId, replacementDepartmentId].filter(Boolean),
      )]
      const assignments = notificationDepartmentIds.length
        ? await transaction.authorityDepartment.findMany({
            where: {
              institutionId,
              departmentId: { in: notificationDepartmentIds },
              authorityMembership: {
                role: 'AUTHORITY',
                status: 'ACTIVE',
                deletedAt: null,
              },
            },
            select: {
              departmentId: true,
              authorityMembership: { select: { id: true, userId: true } },
            },
          })
        : []
      const notifiedMemberships = new Map()
      for (const assignment of assignments) {
        const authority = assignment.authorityMembership
        if (!notifiedMemberships.has(authority.id)) {
          notifiedMemberships.set(authority.id, {
            ...authority,
            departmentId: assignment.departmentId,
          })
        }
      }
      const authorities = [...notifiedMemberships.values()]
      if (authorities.length > 0) {
        await transaction.notification.createMany({
          data: authorities.map((authority) => ({
            institutionId,
            departmentId: authority.departmentId,
            recipientId: authority.userId,
            recipientMembershipId: authority.id,
            type: 'DEPARTMENT_CHANGE_REQUEST_PENDING',
            title: 'New department change request',
            message: `A ${membership.role.toLowerCase()} submitted a ${input.changeType.toLowerCase().replaceAll('_', ' ')} request.`,
            relatedEntityType: 'DepartmentChangeRequest',
            relatedEntityId: request.id,
          })),
        })
      }

      await transaction.auditLog.create({
        data: {
          institutionId,
          departmentId: requestedDepartmentId || currentDepartmentId,
          actorId: userId,
          actorMembershipId: membershipId,
          action: 'DEPARTMENT_CHANGE_REQUEST_SUBMITTED',
          entityType: 'DepartmentChangeRequest',
          entityId: request.id,
          metadata: {
            changeType: input.changeType,
            currentDepartmentId,
            requestedDepartmentId,
          },
        },
      })

      return request
    })
  } catch (error) {
    throw mapCreateError(error)
  }
}

function serializeRequest(request) {
  return {
    id: request.id,
    institutionId: request.institutionId,
    membershipId: request.membershipId,
    changeType: request.changeType,
    currentDepartment: request.currentDepartment,
    requestedDepartment: request.requestedDepartment,
    replacementDepartment: request.replacementDepartment,
    reason: request.reason,
    status: request.status,
    requestedAt: request.requestedAt,
    reviewedAt: request.reviewedAt,
    requester: request.membership?.user,
    requesterRole: request.membership?.role,
    reviewer: request.reviewedBy,
  }
}

function requestSelection() {
  return {
    id: true,
    institutionId: true,
    membershipId: true,
    changeType: true,
    currentDepartmentId: true,
    requestedDepartmentId: true,
    replacementDepartmentId: true,
    reason: true,
    status: true,
    requestedAt: true,
    reviewedAt: true,
    currentDepartment: { select: { id: true, name: true } },
    requestedDepartment: { select: { id: true, name: true } },
    replacementDepartment: { select: { id: true, name: true } },
    membership: {
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    },
    reviewedBy: { select: { id: true, name: true, email: true } },
  }
}

async function listMemberDepartmentChanges(institutionId, membershipId, database = getDatabase()) {
  const requests = await database.departmentChangeRequest.findMany({
    where: { institutionId, membershipId },
    orderBy: { requestedAt: 'desc' },
    select: requestSelection(),
  })
  return requests.map(serializeRequest)
}

async function listAuthorityDepartmentChanges(
  institutionId,
  { status, role, departmentId } = {},
  database = getDatabase(),
  scope = null,
) {
  if (departmentId) ensureAuthorityDepartmentInScope(scope, departmentId)
  const departmentScope = visibleDepartmentScope(scope)
  const departmentFilter = departmentId
    ? {
        AND: [{
          AND: [{
            OR: [
              { requestedDepartmentId: departmentId },
              { currentDepartmentId: departmentId },
              { replacementDepartmentId: departmentId },
            ],
          }],
        }],
      }
    : {}
  const requests = await database.departmentChangeRequest.findMany({
    where: {
      institutionId,
      ...(status ? { status } : {}),
      ...(role ? { membership: { role } } : {}),
      ...departmentScope,
      ...departmentFilter,
    },
    orderBy: { requestedAt: 'desc' },
    select: requestSelection(),
  })
  return requests.map(serializeRequest)
}

async function getAuthorityDepartmentChange(
  institutionId,
  requestId,
  database = getDatabase(),
  scope = null,
) {
  const departmentScope = visibleDepartmentScope(scope)
  const request = await database.departmentChangeRequest.findFirst({
    where: { id: requestId, institutionId, ...departmentScope },
    select: requestSelection(),
  })
  if (!request) throw requestNotFound()
  return serializeRequest(request)
}

async function cancelMemberDepartmentChange(
  institutionId,
  membershipId,
  userId,
  requestId,
  { database = getDatabase(), now = new Date() } = {},
) {
  return database.$transaction(async (transaction) => {
    const request = await transaction.departmentChangeRequest.findFirst({
      where: { id: requestId, institutionId, membershipId, requestedById: userId, status: 'PENDING' },
      select: {
        id: true,
        changeType: true,
        currentDepartmentId: true,
        requestedDepartmentId: true,
      },
    })
    if (!request) throw requestNotFound()

    const updated = await transaction.departmentChangeRequest.updateMany({
      where: {
        id: requestId,
        institutionId,
        membershipId,
        requestedById: userId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    })
    if (updated.count !== 1) {
      throw conflict('This request has already been reviewed', 'DEPARTMENT_CHANGE_ALREADY_REVIEWED')
    }

    await transaction.auditLog.create({
      data: {
        institutionId,
        departmentId: request.requestedDepartmentId || request.currentDepartmentId,
        actorId: userId,
        actorMembershipId: membershipId,
        action: 'DEPARTMENT_CHANGE_REQUEST_CANCELLED',
        entityType: 'DepartmentChangeRequest',
        entityId: requestId,
        metadata: { changeType: request.changeType },
      },
    })

    return { id: requestId, status: 'CANCELLED', reviewedAt: null, cancelledAt: now }
  })
}

async function applyApprovedChange(transaction, request, now) {
  const { membershipId, institutionId, changeType } = request

  if (changeType === 'STUDENT_CHANGE') {
    const current = await transaction.departmentMembership.findFirst({
      where: { membershipId, institutionId, departmentId: request.currentDepartmentId, isActive: true },
      select: { id: true },
    })
    if (!current) throw conflict('The student no longer belongs to the current department')

    await transaction.departmentMembership.update({
      where: { id: current.id },
      data: { isActive: false, isPrimary: false },
    })

    const target = await transaction.departmentMembership.findFirst({
      where: { membershipId, institutionId, departmentId: request.requestedDepartmentId },
      select: { id: true, isActive: true },
    })
    if (target) {
      await transaction.departmentMembership.update({
        where: { id: target.id },
        data: { isActive: true, isPrimary: true },
      })
    } else {
      await transaction.departmentMembership.create({
        data: {
          institutionId,
          membershipId,
          departmentId: request.requestedDepartmentId,
          isActive: true,
          isPrimary: true,
        },
      })
    }
    return
  }

  if (changeType === 'TEACHER_ADD') {
    const existing = await transaction.departmentMembership.findFirst({
      where: {
        membershipId,
        institutionId,
        departmentId: request.requestedDepartmentId,
      },
      select: { id: true },
    })
    if (existing) {
      await transaction.departmentMembership.update({
        where: { id: existing.id },
        data: { isActive: true, isPrimary: false },
      })
    } else {
      await transaction.departmentMembership.create({
        data: {
          institutionId,
          membershipId,
          departmentId: request.requestedDepartmentId,
          isActive: true,
          isPrimary: false,
        },
      })
    }
    return
  }

  if (changeType === 'TEACHER_REMOVE') {
    const current = await transaction.departmentMembership.findFirst({
      where: { membershipId, institutionId, departmentId: request.currentDepartmentId, isActive: true },
      select: { id: true },
    })
    if (!current) throw conflict('The teacher no longer belongs to the requested department')

    await transaction.departmentMembership.update({
      where: { id: current.id },
      data: { isActive: false, isPrimary: false },
    })

    if (request.replacementDepartmentId) {
      const replacement = await transaction.departmentMembership.findFirst({
        where: {
          membershipId,
          institutionId,
          departmentId: request.replacementDepartmentId,
          isActive: true,
        },
        select: { id: true },
      })
      if (!replacement) throw conflict('The replacement department is no longer an active membership')
      await transaction.departmentMembership.update({
        where: { id: replacement.id },
        data: { isPrimary: true },
      })
    }
    return
  }

  if (changeType === 'TEACHER_PRIMARY_CHANGE') {
    const [current, target] = await Promise.all([
      transaction.departmentMembership.findFirst({
        where: {
          membershipId,
          institutionId,
          departmentId: request.currentDepartmentId,
          isActive: true,
        },
        select: { id: true },
      }),
      transaction.departmentMembership.findFirst({
        where: {
          membershipId,
          institutionId,
          departmentId: request.requestedDepartmentId,
          isActive: true,
        },
        select: { id: true },
      }),
    ])
    if (!current || !target) {
      throw conflict('The current or requested teacher department membership is no longer active')
    }
    await transaction.departmentMembership.update({
      where: { id: current.id },
      data: { isPrimary: false },
    })
    await transaction.departmentMembership.update({
      where: { id: target.id },
      data: { isPrimary: true },
    })
  }
}

async function decideDepartmentChange(
  institutionId,
  requestId,
  reviewer,
  decision,
  { database = getDatabase(), now = new Date(), scope = null } = {},
) {
  return database.$transaction(async (transaction) => {
    const decisionScope = decisionDepartmentScope(scope)
    const request = await transaction.departmentChangeRequest.findFirst({
      where: { id: requestId, institutionId, status: 'PENDING', ...decisionScope },
      select: {
        id: true,
        institutionId: true,
        membershipId: true,
        changeType: true,
        currentDepartmentId: true,
        requestedDepartmentId: true,
        replacementDepartmentId: true,
        requestedById: true,
        membership: {
          select: {
            role: true,
            user: { select: { name: true } },
          },
        },
      },
    })
    if (!request) throw requestNotFound()
    const targetDepartmentId = decisionDepartmentId(request)
    if (
      Array.isArray(scope?.departmentIds) &&
      !scope.departmentIds.includes(targetDepartmentId)
    ) {
      throw requestNotFound()
    }
    if (request.requestedById === reviewer.userId) {
      throw new ApiError(403, 'SELF_REVIEW_NOT_ALLOWED', 'You cannot review your own department change request')
    }

    if (decision === 'APPROVED') {
      if (
        request.changeType === 'STUDENT_CHANGE' ||
        request.changeType === 'TEACHER_ADD' ||
        request.changeType === 'TEACHER_PRIMARY_CHANGE'
      ) {
        await validateRequestedDepartment(transaction, institutionId, request.requestedDepartmentId, now)
      }
      if (request.changeType === 'TEACHER_REMOVE' && request.replacementDepartmentId) {
        await validateRequestedDepartment(transaction, institutionId, request.replacementDepartmentId, now)
      }
    }

    const updated = await transaction.departmentChangeRequest.updateMany({
      where: { id: requestId, institutionId, status: 'PENDING', ...decisionScope },
      data: {
        status: decision,
        reviewedById: reviewer.userId,
        reviewedByMembershipId: reviewer.membershipId,
        reviewedAt: now,
      },
    })
    if (updated.count !== 1) {
      throw conflict('This request has already been reviewed', 'DEPARTMENT_CHANGE_ALREADY_REVIEWED')
    }

    if (decision === 'APPROVED') {
      await applyApprovedChange(transaction, request, now)
    }

    await transaction.notification.create({
      data: {
        institutionId,
        departmentId: targetDepartmentId,
        recipientId: request.requestedById,
        recipientMembershipId: request.membershipId,
        type: `DEPARTMENT_CHANGE_REQUEST_${decision}`,
        title: `Department change request ${decision.toLowerCase()}`,
        message: `Your ${request.changeType.toLowerCase().replaceAll('_', ' ')} request was ${decision.toLowerCase()}.`,
        relatedEntityType: 'DepartmentChangeRequest',
        relatedEntityId: request.id,
      },
    })

    await transaction.auditLog.create({
      data: {
        institutionId,
        departmentId: targetDepartmentId,
        actorId: reviewer.userId,
        actorMembershipId: reviewer.membershipId,
        action: `DEPARTMENT_CHANGE_REQUEST_${decision}`,
        entityType: 'DepartmentChangeRequest',
        entityId: request.id,
        metadata: {
          changeType: request.changeType,
          membershipId: request.membershipId,
          currentDepartmentId: request.currentDepartmentId,
          requestedDepartmentId: request.requestedDepartmentId,
          replacementDepartmentId: request.replacementDepartmentId,
        },
      },
    })

    return { id: request.id, status: decision, reviewedAt: now, changeType: request.changeType }
  })
}

module.exports = {
  cancelMemberDepartmentChange,
  createDepartmentChangeRequest,
  decideDepartmentChange,
  getAuthorityDepartmentChange,
  listAuthorityDepartmentChanges,
  listMemberDepartmentChanges,
}
