import { useMutation } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../lib/api.js'

const choices = [
  { label: 'Pay', status: 'SUCCESSFUL', className: 'bg-green-700 text-white hover:bg-green-800' },
  { label: 'Fail', status: 'FAILED', className: 'bg-red-700 text-white hover:bg-red-800' },
  { label: 'Cancel', status: 'CANCELLED', className: 'border border-slate-300 text-slate-700 hover:bg-slate-50' },
]

function DemoPaymentPage() {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const institutionId = searchParams.get('institutionId')
  const callback = useMutation({
    mutationFn: async (status) =>
      (await api.post(`/payments/${encodeURIComponent(paymentId)}/callback`, { status })).data.data,
    onSuccess: (result) => {
      const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : ''
      navigate(`/payment/result${query}`, {
        replace: true,
        state: { result, institutionId },
      })
    },
    onError: (error) => toast.error(error.apiMessage || 'Could not process this demo payment.'),
  })

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center px-5 py-12">
      <section className="w-full rounded-3xl border border-amber-300 bg-white p-7 shadow-lg sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-950">
          <ShieldAlert aria-hidden="true" size={15} /> Demo payment · no real money
        </div>
        <p className="mt-7 text-sm font-semibold uppercase tracking-wide text-blue-700">Secure checkout simulation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Choose a demo outcome</h1>
        <p className="mt-3 leading-7 text-slate-600">
          This page simulates a payment provider. Nothing will be charged. Choose Pay to complete the registration or renewal.
        </p>
        <p className="mt-5 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Payment reference: {paymentId}
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {choices.map(({ className, label, status }) => (
            <button
              className={`min-h-12 rounded-xl px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
              disabled={callback.isPending}
              key={status}
              onClick={() => callback.mutate(status)}
              type="button"
            >
              {callback.isPending ? 'Processing…' : label}
            </button>
          ))}
        </div>
        {callback.isError && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {callback.error.apiMessage || 'The payment result could not be verified. You can try again.'}
          </p>
        )}
      </section>
    </main>
  )
}

export default DemoPaymentPage
