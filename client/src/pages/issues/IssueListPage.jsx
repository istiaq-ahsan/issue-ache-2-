import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api.js'

const categories = [
  'CLASSROOM_EQUIPMENT',
  'WIFI_NETWORKING',
  'ELECTRICAL',
  'FURNITURE_INFRASTRUCTURE',
  'CLEANING_SANITATION',
  'LAB_EQUIPMENT',
  'OTHER',
]
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

function label(value) {
  return value.toLowerCase().replaceAll('_', ' ')
}

function IssueListPage({ role }) {
  const { institutionId } = useParams()
  const [filters, setFilters] = useState({
    category: '',
    priority: '',
    status: '',
    from: '',
    to: '',
    archived: 'false',
  })
  const authority = role === 'AUTHORITY'
  const listPath = authority
    ? `/authority/institutions/${encodeURIComponent(institutionId)}/issues`
    : `/${role.toLowerCase()}/issues/${encodeURIComponent(institutionId)}`
  const issues = useQuery({
    queryKey: ['issues', institutionId, role, filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== ''),
      )
      return (await api.get(`/issues/${institutionId}`, { params })).data.data.issues
    },
    retry: false,
  })

  const detailsPath = (issueId) => authority
    ? `${listPath}/${encodeURIComponent(issueId)}`
    : `${listPath}/${encodeURIComponent(issueId)}`

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            className="text-sm font-semibold text-blue-700 hover:underline"
            to={authority
              ? `/authority/institutions/${encodeURIComponent(institutionId)}/dashboard`
              : `/${role.toLowerCase()}/dashboard/${encodeURIComponent(institutionId)}`}
          >
            Back to {authority ? 'Authority workspace' : 'dashboard'}
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            {authority ? 'Issue management' : 'Campus issues'}
          </h1>
          <p className="mt-1 text-slate-600">
            {authority
              ? 'Review and manage student and teacher issues in your institution.'
              : `View ${role.toLowerCase()}-audience issues in your institution.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!authority && (
            <Link
              className="min-h-11 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              to={`${listPath}/new`}
            >
              Report an issue
            </Link>
          )}
        </div>
      </header>

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Filter issues</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Category
            <select className="min-h-10 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setFilters({ ...filters, category: event.target.value })} value={filters.category}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Priority
            <select className="min-h-10 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setFilters({ ...filters, priority: event.target.value })} value={filters.priority}>
              <option value="">All priorities</option>
              {priorities.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Status
            <select className="min-h-10 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setFilters({ ...filters, status: event.target.value })} value={filters.status}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
            </select>
          </label>
          {authority && (
            <>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Created from
                <input className="min-h-10 rounded-lg border border-slate-300 px-3" onChange={(event) => setFilters({ ...filters, from: event.target.value })} type="date" value={filters.from} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Created through
                <input className="min-h-10 rounded-lg border border-slate-300 px-3" onChange={(event) => setFilters({ ...filters, to: event.target.value })} type="date" value={filters.to} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Archive
                <select className="min-h-10 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setFilters({ ...filters, archived: event.target.value })} value={filters.archived}>
                  <option value="false">Active issues</option>
                  <option value="true">Archived issues</option>
                  <option value="all">All issues</option>
                </select>
              </label>
            </>
          )}
        </div>
      </section>

      {issues.isLoading ? (
        <p className="mt-7 text-slate-600" role="status">Loading issues…</p>
      ) : issues.isError ? (
        <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{issues.error.response?.data?.error?.message || 'Could not load issues.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => issues.refetch()} type="button">Try again</button>
        </div>
      ) : issues.data.length === 0 ? (
        <p className="mt-7 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
          No issues match these filters.
        </p>
      ) : (
        <ul className="mt-7 grid gap-4 md:grid-cols-2">
          {issues.data.map((issue) => (
            <li className="rounded-xl border border-slate-200 bg-white p-5" key={issue.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">{issue.title}</h2>
                  <p className="mt-1 text-sm capitalize text-slate-600">{label(issue.category)} · {issue.department.name}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${issue.status === 'RESOLVED' || issue.status === 'CLOSED' ? 'bg-green-100 text-green-800' : issue.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'}`}>
                  {label(issue.status)}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-700">{issue.description}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="capitalize">{label(issue.priority)} priority · {issue.audience.toLowerCase()} audience</span>
                <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
              </div>
              {issue.archivedAt && <p className="mt-2 text-xs font-semibold text-slate-500">Archived</p>}
              <Link className="mt-4 inline-block text-sm font-semibold text-blue-700 underline" to={detailsPath(issue.id)}>
                View details and history
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default IssueListPage
