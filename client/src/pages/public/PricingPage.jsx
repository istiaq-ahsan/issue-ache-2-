import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'
import { ErrorState, LoadingState } from '../../components/ui/index.jsx'

function formatPrice(value, currency) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function PricingPage() {
  const [cycle, setCycle] = useState('MONTHLY')
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async () => (await api.get('/plans')).data.data.plans,
    retry: false,
  })

  if (plans.isLoading) return <LoadingState label="Loading plans…" />
  if (plans.isError) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <ErrorState
          message={plans.error.apiMessage || 'Could not load pricing. Please try again.'}
          onRetry={() => plans.refetch()}
          title="Pricing is unavailable"
        />
      </main>
    )
  }

  const yearlySavings = (plan) => {
    const annualMonthlyTotal = plan.prices.MONTHLY * 12
    return Math.round((1 - plan.prices.YEARLY / annualMonthlyTotal) * 100)
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-6xl px-5 py-14 sm:px-8">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Plans for campus teams</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Simple pricing for every campus
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          One institution-wide plan. Unlimited departments. Choose the term that works for your campus.
        </p>
        <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          {['MONTHLY', 'YEARLY'].map((value) => (
            <button
              aria-pressed={cycle === value}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                cycle === value ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              key={value}
              onClick={() => setCycle(value)}
              type="button"
            >
              {value === 'MONTHLY' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
          {cycle === 'YEARLY' && (
            <span className="mr-2 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
              Save up to {Math.max(...plans.data.map(yearlySavings))}%
            </span>
          )}
        </div>
      </header>

      <section aria-label="Available plans" className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
        {plans.data.map((plan) => {
          const highlighted = plan.code === 'PRO'
          const registrationPath = `/institution/register?plan=${plan.code}&cycle=${cycle}`
          const yearlyMonthlyPrice = plan.prices.YEARLY / 12
          const authorityLimit = plan.limits.maxAuthoritiesPerDepartment
          const departmentLimit = plan.limits.maxDepartments
          const features = [
            authorityLimit === 1
              ? '1 authority per department'
              : `Up to ${authorityLimit} authorities per department`,
            `${plan.limits.maxMembers.toLocaleString()} students and teachers`,
            departmentLimit === null
              ? 'Unlimited departments'
              : `Up to ${departmentLimit.toLocaleString()} departments`,
            'Issue tracking and management',
            'Campus analytics and reporting',
          ]

          return (
            <article
              className={`relative flex flex-col rounded-3xl border p-7 shadow-sm sm:p-9 ${
                highlighted
                  ? 'border-blue-700 bg-slate-950 text-white shadow-xl shadow-blue-950/15'
                  : 'border-slate-200 bg-white text-slate-950'
              }`}
              key={plan.code}
            >
              {highlighted && (
                <span className="absolute right-6 top-6 rounded-full bg-blue-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <p className={`text-sm font-semibold uppercase tracking-[0.14em] ${highlighted ? 'text-blue-300' : 'text-blue-700'}`}>
                {plan.name}
              </p>
              <h2 className="mt-3 text-2xl font-semibold">{plan.code === 'BASIC' ? 'Start with the essentials' : 'Room to grow together'}</h2>
              <div className="mt-7 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight">
                  {formatPrice(plan.prices[cycle], plan.currency)}
                </span>
                <span className={highlighted ? 'text-slate-300' : 'text-slate-500'}>
                  / {cycle === 'MONTHLY' ? 'month' : 'year'}
                </span>
              </div>
              {cycle === 'YEARLY' && (
                <p className={`mt-2 text-sm ${highlighted ? 'text-slate-300' : 'text-slate-500'}`}>
                  About {formatPrice(yearlyMonthlyPrice, plan.currency)} per month · save {yearlySavings(plan)}%
                </p>
              )}
              <p className={`mt-4 min-h-6 text-sm font-medium ${highlighted ? 'text-blue-200' : 'text-slate-600'}`}>
                {plan.trialDays > 0 ? `${plan.trialDays}-day free trial` : 'Billed for one term, no auto-renewal'}
              </p>
              <ul className="mt-7 grid gap-3">
                {features.map((feature) => (
                  <li className="flex items-start gap-3 text-sm" key={feature}>
                    <Check aria-hidden="true" className={highlighted ? 'text-blue-300' : 'text-green-700'} size={18} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto grid gap-3 pt-8">
                <Link
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition ${
                    highlighted
                      ? 'bg-blue-500 text-white hover:bg-blue-400'
                      : 'bg-blue-700 text-white hover:bg-blue-800'
                  }`}
                  to={plan.trialDays > 0
                    ? `${registrationPath}&trial=true`
                    : registrationPath}
                >
                  {plan.trialDays > 0 ? 'Start free trial' : 'Get started'}
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
                {plan.trialDays > 0 && (
                  <Link
                    className="text-center text-sm font-semibold text-blue-700 underline underline-offset-4"
                    to={registrationPath}
                  >
                    Choose Basic without a trial
                  </Link>
                )}
              </div>
            </article>
          )
        })}
      </section>
      <p className="mt-8 text-center text-sm text-slate-500">
        Payments are per term. Subscriptions do not renew automatically.
      </p>
    </main>
  )
}

export default PricingPage
