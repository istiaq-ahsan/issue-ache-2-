import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api.js'

function AuthorityPendingRegistrationsPage() {
  const { institutionId } = useParams()
  const [searchParams] = useSearchParams()
  const departmentId = searchParams.get('departmentId') || ''
  const [role, setRole] = useState('')
  const registrations = useQuery({
    queryKey: ['pending-registrations', institutionId, role, departmentId],
    queryFn: async () => {
      const params = {
        ...(role ? { role } : {}),
        ...(departmentId ? { departmentId } : {}),
      }
      return (await api.get(
        `/authority/institutions/${institutionId}/pending-registrations`,
        { params },
      )).data.data.registrations
    },
    retry: false,
  })

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Authority workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Pending registrations</h1>
          <p className="mt-2 text-slate-600">Review student and teacher requests for your assigned departments.</p>
        </div>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Filter by role
          <select
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"
            onChange={(event) => setRole(event.target.value)}
            value={role}
          >
            <option value="">All registrations</option>
            <option value="STUDENT">Students</option>
            <option value="TEACHER">Teachers</option>
          </select>
        </label>
      </header>

      {registrations.isLoading ? (
        <p className="mt-8 text-slate-600" role="status">Loading pending registrations…</p>
      ) : registrations.isError ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{registrations.error.response?.data?.error?.message || 'Could not load registrations.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => registrations.refetch()} type="button">Try again</button>
        </div>
      ) : registrations.data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
          There are no pending {role ? `${role.toLowerCase()} ` : ''}registrations.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {registrations.data.map((registration) => (
            <li className="rounded-xl border border-slate-200 bg-white p-5" key={registration.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-950">{registration.applicant.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{registration.applicant.email}</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {registration.role === 'STUDENT' ? 'Student ID' : 'Teacher ID'}:{' '}
                    {registration.studentId || registration.teacherId}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {registration.department?.name || 'Requested department unavailable'}
                    {' · '}Submitted {new Date(registration.createdAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                  to={`/authority/institutions/${encodeURIComponent(institutionId)}/pending-registrations/${encodeURIComponent(registration.id)}`}
                >
                  Review registration
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default AuthorityPendingRegistrationsPage
