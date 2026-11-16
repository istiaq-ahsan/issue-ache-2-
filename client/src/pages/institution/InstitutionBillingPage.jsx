import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, CreditCard, RefreshCw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../lib/api.js'
import { Badge, ErrorState, LoadingState } from '../../components/ui/index.jsx'

function formatPrice(value, currency = 'BDT') {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function InstitutionBillingPage({ section = 'subscriptions' }) {
  const [searchParams] = useSearchParams()
  const institutionId = searchParams.get('institutionId')
  const billing = useQuery({
    queryKey: ['institution-billing', institutionId],
    queryFn: async () => (await api.get('/subscriptions/current', {
      headers: { 'X-Institution-Id': institutionId },
    })).data.data,
    enabled: Boolean(institutionId),
    retry: false,
  })
  const dashboard = useQuery({
    queryKey: ['institution-dashboard', institutionId],
    queryFn: async () => (await api.get(`/institutions/${encodeURIComponent(institutionId)}/dashboard`)).data.data,
    enabled: Boolean(institutionId),
    retry: false,
  })
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async () => (await api.get('/plans')).data.data.plans,
    enabled: Boolean(institutionId),
    retry: false,
  })
  const subscription = billing.data?.current
  const [planCode, setPlanCode] = useState('')
  const [cycle, setCycle] = useState('')
  const renewal = useMutation({
    mutationFn: async () => (await api.post('/subscriptions/renew', {
      planCode: planCode || subscription?.planCode || 'BASIC',
      billingCycle: cycle || subscription?.billingCycle || 'MONTHLY',
    }, {
      headers: { 'X-Institution-Id': institutionId },
    })).data.data,
    onSuccess: ({ redirectUrl }) => {
      if (!redirectUrl) {
        toast.error('The payment provider did not return a checkout URL.')
        return
      }
      window.location.assign(redirectUrl)
    },
    onError: (error) => toast.error(error.apiMessage || 'Could not start subscription checkout.'),
  })

  if (!institutionId) {
    return <p className="p-8">Select an institution to manage billing.</p>
  }
  if (billing.isLoading || dashboard.isLoading || plans.isLoading) {
    return <LoadingState label="Loading institution billing…" />
  }
  if (billing.isError || dashboard.isError || plans.isError) {
    const error = billing.error || dashboard.error || plans.error
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <ErrorState
          message={error.apiMessage || 'Could not load billing details.'}
          onRetry={() => Promise.all([billing.refetch(), dashboard.refetch(), plans.refetch()])}
        />
      </main>
    )
  }

  const members = dashboard.data.memberships || []
  const usage = {
    authorities: members.filter((entry) => entry.role === 'AUTHORITY').reduce((sum, entry) => sum + entry.count, 0),
    members: members.filter((entry) => ['STUDENT', 'TEACHER'].includes(entry.role)).reduce((sum, entry) => sum + entry.count, 0),
  }
  const currentPlan = plans.data.find(({ code }) => code === subscription?.planCode)
  const selectedPlan = plans.data.find(({ code }) => code === (planCode || subscription?.planCode)) || plans.data[0]
  const paymentRows = billing.data.payments || []
  const subscriptionRows = billing.data.subscriptions || []
  const institutionPath = `/institution/dashboard/${encodeURIComponent(institutionId)}`

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-9 sm:px-8">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline" to={institutionPath}>
        <ArrowLeft aria-hidden="true" size={16} /> Institution dashboard
      </Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Institution billing</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {section === 'payments' ? 'Payment history' : 'Subscription'}
          </h1>
          <p className="mt-2 text-slate-600">Manage one institution-wide plan. Payments never renew automatically.</p>
        </div>
        <nav aria-label="Billing pages" className="flex gap-2">
          <Link className={`rounded-lg px-4 py-2 text-sm font-semibold ${section === 'subscriptions' ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`} to={`/institution/subscriptions?institutionId=${encodeURIComponent(institutionId)}`}>Subscription</Link>
          <Link className={`rounded-lg px-4 py-2 text-sm font-semibold ${section === 'payments' ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`} to={`/institution/payments?institutionId=${encodeURIComponent(institutionId)}`}>Payments</Link>
        </nav>
      </header>

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Current plan</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{currentPlan?.name || subscription?.planName || 'No plan'}</h2>
            </div>
            {subscription && <Badge status={subscription.status}>{subscription.status}</Badge>}
          </div>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Billing cycle</dt><dd className="mt-1 font-semibold">{subscription?.billingCycle || '—'}</dd></div>
            <div><dt className="text-slate-500">Started</dt><dd className="mt-1 font-semibold">{formatDate(subscription?.startsAt)}</dd></div>
            <div><dt className="text-slate-500">Trial ends</dt><dd className="mt-1 font-semibold">{formatDate(subscription?.trialEndsAt)}</dd></div>
            <div><dt className="text-slate-500">Renews / ends</dt><dd className="mt-1 font-semibold">{formatDate(subscription?.endsAt)}</dd></div>
          </dl>
          {!subscription && (
            <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              No current institution subscription was found. Choose a plan to activate billing.
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Plan usage</h2>
          <p className="mt-1 text-sm text-slate-600">Current institution usage against this plan’s limits.</p>
          {[
            { label: 'Authorities', value: usage.authorities, limit: currentPlan?.limits.maxAuthorities },
            { label: 'Students and teachers', value: usage.members, limit: currentPlan?.limits.maxMembers },
          ].map(({ label, limit, value }) => (
            <div className="mt-5" key={label}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <span className="font-semibold text-slate-950">{value.toLocaleString()} / {Number(limit || 0).toLocaleString()}</span>
              </div>
              <div aria-label={`${label} usage`} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, limit ? (value / limit) * 100 : 0)}%` }} />
              </div>
            </div>
          ))}
          <p className="mt-4 text-xs text-slate-500">Departments are unlimited on every plan.</p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h2 className="text-lg font-semibold text-blue-950">{subscription ? 'Renew or upgrade' : 'Choose a plan'}</h2>
            <p className="mt-1 text-sm text-blue-900">Select a plan and term. Checkout uses the configured payment provider.</p>
          </div>
          <RefreshCw aria-hidden="true" className="text-blue-700" size={22} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Plan
            <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setPlanCode(event.target.value)} value={planCode || subscription?.planCode || plans.data[0]?.code}>
              {plans.data.map((plan) => <option key={plan.code} value={plan.code}>{plan.name} · max {plan.limits.maxAuthorities} Authorities</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Billing cycle
            <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setCycle(event.target.value)} value={cycle || subscription?.billingCycle || 'MONTHLY'}>
              <option value="MONTHLY">Monthly · {formatPrice(selectedPlan?.prices.MONTHLY || 0)}</option>
              <option value="YEARLY">Yearly · {formatPrice(selectedPlan?.prices.YEARLY || 0)}</option>
            </select>
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={renewal.isPending}
            onClick={() => renewal.mutate()}
            type="button"
          >
            <CreditCard aria-hidden="true" size={17} />
            {renewal.isPending ? 'Starting checkout…' : subscription ? 'Renew / Upgrade' : 'Continue to payment'}
          </button>
        </div>
        {renewal.isError && <p className="mt-3 text-sm text-red-800" role="alert">{renewal.error.apiMessage}</p>}
      </section>

      {section === 'subscriptions' ? (
        <section className="mt-9">
          <h2 className="text-xl font-semibold text-slate-950">Subscription history</h2>
          {subscriptionRows.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">No subscription history yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {subscriptionRows.map((entry) => (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4" key={entry.id}>
                  <div><p className="font-semibold text-slate-950">{entry.planName || entry.planCode} · {entry.billingCycle || 'legacy term'}</p><p className="mt-1 text-sm text-slate-500">{formatDate(entry.startsAt)} – {formatDate(entry.trialEndsAt || entry.endsAt)}</p></div>
                  <Badge status={entry.status}>{entry.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="mt-9">
          <h2 className="text-xl font-semibold text-slate-950">Payment history</h2>
          {paymentRows.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">No institution payments recorded yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentRows.map((payment) => (
                    <tr key={payment.id}>
                      <td className="whitespace-nowrap px-4 py-3">{new Date(payment.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{payment.planCode || 'Legacy' }{payment.billingCycle ? ` · ${payment.billingCycle}` : ''}</td>
                      <td className="px-4 py-3">{formatPrice(payment.amount, payment.currency)}</td>
                      <td className="px-4 py-3">{payment.provider}</td>
                      <td className="px-4 py-3"><Badge status={payment.status}>{payment.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default InstitutionBillingPage
