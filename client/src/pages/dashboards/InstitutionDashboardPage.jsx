import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api.js'

function Statistic({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function InstitutionDashboardPage() {
  const { institutionId } = useParams()
  const dashboard = useQuery({
    queryKey: ['institution-dashboard-overview', institutionId],
    queryFn: async () => {
      const encodedId = encodeURIComponent(institutionId)
      const [overview, departments, authorities, billing, plans] = await Promise.all([
        api.get(`/institutions/${encodedId}/dashboard`),
        api.get(`/institutions/${encodedId}/departments`),
        api.get(`/institutions/${encodedId}/authorities`),
        api.get('/subscriptions/current', {
          headers: { 'X-Institution-Id': institutionId },
        }),
        api.get('/plans'),
      ])
      return {
        overview: overview.data.data,
        departments: departments.data.data.departments,
        authorities: authorities.data.data.authorities,
        billing: billing.data.data,
        plans: plans.data.data.plans,
      }
    },
    retry: false,
  })

  if (dashboard.isLoading) {
    return <main className="mx-auto max-w-6xl px-5 py-12"><p role="status">Loading institution dashboard…</p></main>
  }
  if (dashboard.isError) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900" role="alert">
          <h1 className="text-xl font-semibold">Could not load this institution</h1>
          <p className="mt-2">{dashboard.error.apiMessage || 'The dashboard is unavailable. Check your access and try again.'}</p>
          <button className="mt-4 font-semibold underline" onClick={() => dashboard.refetch()} type="button">Try again</button>
        </div>
      </main>
    )
  }

  const { overview, departments, authorities, billing, plans } = dashboard.data
  const institutionPath = `/institution/dashboard/${encodeURIComponent(institutionId)}`
  const membersByRole = (role) => overview.memberships
    .filter((entry) => entry.role === role)
    .reduce((total, entry) => total + entry.count, 0)
  const issuesByAudience = (audience) => overview.issues
    .filter((issue) => issue.audience === audience)
    .reduce((total, issue) => total + issue.count, 0)
  const assignedDepartmentIds = new Set(
    authorities
      .filter((authority) => !authority.deletedAt)
      .flatMap((authority) => authority.departments.map(({ id }) => id)),
  )
  const departmentsWithoutAuthority = departments.filter(({ id }) => !assignedDepartmentIds.has(id))
  const subscription = billing.current
  const authorityLimit = plans.find(({ code }) => code === subscription?.planCode)
    ?.limits?.maxAuthoritiesPerDepartment
  const departmentsOverLimit = Number.isInteger(authorityLimit)
    ? departments.filter(({ authorityUsage }) => authorityUsage?.used > authorityLimit)
    : []

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Institution dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{overview.institution.name}</h1>
          <p className="mt-2 text-sm text-slate-600">Institution Code <span className="font-semibold text-slate-900">{overview.institution.institutionCode}</span></p>
        </div>
        <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50" to={`/institution/subscriptions?institutionId=${encodeURIComponent(institutionId)}`}>
          Manage billing
        </Link>
      </header>

      <section aria-label="Department statistics" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Statistic label="Departments" value={departments.length} />
        <Statistic label="Authorities" value={membersByRole('AUTHORITY')} />
        <Statistic label="Students" value={membersByRole('STUDENT')} />
        <Statistic label="Teachers" value={membersByRole('TEACHER')} />
        <Statistic label="Student issues" value={issuesByAudience('STUDENT')} />
        <Statistic label="Teacher issues" value={issuesByAudience('TEACHER')} />
      </section>

      {departmentsWithoutAuthority.length > 0 && (
        <section aria-labelledby="departments-without-authority" className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950" id="departments-without-authority">Departments without an Authority</h2>
          <p className="mt-1 text-sm text-amber-900">Assign at least one Authority to each department so requests and issues have an owner.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {departmentsWithoutAuthority.map((department) => (
              <li key={department.id}>
                <Link className="inline-flex rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-100" to={`${institutionPath}/departments/${encodeURIComponent(department.id)}`}>
                  {department.name} · Assign
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {departmentsOverLimit.length > 0 && (
        <section aria-labelledby="departments-over-authority-limit" className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5">
          <h2 className="font-semibold text-red-950" id="departments-over-authority-limit">Departments over their authority limit</h2>
          <p className="mt-1 text-sm text-red-900">Existing Authorities keep access, but new or re-enabled Authorities are blocked until each department is within its plan limit.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {departmentsOverLimit.map((department) => (
              <li className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-950" key={department.id}>
                {department.name} · {department.authorityUsage.used} / {authorityLimit}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Institution plan</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">{subscription?.planName || subscription?.planCode || 'No current plan'}</h2>
            </div>
            {subscription && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{subscription.status}</span>}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {subscription?.status === 'TRIALING'
              ? `Trial ends ${formatDate(subscription.trialEndsAt)}`
              : subscription
                ? `Term ends ${formatDate(subscription.endsAt)}`
                : 'Choose a plan to activate institution billing.'}
          </p>
          <Link className="mt-4 inline-block text-sm font-semibold text-blue-700 underline" to={`/institution/subscriptions?institutionId=${encodeURIComponent(institutionId)}`}>View subscription and usage</Link>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Institution details</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Contact person</dt><dd className="mt-1 font-medium">{overview.institution.contactPersonName}</dd></div>
            <div><dt className="text-slate-500">Contact email</dt><dd className="mt-1 font-medium">{overview.institution.contactEmail}</dd></div>
            <div><dt className="text-slate-500">Campus type</dt><dd className="mt-1 font-medium">{overview.institution.campusType}</dd></div>
            <div><dt className="text-slate-500">Campus size</dt><dd className="mt-1 font-medium">{overview.institution.campusSize}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">Location</dt><dd className="mt-1 font-medium">{overview.institution.location}</dd></div>
          </dl>
        </article>
      </section>

      <nav aria-label="Institution management" className="mt-7 flex flex-wrap gap-3">
        <Link className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" to={`${institutionPath}/departments`}>Manage departments</Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50" to={`/institution/authorities?institutionId=${encodeURIComponent(institutionId)}`}>Manage Authorities</Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50" to={`/institution/payments?institutionId=${encodeURIComponent(institutionId)}`}>Payment history</Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50" to={`${institutionPath}/audit-logs`}>View audit logs</Link>
      </nav>
    </main>
  )
}

export default InstitutionDashboardPage
