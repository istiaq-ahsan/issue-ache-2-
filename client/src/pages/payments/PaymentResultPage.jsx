import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CircleX, LoaderCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import api from '../../lib/api.js'

function getPaymentResult(paymentId, callbackResult, institutionId) {
  if (!paymentId) return Promise.resolve(callbackResult || null)

  return api.get(`/registration/status/${encodeURIComponent(paymentId)}`)
    .then(({ data }) => ({ kind: 'registration', ...data.data }))
    .catch(async (error) => {
      if (error.apiStatus !== 404) throw error
      const { data } = await api.get('/subscriptions/current', {
        headers: { 'X-Institution-Id': institutionId },
      })
      const payment = data.data.payments.find(({ id }) => id === paymentId)
      return payment
        ? { kind: 'subscription', paymentStatus: payment.status, payment }
        : callbackResult
          ? { kind: 'callback', ...callbackResult }
          : null
    })
}

function PaymentResultPage() {
  const location = useLocation()
  const callbackResult = location.state?.result
  const searchParams = new URLSearchParams(location.search)
  const institutionId = location.state?.institutionId || searchParams.get('institutionId')
  const paymentId = callbackResult?.paymentId || searchParams.get('paymentId')
  const trialStarted = searchParams.get('trial') === 'true'
  const result = useQuery({
    queryKey: ['payment-result', paymentId, callbackResult?.paymentStatus, institutionId],
    queryFn: () => getPaymentResult(paymentId, callbackResult, institutionId),
    enabled: Boolean(paymentId),
    retry: false,
  })

  const paymentStatus = trialStarted
    ? 'SUCCESSFUL'
    : result.data?.paymentStatus || result.data?.payment?.status
  const successful = paymentStatus === 'SUCCESSFUL' || result.data?.registrationStatus === 'COMPLETED'
  const cancelled = paymentStatus === 'CANCELLED' || result.data?.registrationStatus === 'CANCELLED'
  const heading = successful
    ? trialStarted ? 'Your free trial is ready' : 'Payment successful'
    : cancelled
      ? 'Payment cancelled'
      : paymentStatus === 'FAILED' || result.data?.registrationStatus === 'FAILED'
        ? 'Payment was not completed'
        : 'Payment status'

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center px-5 py-12">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        {result.isLoading ? (
          <>
            <LoaderCircle aria-hidden="true" className="mx-auto animate-spin text-blue-700" size={38} />
            <p className="mt-4 text-slate-600" role="status">Confirming your payment…</p>
          </>
        ) : result.isError ? (
          <div className="text-red-700" role="alert">
            <CircleX aria-hidden="true" className="mx-auto" size={40} />
            <h1 className="mt-4 text-2xl font-semibold">Could not confirm payment</h1>
            <p className="mt-2">{result.error.apiMessage || 'Please try again.'}</p>
            <button className="mt-5 font-semibold underline" onClick={() => result.refetch()} type="button">Check again</button>
          </div>
        ) : (
          <>
            {successful
              ? <CheckCircle2 aria-hidden="true" className="mx-auto text-green-700" size={44} />
              : <CircleX aria-hidden="true" className={`mx-auto ${cancelled ? 'text-amber-600' : 'text-red-700'}`} size={44} />}
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-blue-700">Issue Ache! billing</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">{heading}</h1>
            <p className="mx-auto mt-3 max-w-lg text-slate-600">
              {successful
                ? trialStarted
                  ? 'Your institution trial has started. Sign in with the administrator account you created.'
                  : result.data?.registrationStatus === 'COMPLETED'
                    ? 'Your institution is active. Sign in with the administrator account you created.'
                    : 'Your subscription payment was verified.'
                : cancelled
                  ? 'No charge was made. You can return to billing and try again whenever you are ready.'
                  : paymentStatus === 'FAILED'
                    ? 'No institution was created. Review your registration details and try again.'
                    : 'We could not confirm a completed payment yet. Try checking again.'}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {successful ? (
                <Link className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800" to="/institution/login">
                  Go to login
                </Link>
              ) : (
                <>
                  <Link className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800" to="/pricing">
                    Choose a plan and retry
                  </Link>
                  <Link className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50" to="/">
                    Return home
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default PaymentResultPage
