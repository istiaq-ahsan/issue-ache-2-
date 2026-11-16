import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api.js'

function DepartmentDetailsPage({ institutionId, departmentId }) {
  const [paymentId, setPaymentId] = useState(null)
  const [paymentError, setPaymentError] = useState('')
  const queryClient = useQueryClient()
  const queryKey = ['department', institutionId, departmentId]
  const details = useQuery({
    queryKey,
    queryFn: async () =>
      (await api.get(`/institutions/${institutionId}/departments/${departmentId}`))
        .data.data.department,
  })
  const plan = useQuery({
    queryKey: ['demo-plan', institutionId],
    queryFn: async () =>
      (await api.get(`/institutions/${institutionId}/departments/demo-plan`)).data.data.plan,
  })
  const startCheckout = useMutation({
    mutationFn: async () =>
      (await api.post(
        `/institutions/${institutionId}/departments/${departmentId}/payments`,
      )).data.data.payment,
    onSuccess: (payment) => {
      setPaymentId(payment.id)
      setPaymentError('')
      toast.info(`Demo payment ${payment.status.toLowerCase()}`)
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      setPaymentError(
        error.response?.data?.error?.message || 'Could not initiate demo payment.',
      )
    },
  })
  const simulate = useMutation({
    mutationFn: async (result) =>
      (await api.post(
        `/institutions/${institutionId}/departments/${departmentId}/payments/${paymentId}/simulate`,
        { result },
      )).data.data,
    onSuccess: async (result) => {
      setPaymentId(null)
      setPaymentError('')
      if (result.payment.status === 'SUCCESSFUL') {
        toast.success('Payment successful. Department activated for the demo subscription term.')
      } else {
        toast.error(`Demo payment ${result.payment.status.toLowerCase()}. Department remains inactive.`)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['departments', institutionId] }),
        queryClient.invalidateQueries({ queryKey: ['institution-dashboard', institutionId] }),
      ])
    },
    onError: (error) => {
      setPaymentError(
        error.response?.data?.error?.message || 'Could not process the demo result.',
      )
    },
  })

  if (details.isLoading || plan.isLoading) {
    return <main className="mx-auto max-w-5xl px-5 py-12"><p role="status">Loading department details…</p></main>
  }

  if (details.isError || plan.isError) {
    const error = details.error || plan.error
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{error.response?.data?.error?.message || 'Could not load this department.'}</p>
          <button
            className="mt-3 font-semibold underline"
            onClick={() => Promise.all([details.refetch(), plan.refetch()])}
            type="button"
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  const department = details.data
  const subscriptions = department.subscriptions
  const canPay = department.status !== 'ACTIVE' && !paymentId

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8">
      <Link
        className="text-sm font-medium text-blue-700 hover:underline"
        to={`/institution/dashboard/${encodeURIComponent(institutionId)}/departments`}
      >
        Back to departments
      </Link>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Department details</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{department.name}</h1>
          <p className="mt-2 text-slate-600">
            Activation status: <strong>{department.status}</strong>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
          department.status === 'ACTIVE'
            ? 'bg-green-100 text-green-800'
            : department.status === 'EXPIRED'
              ? 'bg-amber-100 text-amber-900'
              : 'bg-slate-100 text-slate-700'
        }`}>
          {department.status}
        </span>
      </header>

      <section className="mt-7 rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h2 className="font-semibold text-blue-950">Per-department demo subscription</h2>
        <p className="mt-2 text-sm text-blue-900">
          {plan.data.name} · {plan.data.amount} {plan.data.currency} · {plan.data.durationDays} days
        </p>
        <p className="mt-1 text-xs text-blue-800">
          Simulated checkout only; this does not charge a real payment method.
        </p>
        {canPay && (
          <button
            className="mt-4 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            disabled={startCheckout.isPending}
            onClick={() => startCheckout.mutate()}
            type="button"
          >
            {startCheckout.isPending ? 'Starting checkout…' : 'Start demo payment'}
          </button>
        )}
        {department.status === 'ACTIVE' && subscriptions[0] && (
          <p className="mt-3 text-sm text-blue-900">
            Active through {new Date(subscriptions[0].endsAt).toLocaleString()}.
          </p>
        )}
        {paymentId && (
          <div className="mt-5 rounded-lg border border-blue-200 bg-white p-4">
            <p className="font-medium text-slate-900">Payment is pending. Select a simulated outcome:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['SUCCESSFUL', 'FAILED', 'CANCELLED'].map((result) => (
                <button
                  className={`rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                    result === 'SUCCESSFUL'
                      ? 'bg-green-700 text-white'
                      : result === 'FAILED'
                        ? 'bg-red-700 text-white'
                        : 'border border-slate-300 text-slate-700'
                  }`}
                  disabled={simulate.isPending}
                  key={result}
                  onClick={() => simulate.mutate(result)}
                  type="button"
                >
                  {simulate.isPending ? 'Processing…' : `Simulate ${result.toLowerCase()}`}
                </button>
              ))}
            </div>
          </div>
        )}
        {paymentError && <p className="mt-4 text-sm text-red-800" role="alert">{paymentError}</p>}
      </section>

      <section className="mt-9">
        <h2 className="text-xl font-semibold text-slate-950">Subscriptions</h2>
        {subscriptions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">
            No subscription yet. Create one through successful demo payment.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {subscriptions.map((subscription) => (
              <li className="rounded-xl border border-slate-200 bg-white p-4" key={subscription.id}>
                <p className="font-semibold">{subscription.planName} · {subscription.status}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {new Date(subscription.startsAt).toLocaleString()} – {new Date(subscription.endsAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-9">
        <h2 className="text-xl font-semibold text-slate-950">Payment history</h2>
        {department.payments.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">
            No payment attempts recorded.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {department.payments.map((payment) => (
              <li className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4" key={payment.id}>
                <div>
                  <p className="font-medium">{payment.amount} {payment.currency} · {payment.provider}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(payment.createdAt).toLocaleString()}</p>
                </div>
                <span className="text-sm font-semibold">{payment.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default DepartmentDetailsPage
