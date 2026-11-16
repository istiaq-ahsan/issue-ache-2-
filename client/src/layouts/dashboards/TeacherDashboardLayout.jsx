import WorkspaceLayout from '../workspace/WorkspaceLayout.jsx'

function TeacherDashboardLayout({ children, institutionId }) {
  return <WorkspaceLayout institutionId={institutionId} role="TEACHER">{children}</WorkspaceLayout>
}

export default TeacherDashboardLayout
