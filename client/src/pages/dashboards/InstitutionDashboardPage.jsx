import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api.js'

function formatStatus(status) {
  return status.toLowerCase().replaceAll('_', ' ')
}

function Statistic({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function InstitutionDashboardPage() {
  const { institutionId } = useParams()
  const dashboard = useQuery({
    queryKey: ['institution-dashboard', institutionId],
    queryFn: async () => (await api.get(`/institutions/${institutionId}/dashboard`)).data.data,
    retry: false,
  })

  if (dashboard.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-12">
        <p role="status">Loading institution dashboard…</p>
      </main>
    )
  }

  if (dashboard.isError) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900" role="alert">
          <h1 className="text-xl font-semibold">Could not load this institution</h1>
          <p className="mt-2">
            {dashboard.error.response?.data?.error?.message ||
              'The dashboard is unavailable. Check your access and try again.'}
          </p>
          <button
            className="mt-4 font-semibold underline"
            onClick={() => dashboard.refetch()}
            type="button"
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  const data = dashboard.data
  const departmentStats = data.departments.byStatus
  const subscriptionRows = data.subscriptions.recent
  const paymentRows = data.payments.recent
  const memberCount = (role, status) =>
    data.memberships.find((membership) => membership.role === role && membership.status === status)?.count || 0
  const issueCount = (audience) =>
    data.issues
      .filter((issue) => issue.audience === audience)
      .reduce((total, issue) => total + issue.count, 0)

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Institution dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {data.institution.name}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Institution Code <span className="font-semibold text-slate-900">{data.institution.institutionCode}</span>
          </p>
        </div>
      </header>

      <section aria-label="Department statistics" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Statistic label="Departments" value={data.departments.total} />
        <Statistic label="Active departments" value={departmentStats.ACTIVE || 0} />
        <Statistic label="Locked departments" value={departmentStats.LOCKED || 0} />
        <Statistic label="Expired departments" value={departmentStats.EXPIRED || 0} />
      </section>

      <section aria-label="Institution overview" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Statistic label="Students" value={memberCount('STUDENT', 'ACTIVE')} />
        <Statistic label="Pending students" value={memberCount('STUDENT', 'PENDING')} />
        <Statistic label="Teachers" value={memberCount('TEACHER', 'ACTIVE')} />
        <Statistic label="Pending teachers" value={memberCount('TEACHER', 'PENDING')} />
        <Statistic label="Student issues" value={issueCount('STUDENT')} />
        <Statistic label="Teacher issues" value={issueCount('TEACHER')} />
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Institution details</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Contact person</dt><dd className="mt-1 font-medium">{data.institution.contactPersonName}</dd></div>
          <div><dt className="text-slate-500">Contact email</dt><dd className="mt-1 font-medium">{data.institution.contactEmail}</dd></div>
          <div><dt className="text-slate-500">Campus type</dt><dd className="mt-1 font-medium">{data.institution.campusType}</dd></div>
          <div><dt className="text-slate-500">Campus size</dt><dd className="mt-1 font-medium">{data.institution.campusSize}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Location</dt><dd className="mt-1 font-medium">{data.institution.location}</dd></div>
        </dl>
      </section>

      <section aria-label="Subscription and payment statistics" className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Subscriptions by status</h2>
          <p className="mt-2 text-sm text-slate-600">
            Active {data.subscriptions.byStatus.ACTIVE || 0}
            {' · '}Expired {data.subscriptions.byStatus.EXPIRED || 0}
            {' · '}Cancelled {data.subscriptions.byStatus.CANCELLED || 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Payments by status</h2>
          <p className="mt-2 text-sm text-slate-600">
            Successful {data.payments.byStatus.SUCCESSFUL || 0}
            {' · '}Pending {data.payments.byStatus.PENDING || 0}
            {' · '}Failed {data.payments.byStatus.FAILED || 0}
            {' · '}Cancelled {data.payments.byStatus.CANCELLED || 0}
          </p>
        </div>
      </section>

      <nav aria-label="Institution management" className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          to={`/institution/dashboard/${encodeURIComponent(institutionId)}/departments`}
        >
          Manage departments
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          to={`/institution/authorities?institutionId=${encodeURIComponent(institutionId)}`}
        >
          Manage Authorities
        </Link>
        <Link
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          to={`/institution/dashboard/${encodeURIComponent(institutionId)}/audit-logs`}
        >
          View audit logs
        </Link>
      </nav>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-950">Subscriptions</h2>
        {subscriptionRows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">
            No subscriptions yet. Activate a department to see subscription details here.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Term</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionRows.map((subscription) => (
                  <tr className="border-t border-slate-100" key={subscription.id}>
                    <td className="px-4 py-3">{subscription.planName}</td>
                    <td className="px-4 py-3">{subscription.department.name}</td>
                    <td className="px-4 py-3 capitalize">{formatStatus(subscription.status)}</td>
                    <td className="px-4 py-3">
                      {new Date(subscription.startsAt).toLocaleDateString()} –{' '}
                      {new Date(subscription.endsAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-950">Recent payments</h2>
        {paymentRows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">
            No payments have been recorded.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((payment) => (
                  <tr className="border-t border-slate-100" key={payment.id}>
                    <td className="px-4 py-3">{payment.department.name}</td>
                    <td className="px-4 py-3">{payment.amount} {payment.currency}</td>
                    <td className="px-4 py-3 capitalize">{formatStatus(payment.status)}</td>
                    <td className="px-4 py-3">{new Date(payment.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default InstitutionDashboardPage
