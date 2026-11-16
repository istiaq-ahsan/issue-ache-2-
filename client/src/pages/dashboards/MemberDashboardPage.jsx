import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Bell, Building2, CircleAlert, MessageSquareWarning, UserRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api.js'
import { ErrorState, LoadingState } from '../../components/ui/index.jsx'

function DashboardLink({ children, href, icon: Icon }) {
  return (
    <Link className="member-dashboard-link" to={href}>
      <Icon aria-hidden="true" size={18} />
      <span>{children}</span>
      <ArrowRight aria-hidden="true" className="member-link-arrow" size={16} />
    </Link>
  )
}

function MemberDashboardPage() {
  const { institutionId } = useParams()
  const id = encodeURIComponent(institutionId)
  const profile = useQuery({
    queryKey: ['member-profile', institutionId],
    queryFn: async () => (await api.get(`/institutions/${id}/profile`)).data.data.profile,
    retry: false,
  })
  const issues = useQuery({
    queryKey: ['issues', institutionId, 'member-dashboard'],
    queryFn: async () => (await api.get(`/issues/${id}`, {
      params: { archived: 'false' },
    })).data.data.issues,
    retry: false,
  })
  const requests = useQuery({
    queryKey: ['department-change-requests', institutionId],
    queryFn: async () => (await api.get(`/institutions/${id}/department-change-requests`))
      .data.data.requests,
    retry: false,
  })
  const notifications = useQuery({
    queryKey: ['notifications', institutionId, 'unread-count'],
    queryFn: async () => (await api.get(`/notifications/${id}`, {
      params: { limit: 1, unreadOnly: 'true' },
    })).data.data,
    retry: false,
  })

  const queries = [profile, issues, requests, notifications]
  if (queries.some((query) => query.isLoading)) {
    return <LoadingState label="Loading your campus overview…" />
  }
  const failedQuery = queries.find((query) => query.isError)
  if (failedQuery) {
    return (
      <ErrorState
        message={failedQuery.error.apiMessage || failedQuery.error.response?.data?.error?.message}
        onRetry={() => queries.filter((query) => query.isError).forEach((query) => query.refetch())}
      />
    )
  }

  const member = profile.data
  const role = member.role.toLowerCase()
  const pendingRequestCount = requests.data.filter((request) => request.status === 'PENDING').length
  const pendingIssues = issues.data.filter((issue) => issue.status === 'OPEN' || issue.status === 'IN_PROGRESS').length
  const departmentCount = member.departments.length
  const overviewCards = [
    { label: 'My reported issues', value: issues.data.length, icon: MessageSquareWarning },
    { label: 'Awaiting follow-up', value: pendingIssues, icon: CircleAlert },
    { label: 'Department requests', value: pendingRequestCount, icon: Building2 },
    { label: 'Unread notifications', value: notifications.data.unreadCount, icon: Bell },
  ]

  return (
    <main className="member-dashboard">
      <header className="member-dashboard-heading">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{member.role.toLowerCase()} workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Welcome, {member.user.name}
          </h1>
          <p className="mt-2 text-slate-600">{member.institution.name}</p>
        </div>
        <Link className="member-dashboard-primary" to={`/${role}/issues/${id}/new`}>
          Report an issue <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </header>

      <section aria-label="Your campus overview" className="member-overview-grid">
        {overviewCards.map(({ icon: Icon, label, value }) => (
          <article className="member-overview-card" key={label}>
            <span><Icon aria-hidden="true" size={18} /></span>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="member-campus-card">
        <div className="member-campus-title">
          <span><Building2 aria-hidden="true" size={19} /></span>
          <div>
            <h2>Your department{departmentCount === 1 ? '' : 's'}</h2>
            <p>Active department access in your institution</p>
          </div>
        </div>
        <div className="member-department-list">
          {member.departments.length === 0 ? (
            <p className="member-no-departments">No active departments are associated with your profile.</p>
          ) : member.departments.map((department) => (
            <span className="member-department-chip" key={department.id}>
              {department.name}{department.isPrimary && <small>Primary</small>}
            </span>
          ))}
        </div>
      </section>

      <section aria-label="Your workspace" className="member-dashboard-links">
        <DashboardLink href={`/${role}/profile/${id}`} icon={UserRound}>My profile and department requests</DashboardLink>
        <DashboardLink href={`/${role}/issues/${id}`} icon={MessageSquareWarning}>My reported issues</DashboardLink>
        <DashboardLink href={`/notifications/${id}`} icon={Bell}>Notifications</DashboardLink>
      </section>
      <p className="member-dashboard-email">{member.user.email}</p>
    </main>
  )
}

export default MemberDashboardPage
