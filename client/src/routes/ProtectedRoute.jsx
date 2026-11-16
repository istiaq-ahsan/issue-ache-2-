import { useQuery } from '@tanstack/react-query'
import { Navigate, useLocation } from 'react-router-dom'
import api from '../lib/api.js'
import { useAuth } from '../context/use-auth.js'
import InstitutionDashboardLayout from '../layouts/dashboards/InstitutionDashboardLayout.jsx'
import AuthorityDashboardLayout from '../layouts/dashboards/AuthorityDashboardLayout.jsx'
import StudentDashboardLayout from '../layouts/dashboards/StudentDashboardLayout.jsx'
import TeacherDashboardLayout from '../layouts/dashboards/TeacherDashboardLayout.jsx'
import { ErrorState, LoadingState } from '../components/ui/index.jsx'

const workspaceLayouts = {
  INSTITUTION: InstitutionDashboardLayout,
  AUTHORITY: AuthorityDashboardLayout,
  STUDENT: StudentDashboardLayout,
  TEACHER: TeacherDashboardLayout,
}

function ProtectedRoute({
  children,
  roles,
  institutionId,
  departmentId,
  allowInstitutionAdministrator = false,
  requireInstitutionAdministrator = false,
  allowAnyInstitutionAdministrator = false,
}) {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const {
    data: response,
    isLoading: profileLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'me', user?.uid],
    queryFn: async () => (await api.get('/auth/me')).data,
    enabled: Boolean(user),
    retry: false,
  })

  if (authLoading || (user && profileLoading)) {
    return <LoadingState label="Checking your access…" />
  }

  if (!user || isError) {
    if (user && error?.apiStatus >= 500) {
      return (
        <ErrorState
          message={error.apiMessage}
          onRetry={() => refetch()}
          title="Could not verify workspace access"
        />
      )
    }

    const roleLoginPaths = {
      AUTHORITY: '/authority/login',
      STUDENT: '/student/login',
      TEACHER: '/teacher/login',
    }
    const loginPath = requireInstitutionAdministrator
      ? '/institution/login'
      : roles?.length === 1
        ? roleLoginPaths[roles[0]] || '/login'
        : '/login'

    return (
      <Navigate
        to={loginPath}
        replace
        state={{ from: location }}
      />
    )
  }

  const memberships = response?.data?.memberships ?? []
  const administeredInstitutions =
    response?.data?.administeredInstitutions ?? []
  const permitted = !requireInstitutionAdministrator && memberships.some((membership) => {
    const institutionMatches =
      !institutionId || membership.institutionId === institutionId
    const roleMatches = !roles?.length || roles.includes(membership.role)
    const activeDepartment = membership.role === 'AUTHORITY'
      ? membership.authorityDepartments?.some(
          ({ department }) => !departmentId || department.id === departmentId,
        )
      : membership.departmentMemberships?.some(
          ({ department }) => !departmentId || department.id === departmentId,
        )

    return (
      institutionMatches &&
      roleMatches &&
      membership.status === 'ACTIVE' &&
      activeDepartment
    )
  })
  const administratorPermitted =
    allowInstitutionAdministrator &&
    (allowAnyInstitutionAdministrator
      ? administeredInstitutions.length > 0
      : !roles?.length &&
        administeredInstitutions.some(
          (institution) => institution.id === institutionId,
        ))

  if (!permitted && !administratorPermitted) {
    return <Navigate to="/" replace />
  }

  const workspaceRole = requireInstitutionAdministrator ||
    (allowInstitutionAdministrator &&
      administeredInstitutions.some((institution) => institution.id === institutionId))
    ? 'INSTITUTION'
    : roles?.[0] ||
      memberships.find(
        (membership) =>
          (!institutionId || membership.institutionId === institutionId) &&
          membership.status === 'ACTIVE' &&
          !membership.deletedAt,
      )?.role
  const workspaceInstitutionId =
    institutionId ||
    (workspaceRole === 'INSTITUTION' && administeredInstitutions.length === 1
      ? administeredInstitutions[0].id
      : undefined)

  const DashboardLayout = workspaceLayouts[workspaceRole]
  if (!DashboardLayout || !workspaceInstitutionId) return children

  return (
    <DashboardLayout institutionId={workspaceInstitutionId}>
      {children}
    </DashboardLayout>
  )
}

export default ProtectedRoute
