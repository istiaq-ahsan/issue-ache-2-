import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api.js'

function AuditLogPage({ isAuthority = false }) {
  const { institutionId } = useParams()
  const [searchParams] = useSearchParams()
  const departmentId = isAuthority ? searchParams.get('departmentId') || undefined : undefined
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '', offset: 0 })
  const auditLogs = useQuery({
    queryKey: ['audit-logs', institutionId, filters, departmentId],
    queryFn: async () => {
      const params = {
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
        ...(departmentId ? { departmentId } : {}),
      }
      return (await api.get(`/audit-logs/${institutionId}`, { params })).data.data
    },
    retry: false,
  })
  const dashboardPath = isAuthority
    ? `/authority/institutions/${encodeURIComponent(institutionId)}/dashboard`
    : `/institution/dashboard/${encodeURIComponent(institutionId)}`
  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value, offset: 0 }))
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
      <header>
        <Link className="text-sm font-semibold text-blue-700 underline" to={dashboardPath}>Back to workspace</Link>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Audit logs</h1>
        <p className="mt-1 text-slate-600">Read-only history of important institution actions.</p>
      </header>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Filter audit history</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Action contains
            <input className="min-h-10 rounded-lg border border-slate-300 px-3" maxLength={100} onChange={(event) => updateFilter('action', event.target.value)} value={filters.action} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Entity type
            <input className="min-h-10 rounded-lg border border-slate-300 px-3" maxLength={100} onChange={(event) => updateFilter('entityType', event.target.value)} value={filters.entityType} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            From
            <input className="min-h-10 rounded-lg border border-slate-300 px-3" onChange={(event) => updateFilter('from', event.target.value)} type="date" value={filters.from} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Through
            <input className="min-h-10 rounded-lg border border-slate-300 px-3" onChange={(event) => updateFilter('to', event.target.value)} type="date" value={filters.to} />
          </label>
        </div>
      </section>
      {auditLogs.isLoading ? (
        <p className="mt-6 text-slate-600" role="status">Loading audit logs…</p>
      ) : auditLogs.isError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{auditLogs.error.response?.data?.error?.message || 'Could not load audit logs.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => auditLogs.refetch()} type="button">Try again</button>
        </div>
      ) : auditLogs.data.auditLogs.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">No audit entries match these filters.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.data.auditLogs.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-800">{entry.actor?.name || 'System'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{entry.action}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.entityType} · {entry.entityId}</td>
                  <td className="max-w-sm px-4 py-3">
                    <pre className="whitespace-pre-wrap break-words text-xs text-slate-600">{entry.metadata ? JSON.stringify(entry.metadata, null, 2) : '—'}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            Showing {auditLogs.data.auditLogs.length} of {auditLogs.data.total} entries.
          </p>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button
              className="text-sm font-semibold text-blue-700 underline disabled:text-slate-400"
              disabled={filters.offset === 0}
              onClick={() => setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - 50) }))}
              type="button"
            >
              Newer entries
            </button>
            <button
              className="text-sm font-semibold text-blue-700 underline disabled:text-slate-400"
              disabled={filters.offset + auditLogs.data.auditLogs.length >= auditLogs.data.total}
              onClick={() => setFilters((current) => ({ ...current, offset: current.offset + 50 }))}
              type="button"
            >
              Older entries
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default AuditLogPage
