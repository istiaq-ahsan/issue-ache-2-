function isActiveMembership(membership, role) {
  return (
    membership.role === role &&
    membership.status === 'ACTIVE' &&
    !membership.deletedAt
  )
}

function hasEligibleDepartment(membership) {
  return membership.departmentMemberships?.some(
    ({ department }) =>
      department.status === 'ACTIVE' && department.subscriptions?.length > 0,
  )
}

function getInstitutionIdFromPath(accountType, from) {
  const pathname = from?.pathname
  if (typeof pathname !== 'string') return null

  if (accountType === 'institution') {
    if (pathname === '/institution/dashboard') return null
    if (pathname === '/institution/authorities') {
      return new URLSearchParams(from.search || '').get('institutionId')
    }

    const match = pathname.match(/^\/institution\/dashboard\/([^/]+)(?:\/|$)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  if (accountType === 'authority') {
    const match = pathname.match(/^\/authority\/institutions\/([^/]+)(?:\/|$)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  const match = pathname.match(
    new RegExp(`^/${accountType}/(?:dashboard|profile|issues)/([^/]+)(?:/|$)`),
  )
  return match ? decodeURIComponent(match[1]) : null
}

export function getLoginCandidates(accountType, profile) {
  if (accountType === 'institution') {
    return profile.administeredInstitutions || []
  }

  const role = accountType.toUpperCase()
  const memberships = profile.memberships || []
  const activeMemberships = memberships.filter((membership) =>
    isActiveMembership(membership, role),
  )

  if (accountType === 'authority') return activeMemberships

  return activeMemberships.filter(hasEligibleDepartment)
}

export function hasPendingRegistration(accountType, profile) {
  if (accountType !== 'student' && accountType !== 'teacher') return false

  const role = accountType.toUpperCase()
  return (profile.memberships || []).some(
    (membership) =>
      membership.role === role &&
      !membership.deletedAt &&
      ['PENDING', 'REJECTED'].includes(membership.status),
  )
}

export function getLoginDestination(accountType, institutionId) {
  const id = encodeURIComponent(institutionId)
  if (accountType === 'institution') return `/institution/dashboard/${id}`
  if (accountType === 'authority') {
    return `/authority/institutions/${id}/dashboard`
  }
  return `/${accountType}/dashboard/${id}`
}

export function getAuthorizedReturnPath(accountType, from, candidates) {
  const pathname = from?.pathname
  if (typeof pathname !== 'string' || pathname.startsWith('//')) return null

  if (accountType === 'institution' && pathname === '/institution/dashboard') {
    return candidates.length > 0
      ? `${pathname}${from.search || ''}${from.hash || ''}`
      : null
  }

  const institutionId = getInstitutionIdFromPath(accountType, from)
  const isAuthorizedInstitution = candidates.some((candidate) =>
    accountType === 'institution'
      ? candidate.id === institutionId
      : candidate.institutionId === institutionId,
  )
  if (!institutionId || !isAuthorizedInstitution) {
    return null
  }

  return `${pathname}${from.search || ''}${from.hash || ''}`
}
