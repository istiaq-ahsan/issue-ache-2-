import WorkspaceLayout from '../workspace/WorkspaceLayout.jsx'

function AuthorityDashboardLayout({ children, institutionId }) {
  return <WorkspaceLayout institutionId={institutionId} role="AUTHORITY">{children}</WorkspaceLayout>
}

export default AuthorityDashboardLayout
