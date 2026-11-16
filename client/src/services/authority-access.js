export function getActiveAuthorityDashboardPath(memberships) {
  const activeMemberships = memberships.filter(
    (item) =>
      item.role === 'AUTHORITY' &&
      item.status === 'ACTIVE' &&
      !item.deletedAt,
  )

  if (activeMemberships.length !== 1) return null

  return `/authority/institutions/${encodeURIComponent(activeMemberships[0].institutionId)}/dashboard`
}

export function getAuthorityLoginError(error) {
  if (
    error.code === 'auth/invalid-credential' ||
    error.code === 'auth/user-not-found' ||
    error.code === 'auth/wrong-password'
  ) {
    return 'Email or password is incorrect.'
  }
  if (error.response?.status === 403) {
    return 'This account does not have an active Authority membership. Use the sign-in page for your account role.'
  }
  return (
    error.apiMessage ||
    error.response?.data?.error?.message ||
    error.message ||
    'Unable to sign in. Please try again.'
  )
}
