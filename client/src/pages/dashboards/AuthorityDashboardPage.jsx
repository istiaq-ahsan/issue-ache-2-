import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ClipboardCheck, FileClock, MessageSquareWarning, UsersRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api.js'
import { ErrorState, LoadingState } from '../../components/ui/index.jsx'

function SummaryCard({ count, description, href, icon: Icon, label }) {
  return (
    <Link className="authority-summary-card" to={href}>
      <span className="authority-summary-icon"><Icon aria-hidden="true" size={19} /></span>
      <div className="authority-summary-copy">
        <p>{label}</p>
        <strong>{count}</strong>
        <span>{description}</span>
      </div>
      <ArrowRight aria-hidden="true" className="authority-summary-arrow" size={17} />
    </Link>
  )
}

function AuthorityDashboardPage() {
  const { institutionId } = useParams()
  const id = encodeURIComponent(institutionId)
  const overview = useQuery({
    queryKey: ['authority-overview', institutionId],
    queryFn: async () => {
      const [registrations, requests, issues, notifications] = await Promise.all([
        api.get(`/authority/institutions/${id}/pending-registrations`),
        api.get(`/authority/institutions/${id}/department-change-requests`, {
          params: { status: 'PENDING' },
        }),
        api.get(`/issues/${id}`, { params: { archived: 'false' } }),
        api.get(`/notifications/${id}`, { params: { limit: 1, unreadOnly: 'true' } }),
      ])

      return {
        registrations: registrations.data.data.registrations,
        requests: requests.data.data.requests,
        issues: issues.data.data.issues,
        unreadCount: notifications.data.data.unreadCount,
      }
    },
    retry: false,
  })

  if (overview.isLoading) return <LoadingState label="Loading Authority overview…" />
  if (overview.isError) {
    return (
      <ErrorState
        message={overview.error.apiMessage || overview.error.response?.data?.error?.message}
        onRetry={() => overview.refetch()}
      />
    )
  }

  const data = overview.data
  const institutionPath = `/authority/institutions/${id}`
  const issueCounts = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => ({
    status,
    count: data.issues.filter((issue) => issue.status === status).length,
  }))

  return (
    <main className="authority-dashboard">
      <header className="authority-dashboard-heading">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Authority workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Institution overview</h1>
          <p className="mt-2 text-slate-600">A live view of approvals, department requests, and campus issues.</p>
        </div>
        <Link className="authority-audit-link" to={`${institutionPath}/audit-logs`}>
          <FileClock aria-hidden="true" size={17} /> Audit logs
        </Link>
      </header>

      <section aria-label="Authority workload" className="authority-summary-grid">
        <SummaryCard
          count={data.registrations.length}
          description="Students and teachers awaiting review"
          href={`${institutionPath}/pending-registrations`}
          icon={ClipboardCheck}
          label="Pending registrations"
        />
        <SummaryCard
          count={data.requests.length}
          description="Requests that need a decision"
          href={`${institutionPath}/department-change-requests`}
          icon={UsersRound}
          label="Department requests"
        />
        <SummaryCard
          count={data.issues.length}
          description="Active, non-archived issues"
          href={`${institutionPath}/issues`}
          icon={MessageSquareWarning}
          label="Campus issues"
        />
        <SummaryCard
          count={data.unreadCount}
          description="Updates for your workspace"
          href={`/notifications/${id}`}
          icon={FileClock}
          label="Unread notifications"
        />
      </section>

      <section aria-label="Issue status overview" className="authority-issue-overview">
        <div>
          <h2>Issue status</h2>
          <p>Current status across issues in your institution.</p>
        </div>
        <div className="authority-issue-statuses">
          {issueCounts.map(({ count, status }) => (
            <div className="authority-issue-status" key={status}>
              <span>{status.replaceAll('_', ' ')}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default AuthorityDashboardPage
