import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api.js'
import { confirmAction } from '../../lib/confirm-action.js'

function RegistrationDetailsPage() {
  const { institutionId, membershipId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const details = useQuery({
    queryKey: ['pending-registration', institutionId, membershipId],
    queryFn: async () =>
      (await api.get(
        `/authority/institutions/${institutionId}/pending-registrations/${membershipId}`,
      )).data.data.registration,
    retry: false,
  })
  const decision = useMutation({
    mutationFn: async (value) =>
      (await api.post(
        `/authority/institutions/${institutionId}/pending-registrations/${membershipId}/decision`,
        { decision: value },
      )).data.data.registration,
    onSuccess: async (registration) => {
      toast.success(`Registration ${registration.decision.toLowerCase()}`)
      await queryClient.invalidateQueries({ queryKey: ['pending-registrations', institutionId] })
      await queryClient.invalidateQueries({ queryKey: ['authority-overview', institutionId] })
      await queryClient.invalidateQueries({ queryKey: ['pending-registration', institutionId, membershipId] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', institutionId] })
      navigate(`/authority/institutions/${encodeURIComponent(institutionId)}/pending-registrations`, { replace: true })
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Could not review this registration.')
    },
  })

  async function submitDecision(value) {
    if (value === 'REJECTED') {
      const confirmed = await confirmAction({
        title: 'Reject this registration?',
        description: 'This decision is recorded and rejected registrations cannot be resubmitted.',
        confirmText: 'Reject registration',
        isDangerous: true,
      })
      if (!confirmed) return
    }
    decision.mutate(value)
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8">
      <header>
        <Link
          className="text-sm font-medium text-blue-700 hover:underline"
          to={`/authority/institutions/${encodeURIComponent(institutionId)}/pending-registrations`}
        >
          Back to pending registrations
        </Link>
      </header>
      {details.isLoading ? (
        <p className="mt-8 text-slate-600" role="status">Loading registration…</p>
      ) : details.isError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <h1 className="font-semibold">Could not load this registration</h1>
          <p className="mt-2">{details.error.response?.data?.error?.message || 'It may already have been reviewed.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => details.refetch()} type="button">Try again</button>
        </div>
      ) : (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            {details.data.role.toLowerCase()} registration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{details.data.applicant.name}</h1>
          <p className="mt-1 text-slate-600">{details.data.institution.name}</p>
          <dl className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">Email</dt>
              <dd className="mt-1 font-medium text-slate-900">{details.data.applicant.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Phone</dt>
              <dd className="mt-1 font-medium text-slate-900">{details.data.applicant.phone}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">
                {details.data.role === 'STUDENT' ? 'Official Student ID' : 'Official Teacher/Employee ID'}
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {details.data.studentId || details.data.teacherId}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Requested department</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {details.data.department?.name || 'Department unavailable'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Institution Code</dt>
              <dd className="mt-1 font-medium text-slate-900">{details.data.institution.institutionCode}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Submitted</dt>
              <dd className="mt-1 font-medium text-slate-900">{new Date(details.data.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="min-h-11 rounded-lg bg-green-700 px-5 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
              disabled={decision.isPending}
              onClick={() => submitDecision('APPROVED')}
              type="button"
            >
              {decision.isPending ? 'Saving decision…' : 'Approve'}
            </button>
            <button
              className="min-h-11 rounded-lg border border-red-300 px-5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              disabled={decision.isPending}
              onClick={() => submitDecision('REJECTED')}
              type="button"
            >
              Reject
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

export default RegistrationDetailsPage
