import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import IntroScreen from './components/IntroScreen.jsx'
import AuthLayout from './layouts/auth/AuthLayout.jsx'
import PublicLayout from './layouts/public/PublicLayout.jsx'
import InstitutionDashboardPage from './pages/dashboards/InstitutionDashboardPage.jsx'
import InstitutionDashboardIndexPage from './pages/dashboards/InstitutionDashboardIndexPage.jsx'
import InstitutionRegisterPage from './pages/registration/InstitutionRegisterPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RoleLoginPage from './pages/auth/RoleLoginPage.jsx'
import HomePage from './pages/public/HomePage.jsx'
import DashboardPage from './pages/public/DashboardPage.jsx'
import AboutPage from './pages/public/AboutPage.jsx'
import HowItWorksPage from './pages/public/HowItWorksPage.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import InstitutionManagementPage from './pages/institution/InstitutionManagementPage.jsx'
import DepartmentListPage from './pages/departments/DepartmentListPage.jsx'
import DepartmentDetailsPage from './pages/departments/DepartmentDetailsPage.jsx'
import StudentRegisterPage from './pages/registration/StudentRegisterPage.jsx'
import TeacherRegisterPage from './pages/registration/TeacherRegisterPage.jsx'
import RegistrationStatusPage from './pages/registration/RegistrationStatusPage.jsx'
import MemberDashboardPage from './pages/dashboards/MemberDashboardPage.jsx'
import AuthorityPendingRegistrationsPage from './pages/authority/AuthorityPendingRegistrationsPage.jsx'
import AuthorityDashboardPage from './pages/dashboards/AuthorityDashboardPage.jsx'
import RegistrationDetailsPage from './pages/registration/RegistrationDetailsPage.jsx'
import AuthorityLoginPage from './pages/auth/AuthorityLoginPage.jsx'
import MemberProfilePage from './pages/members/MemberProfilePage.jsx'
import AuthorityDepartmentChangesPage from './pages/authority/AuthorityDepartmentChangesPage.jsx'
import AuthorityDepartmentChangeDetailsPage from './pages/authority/AuthorityDepartmentChangeDetailsPage.jsx'
import IssueListPage from './pages/issues/IssueListPage.jsx'
import IssueCreatePage from './pages/issues/IssueCreatePage.jsx'
import IssueDetailsPage from './pages/issues/IssueDetailsPage.jsx'
import NotificationsPage from './pages/system/NotificationsPage.jsx'
import AuditLogPage from './pages/system/AuditLogPage.jsx'

const INTRO_SESSION_KEY = 'issue-ache-intro-shown'
let introDisplayDecision

function shouldShowIntro() {
  if (introDisplayDecision !== undefined) return introDisplayDecision

  try {
    const storage = window.sessionStorage
    introDisplayDecision = storage.getItem(INTRO_SESSION_KEY) === null
    if (introDisplayDecision) storage.setItem(INTRO_SESSION_KEY, 'true')
  } catch {
    introDisplayDecision = true
  }

  return introDisplayDecision
}

function App() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const [showIntro, setShowIntro] = useState(shouldShowIntro)

  useEffect(() => {
    function updateTheme(event) {
      setTheme(event.detail)
    }

    window.addEventListener('issue-ache-theme-change', updateTheme)
    return () => window.removeEventListener('issue-ache-theme-change', updateTheme)
  }, [])

  return (
    <>
      <Routes>
        <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
        <Route path="/dashboard" element={<PublicLayout><DashboardPage /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><AboutPage /></PublicLayout>} />
        <Route path="/how-it-works" element={<PublicLayout><HowItWorksPage /></PublicLayout>} />
        <Route path="/institution/register" element={<AuthLayout><InstitutionRegisterPage /></AuthLayout>} />
        <Route path="/student/register" element={<AuthLayout><StudentRegisterPage /></AuthLayout>} />
        <Route path="/teacher/register" element={<AuthLayout><TeacherRegisterPage /></AuthLayout>} />
        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/authority/login" element={<AuthLayout><AuthorityLoginPage /></AuthLayout>} />
        <Route path="/institution/login" element={<AuthLayout><RoleLoginPage accountType="institution" /></AuthLayout>} />
        <Route path="/student/login" element={<AuthLayout><RoleLoginPage accountType="student" /></AuthLayout>} />
        <Route path="/teacher/login" element={<AuthLayout><RoleLoginPage accountType="teacher" /></AuthLayout>} />
        <Route path="/registration/status" element={<AuthLayout><RegistrationStatusPage /></AuthLayout>} />
        <Route
          path="/student/dashboard/:institutionId"
          element={<MemberDashboardRoute role="STUDENT" />}
        />
        <Route
          path="/teacher/dashboard/:institutionId"
          element={<MemberDashboardRoute role="TEACHER" />}
        />
        <Route
          path="/student/profile/:institutionId"
          element={<MemberProfileRoute role="STUDENT" />}
        />
        <Route
          path="/teacher/profile/:institutionId"
          element={<MemberProfileRoute role="TEACHER" />}
        />
        <Route
          path="/student/issues/:institutionId"
          element={<MemberIssueListRoute role="STUDENT" />}
        />
        <Route
          path="/student/issues/:institutionId/new"
          element={<MemberIssueCreateRoute role="STUDENT" />}
        />
        <Route
          path="/student/issues/:institutionId/:issueId"
          element={<MemberIssueDetailsRoute role="STUDENT" />}
        />
        <Route
          path="/teacher/issues/:institutionId"
          element={<MemberIssueListRoute role="TEACHER" />}
        />
        <Route
          path="/teacher/issues/:institutionId/new"
          element={<MemberIssueCreateRoute role="TEACHER" />}
        />
        <Route
          path="/teacher/issues/:institutionId/:issueId"
          element={<MemberIssueDetailsRoute role="TEACHER" />}
        />
        <Route
          path="/authority/institutions/:institutionId/dashboard"
          element={<AuthorityDashboardRoute />}
        />
        <Route
          path="/authority/institutions/:institutionId/issues"
          element={<AuthorityIssueListRoute />}
        />
        <Route
          path="/authority/institutions/:institutionId/issues/:issueId"
          element={<AuthorityIssueDetailsRoute />}
        />
        <Route
          path="/notifications/:institutionId"
          element={<NotificationsRoute />}
        />
        <Route
          path="/authority/institutions/:institutionId/audit-logs"
          element={<AuthorityAuditLogRoute />}
        />
        <Route
          path="/institution/dashboard/:institutionId/audit-logs"
          element={<InstitutionAuditLogRoute />}
        />
        <Route
          path="/authority/institutions/:institutionId/department-change-requests"
          element={<AuthorityDepartmentChangesRoute />}
        />
        <Route
          path="/authority/institutions/:institutionId/department-change-requests/:requestId"
          element={<AuthorityDepartmentChangeDetailsRoute />}
        />
        <Route
          path="/authority/institutions/:institutionId/pending-registrations"
          element={<AuthorityPendingRegistrationsRoute />}
        />
        <Route
          path="/authority/institutions/:institutionId/pending-registrations/:membershipId"
          element={<AuthorityRegistrationDetailsRoute />}
        />
        <Route
          path="/institution/dashboard"
          element={
            <ProtectedRoute
              allowAnyInstitutionAdministrator
              allowInstitutionAdministrator
              requireInstitutionAdministrator
            >
              <InstitutionDashboardIndexPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/institution/dashboard/:institutionId"
          element={
            <InstitutionDashboardRoute />
          }
        />
        <Route
          path="/institution/dashboard/:institutionId/departments"
          element={<InstitutionDepartmentListRoute />}
        />
        <Route
          path="/institution/dashboard/:institutionId/departments/:departmentId"
          element={<InstitutionDepartmentDetailsRoute />}
        />
        <Route
          path="/institution/authorities"
          element={<InstitutionManagementRoute section="authorities" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showIntro && <IntroScreen onComplete={setShowIntro} />}
      <Toaster closeButton position="top-right" richColors theme={theme} />
    </>
  )
}

function InstitutionDashboardRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute
      allowInstitutionAdministrator
      institutionId={institutionId}
      requireInstitutionAdministrator
    >
      <InstitutionDashboardPage />
    </ProtectedRoute>
  )
}

function InstitutionManagementRoute({ section }) {
  const [searchParams] = useSearchParams()
  const institutionId = searchParams.get('institutionId')
  if (!institutionId) return <Navigate to="/institution/dashboard" replace />

  return (
    <ProtectedRoute
      allowInstitutionAdministrator
      institutionId={institutionId}
      requireInstitutionAdministrator
    >
      <InstitutionManagementPage institutionId={institutionId} section={section} />
    </ProtectedRoute>
  )
}

function InstitutionDepartmentListRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute
      allowInstitutionAdministrator
      institutionId={institutionId}
      requireInstitutionAdministrator
    >
      <DepartmentListPage institutionId={institutionId} />
    </ProtectedRoute>
  )
}

function InstitutionDepartmentDetailsRoute() {
  const { institutionId, departmentId } = useParams()
  return (
    <ProtectedRoute
      allowInstitutionAdministrator
      institutionId={institutionId}
      requireInstitutionAdministrator
    >
      <DepartmentDetailsPage
        institutionId={institutionId}
        departmentId={departmentId}
      />
    </ProtectedRoute>
  )
}

function MemberDashboardRoute({ role }) {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={[role]} institutionId={institutionId}>
      <MemberDashboardPage role={role} />
    </ProtectedRoute>
  )
}

function MemberProfileRoute({ role }) {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={[role]} institutionId={institutionId}>
      <MemberProfilePage />
    </ProtectedRoute>
  )
}

function AuthorityDepartmentChangesRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={['AUTHORITY']} institutionId={institutionId}>
      <AuthorityDepartmentChangesPage />
    </ProtectedRoute>
  )
}

function AuthorityDashboardRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={['AUTHORITY']} institutionId={institutionId}>
      <AuthorityDashboardPage />
    </ProtectedRoute>
  )
}

function AuthorityDepartmentChangeDetailsRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={['AUTHORITY']} institutionId={institutionId}>
      <AuthorityDepartmentChangeDetailsPage />
    </ProtectedRoute>
  )
}

function MemberIssueListRoute({ role }) {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={[role]} institutionId={institutionId}>
      <IssueListPage role={role} />
    </ProtectedRoute>
  )
}

function MemberIssueCreateRoute({ role }) {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={[role]} institutionId={institutionId}>
      <IssueCreatePage role={role} />
    </ProtectedRoute>
  )
}

function MemberIssueDetailsRoute({ role }) {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={[role]} institutionId={institutionId}>
      <IssueDetailsPage role={role} />
    </ProtectedRoute>
  )
}

function AuthorityIssueListRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={['AUTHORITY']} institutionId={institutionId}>
      <IssueListPage role="AUTHORITY" />
    </ProtectedRoute>
  )
}

function AuthorityIssueDetailsRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={['AUTHORITY']} institutionId={institutionId}>
      <IssueDetailsPage role="AUTHORITY" />
    </ProtectedRoute>
  )
}

function NotificationsRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute institutionId={institutionId} allowInstitutionAdministrator>
      <NotificationsPage />
    </ProtectedRoute>
  )
}

function AuthorityAuditLogRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={['AUTHORITY']} institutionId={institutionId}>
      <AuditLogPage isAuthority />
    </ProtectedRoute>
  )
}

function InstitutionAuditLogRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute
      allowInstitutionAdministrator
      institutionId={institutionId}
      requireInstitutionAdministrator
    >
      <AuditLogPage />
    </ProtectedRoute>
  )
}

function AuthorityPendingRegistrationsRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={['AUTHORITY']} institutionId={institutionId}>
      <AuthorityPendingRegistrationsPage />
    </ProtectedRoute>
  )
}

function AuthorityRegistrationDetailsRoute() {
  const { institutionId } = useParams()
  return (
    <ProtectedRoute roles={['AUTHORITY']} institutionId={institutionId}>
      <RegistrationDetailsPage />
    </ProtectedRoute>
  )
}

export default App
