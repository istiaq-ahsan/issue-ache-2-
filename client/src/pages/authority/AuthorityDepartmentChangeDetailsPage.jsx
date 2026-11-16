import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../lib/api.js'
import { confirmAction } from '../../lib/confirm-action.js'

function AuthorityDepartmentChangeDetailsPage() {
  const { institutionId, requestId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const detailKey = ['authority-department-change', institutionId, requestId]
  const details = useQuery({
    queryKey: detailKey,
    queryFn: async () => (await api.get(
      `/authority/institutions/${institutionId}/department-change-requests/${requestId}`,
    )).data.data.request,
    retry: false,
  })
  const decision = useMutation({
    mutationFn: async (value) => (await api.post(
      `/authority/institutions/${institutionId}/department-change-requests/${requestId}/decision`,
      { decision: value },
    )).data.data.request,
    onSuccess: async (request) => {
      toast.success(`Request ${request.status.toLowerCase()}`)
      await queryClient.invalidateQueries({ queryKey: ['authority-department-changes', institutionId] })
      await queryClient.invalidateQueries({ queryKey: ['authority-overview', institutionId] })
      await queryClient.invalidateQueries({ queryKey: detailKey })
      await queryClient.invalidateQueries({ queryKey: ['notifications', institutionId] })
      navigate(`/authority/institutions/${encodeURIComponent(institutionId)}/department-change-requests`, { replace: true })
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not review this request.'),
  })

  async function handleDecision(value) {
    if (value === 'REJECTED') {
      const confirmed = await confirmAction({
        title: 'Reject this request?',
        description: 'The request decision will be recorded and the member will be notified.',
        confirmText: 'Reject request',
        isDangerous: true,
      })
      if (!confirmed) return
    }
    decision.mutate(value)
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8">
      <header>
        <Link className="text-sm font-semibold text-blue-700 hover:underline" to={`/authority/institutions/${encodeURIComponent(institutionId)}/department-change-requests`}>
          Back to department change requests
        </Link>
      </header>
      {details.isLoading ? (
        <p className="mt-8 text-slate-600" role="status">Loading request…</p>
      ) : details.isError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <h1 className="font-semibold">Could not load this request</h1>
          <p className="mt-2">{details.error.response?.data?.error?.message || 'Please try again.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => details.refetch()} type="button">Try again</button>
        </div>
      ) : (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{details.data.requesterRole} department request</p>
          <h1 className="mt-2 text-2xl font-semibold capitalize text-slate-950">{details.data.changeType.toLowerCase().replaceAll('_', ' ')}</h1>
          <dl className="mt-7 grid gap-5 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-500">Requester</dt><dd className="mt-1 font-medium text-slate-900">{details.data.requester?.name || 'Member'}</dd></div>
            <div><dt className="text-sm text-slate-500">Status</dt><dd className="mt-1 font-medium text-slate-900">{details.data.status}</dd></div>
            <div><dt className="text-sm text-slate-500">Current department</dt><dd className="mt-1 font-medium text-slate-900">{details.data.currentDepartment?.name || '—'}</dd></div>
            <div><dt className="text-sm text-slate-500">{details.data.changeType === 'TEACHER_REMOVE' ? 'Replacement department' : 'Requested department'}</dt><dd className="mt-1 font-medium text-slate-900">{details.data.requestedDepartment?.name || details.data.replacementDepartment?.name || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm text-slate-500">Reason</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-900">{details.data.reason}</dd></div>
            <div><dt className="text-sm text-slate-500">Submitted</dt><dd className="mt-1 font-medium text-slate-900">{new Date(details.data.requestedAt).toLocaleString()}</dd></div>
            {details.data.reviewer && <div><dt className="text-sm text-slate-500">Reviewed by</dt><dd className="mt-1 font-medium text-slate-900">{details.data.reviewer.name}</dd></div>}
          </dl>
          {details.data.status === 'PENDING' && (
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="min-h-11 rounded-lg bg-green-700 px-5 font-semibold text-white hover:bg-green-800 disabled:opacity-60" disabled={decision.isPending} onClick={() => handleDecision('APPROVED')} type="button">
                {decision.isPending ? 'Saving decision…' : 'Approve'}
              </button>
              <button className="min-h-11 rounded-lg border border-red-300 px-5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60" disabled={decision.isPending} onClick={() => handleDecision('REJECTED')} type="button">Reject</button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default AuthorityDepartmentChangeDetailsPage
