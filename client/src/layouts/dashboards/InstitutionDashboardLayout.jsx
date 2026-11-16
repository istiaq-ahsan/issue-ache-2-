import WorkspaceLayout from '../workspace/WorkspaceLayout.jsx'

function InstitutionDashboardLayout({ children, institutionId }) {
  return <WorkspaceLayout institutionId={institutionId} role="INSTITUTION">{children}</WorkspaceLayout>
}

export default InstitutionDashboardLayout
