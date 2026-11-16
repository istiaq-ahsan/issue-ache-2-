import WorkspaceLayout from '../workspace/WorkspaceLayout.jsx'

function StudentDashboardLayout({ children, institutionId }) {
  return <WorkspaceLayout institutionId={institutionId} role="STUDENT">{children}</WorkspaceLayout>
}

export default StudentDashboardLayout
