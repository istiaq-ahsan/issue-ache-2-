import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import api from '../../lib/api.js'

function InstitutionDashboardIndexPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await api.get('/auth/me')).data.data,
    retry: false,
  })

  if (isLoading) return <p className="p-8" role="status">Loading your institutions…</p>
  if (isError) return <Navigate to="/login" replace />

  const institutions = data.administeredInstitutions || []
  if (institutions.length === 1) {
    return <Navigate to={`/institution/dashboard/${institutions[0].id}`} replace />
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-semibold text-slate-950">Your institutions</h1>
      {institutions.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
          This account does not administer an institution yet.{' '}
          <Link className="font-semibold text-blue-700 underline" to="/pricing">
            Register one
          </Link>
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {institutions.map((institution) => (
            <li className="rounded-xl border border-slate-200 bg-white p-5" key={institution.id}>
              <h2 className="font-semibold text-slate-950">{institution.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Code: {institution.institutionCode}
              </p>
              <Link
                className="mt-4 inline-block font-semibold text-blue-700 hover:underline"
                to={`/institution/dashboard/${institution.id}`}
              >
                Open dashboard
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default InstitutionDashboardIndexPage
