import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import api from '../../lib/api.js'
import { ErrorState, LoadingState } from '../../components/ui/index.jsx'

const schema = z.object({
  institutionName: z.string().trim().min(1, 'Enter the institution name.').max(200),
  contactPersonName: z.string().trim().min(1, 'Enter a contact person.').max(200),
  contactEmail: z.string().trim().email('Enter a valid contact email.').max(320),
  campusType: z.string().trim().min(1, 'Enter the campus type.').max(100),
  campusSize: z.string().trim().min(1, 'Enter the campus size.').max(100),
  location: z.string().trim().min(1, 'Enter the institution location.').max(500),
  adminName: z.string().trim().min(1, 'Enter an administrator name.').max(200),
  adminEmail: z.string().trim().email('Enter a valid administrator email.').max(320),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
})

function formatPrice(value, currency) {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function InstitutionRegisterPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const planCode = searchParams.get('plan')
  const cycle = searchParams.get('cycle')
  const startTrial = searchParams.get('trial') === 'true'
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async () => (await api.get('/plans')).data.data.plans,
    retry: false,
  })
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      institutionName: '',
      contactPersonName: '',
      contactEmail: '',
      campusType: '',
      campusSize: '',
      location: '',
      adminName: '',
      adminEmail: '',
      password: '',
    },
  })
  const registration = useMutation({
    mutationFn: async (values) => (await api.post('/registration/start', {
      ...values,
      planCode,
      billingCycle: cycle,
      startTrial,
    })).data.data,
    onSuccess: (result) => {
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl)
        return
      }
      toast.success('Your Basic trial is active.')
      navigate('/payment/result?trial=true', { replace: true, state: { institution: result.institution } })
    },
  })
  const selectedPlan = plans.data?.find((plan) => plan.code === planCode)

  if (!planCode || !cycle) return <Navigate to="/pricing" replace />
  if (plans.isLoading) return <LoadingState label="Loading your selected plan…" />
  if (plans.isError) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <ErrorState message={plans.error.apiMessage || 'Could not load plans.'} onRetry={() => plans.refetch()} />
      </main>
    )
  }
  if (!selectedPlan || !selectedPlan.prices[cycle] || (startTrial && (planCode !== 'BASIC' || !selectedPlan.trialDays))) {
    return <Navigate to="/pricing" replace />
  }

  const fields = [
    ['institutionName', 'Institution name', 'text', 'organization'],
    ['contactPersonName', 'Institution contact person', 'text', 'name'],
    ['contactEmail', 'Institution contact email', 'email', 'email'],
    ['campusType', 'Campus type', 'text', 'off'],
    ['campusSize', 'Campus size', 'text', 'off'],
    ['location', 'Location', 'text', 'street-address'],
    ['adminName', 'Administrator name', 'text', 'name'],
    ['adminEmail', 'Administrator sign-in email', 'email', 'email'],
    ['password', 'Administrator password', 'password', 'new-password'],
  ]

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8">
      <Link className="text-sm font-semibold text-blue-700 hover:underline" to="/pricing">← Back to pricing</Link>
      <header className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Institution onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Register your institution</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Create an administrator account and workspace. Your institution is created only after the trial starts or payment is verified.</p>
      </header>

      <section aria-label="Selected plan" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div>
          <p className="text-sm font-medium text-blue-900">Selected plan</p>
          <h2 className="mt-1 text-xl font-semibold text-blue-950">{selectedPlan.name} · {cycle.toLowerCase()}</h2>
          <p className="mt-1 text-sm text-blue-900">
            {startTrial
              ? `${selectedPlan.trialDays}-day free trial · no payment required to start`
              : `${formatPrice(selectedPlan.prices[cycle], selectedPlan.currency)} per ${cycle.toLowerCase().replace('ly', '')}`}
          </p>
        </div>
        <Link className="font-semibold text-blue-800 underline underline-offset-4" to="/pricing">Change plan</Link>
      </section>

      <form className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" noValidate onSubmit={form.handleSubmit((values) => registration.mutate(values))}>
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map(([name, label, type, autoComplete]) => (
            <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={name} key={name}>
              {label}
              <input
                autoComplete={autoComplete}
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                id={name}
                maxLength={name === 'password' ? 128 : undefined}
                minLength={name === 'password' ? 8 : undefined}
                type={type}
                {...form.register(name)}
              />
              {form.formState.errors[name] && (
                <span className="text-sm text-red-700" role="alert">{form.formState.errors[name].message}</span>
              )}
            </label>
          ))}
        </div>
        {registration.isError && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {registration.error.apiMessage || 'Registration could not be started. Please review your details and retry.'}
          </div>
        )}
        <button
          className="mt-6 min-h-12 rounded-xl bg-blue-700 px-6 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={registration.isPending}
          type="submit"
        >
          {registration.isPending ? 'Starting registration…' : startTrial ? 'Start 14-day free trial' : 'Continue to payment'}
        </button>
      </form>
    </main>
  )
}

export default InstitutionRegisterPage
