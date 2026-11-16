import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ErrorState, LoadingState } from '../../components/ui/index.jsx'
import { useAuth } from '../../context/use-auth.js'
import api from '../../lib/api.js'
import { getDashboardOptions } from '../../services/dashboard-access.js'

function DashboardPage() {
  const { loading: authLoading, user } = useAuth()
  const {
    data: profileResponse,
    isError,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'me', user?.uid],
    queryFn: async () => (await api.get('/auth/me')).data,
    enabled: Boolean(user) && !authLoading,
    retry: false,
  })

  if (authLoading) return <LoadingState label="Checking your sign-in…" />
  if (!user) return <Navigate to="/login" replace />
  if (isPending) return <LoadingState label="Checking your dashboard access…" />
  if (isError) {
    return (
      <ErrorState
        message="Your dashboard access could not be verified. Please try again."
        onRetry={() => refetch()}
        title="Could not verify dashboard access"
      />
    )
  }

  const options = getDashboardOptions(profileResponse?.data)

  if (options.length === 0) {
    return (
      <ErrorState
        message="This account does not have an active dashboard membership or institution."
        title="No dashboard is available"
      />
    )
  }

  if (options.length === 1) return <Navigate to={options[0].path} replace />

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold text-slate-950">Choose your dashboard</h1>
      <p className="mt-2 text-slate-600">
        This account has access to more than one workspace.
      </p>
      <nav aria-label="Available dashboards" className="mt-6 grid gap-3 sm:grid-cols-2">
        {options.map(({ label, path }) => (
          <Link
            className="rounded-xl border border-slate-200 bg-white p-5 font-semibold text-blue-700 hover:border-blue-500 hover:bg-blue-50"
            key={path}
            to={path}
          >
            {label}
          </Link>
        ))}
      </nav>
    </main>
  )
}

export default DashboardPage
