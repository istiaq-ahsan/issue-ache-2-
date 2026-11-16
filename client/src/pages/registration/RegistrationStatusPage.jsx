import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api.js'
import { useAuth } from '../../context/use-auth.js'

function RegistrationStatusPage() {
  const { user, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedRole = searchParams.get('role')
  const profile = useQuery({
    queryKey: ['auth', 'me', user?.uid],
    queryFn: async () => (await api.get('/auth/me')).data.data,
    enabled: Boolean(user),
    retry: false,
  })

  if (loading || (user && profile.isLoading)) {
    return <main className="p-8" role="status">Checking your registration status…</main>
  }
  if (!user) return <Navigate to="/login" replace />
  if (profile.isError) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900" role="alert">
          <h1 className="text-xl font-semibold">Could not load your registration</h1>
          <p className="mt-2">{profile.error.response?.data?.error?.message || 'Try again later.'}</p>
          <button className="mt-4 font-semibold underline" onClick={() => profile.refetch()} type="button">Try again</button>
        </section>
      </main>
    )
  }

  const membership = profile.data.memberships.find(
    ({ role }) =>
      requestedRole
        ? role === requestedRole
        : role === 'STUDENT' || role === 'TEACHER',
  )
  if (!membership) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-950">No student or teacher registration found</h1>
          <p className="mt-2 text-slate-600">Use the registration flow for your role or contact your institution.</p>
          <Link className="mt-4 inline-block font-semibold text-blue-700 underline" to="/">Return home</Link>
        </section>
      </main>
    )
  }

  if (membership.status === 'ACTIVE') {
    return <Navigate to={`/${membership.role.toLowerCase()}/dashboard/${membership.institutionId}`} replace />
  }

  const rejected = membership.status === 'REJECTED'
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-5 py-12">
      <section className={`w-full rounded-2xl border p-7 ${
        rejected ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
      }`}>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {membership.institution.name}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          {rejected ? 'Registration not approved' : 'Registration pending approval'}
        </h1>
        <p className="mt-3 text-slate-700">
          {rejected
            ? 'Your registration was rejected by an Authority. Contact your institution for more information.'
            : 'Your account cannot access student or teacher features until an Authority reviews and approves your registration.'}
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Role: {membership.role.toLowerCase()} · Status: {membership.status.toLowerCase()}
        </p>
        <Link className="mt-6 inline-block font-semibold text-blue-700 underline" to="/">
          Return home
        </Link>
      </section>
    </main>
  )
}

export default RegistrationStatusPage
