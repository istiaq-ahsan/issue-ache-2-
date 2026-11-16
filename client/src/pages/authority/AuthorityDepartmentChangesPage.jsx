import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api.js'

function AuthorityDepartmentChangesPage() {
  const { institutionId } = useParams()
  const [searchParams] = useSearchParams()
  const departmentId = searchParams.get('departmentId') || ''
  const [status, setStatus] = useState('PENDING')
  const requests = useQuery({
    queryKey: ['authority-department-changes', institutionId, status, departmentId],
    queryFn: async () => (await api.get(
      `/authority/institutions/${institutionId}/department-change-requests`,
      { params: { ...(status ? { status } : {}), ...(departmentId ? { departmentId } : {}) } },
    )).data.data.requests,
    retry: false,
  })

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="text-sm font-semibold text-blue-700 hover:underline" to={`/authority/institutions/${institutionId}/dashboard`}>
            Authority workspace
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Department change requests</h1>
          <p className="mt-2 text-slate-600">Review requests linked to your assigned departments. Only the requested department’s Authority can decide.</p>
        </div>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Request status
          <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="">All requests</option>
          </select>
        </label>
      </header>

      {requests.isLoading ? (
        <p className="mt-8 text-slate-600" role="status">Loading department change requests…</p>
      ) : requests.isError ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{requests.error.response?.data?.error?.message || 'Could not load requests.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => requests.refetch()} type="button">Try again</button>
        </div>
      ) : requests.data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">There are no requests matching this status.</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {requests.data.map((request) => (
            <li className="rounded-xl border border-slate-200 bg-white p-5" key={request.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold capitalize text-slate-950">{request.requester?.name || 'Member'} · {request.requesterRole.toLowerCase()}</h2>
                  <p className="mt-1 text-sm text-slate-600">{request.changeType.toLowerCase().replaceAll('_', ' ')}</p>
                  <p className="mt-2 text-sm text-slate-700">{request.currentDepartment?.name || '—'} → {request.requestedDepartment?.name || request.replacementDepartment?.name || '—'}</p>
                  <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
                </div>
                <Link className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" to={`/authority/institutions/${encodeURIComponent(institutionId)}/department-change-requests/${encodeURIComponent(request.id)}`}>
                  {request.status === 'PENDING' ? 'Review request' : 'View request'}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default AuthorityDepartmentChangesPage
