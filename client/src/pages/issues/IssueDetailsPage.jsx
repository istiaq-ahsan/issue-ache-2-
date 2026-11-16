import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api.js'
import { promptAction } from '../../lib/confirm-action.js'

function label(value) {
  return value.toLowerCase().replaceAll('_', ' ')
}

function IssueDetailsPage({ role }) {
  const { institutionId, issueId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [nextStatus, setNextStatus] = useState('')
  const [visibility, setVisibility] = useState('PUBLIC')
  const authority = role === 'AUTHORITY'
  const listPath = authority
    ? `/authority/institutions/${encodeURIComponent(institutionId)}/issues`
    : `/${role.toLowerCase()}/issues/${encodeURIComponent(institutionId)}`
  const issueKey = ['issue', institutionId, issueId, role]
  const issueQuery = useQuery({
    queryKey: issueKey,
    queryFn: async () => (await api.get(`/issues/${institutionId}/${issueId}`)).data.data.issue,
    retry: false,
  })
  const refreshIssues = async () => {
    await queryClient.invalidateQueries({ queryKey: ['issues', institutionId] })
    await queryClient.invalidateQueries({ queryKey: issueKey })
    await queryClient.invalidateQueries({ queryKey: ['authority-overview', institutionId] })
    await queryClient.invalidateQueries({ queryKey: ['notifications', institutionId] })
  }
  const statusChange = useMutation({
    mutationFn: async (body) => (await api.patch(`/issues/${institutionId}/${issueId}/status`, body)).data.data.issue,
    onSuccess: async (issue) => {
      toast.success(`Issue is now ${label(issue.status)}`)
      setNextStatus('')
      await refreshIssues()
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not update issue status.'),
  })
  const addNote = useMutation({
    mutationFn: async (body) => (await api.post(`/issues/${institutionId}/${issueId}/notes`, body)).data.data.note,
    onSuccess: async () => {
      toast.success('Note added')
      await refreshIssues()
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not add this note.'),
  })
  const archive = useMutation({
    mutationFn: async (reason) => (await api.post(`/issues/${institutionId}/${issueId}/archive`, { reason })).data.data.issue,
    onSuccess: async () => {
      toast.success('Issue archived')
      await queryClient.invalidateQueries({ queryKey: ['issues', institutionId] })
      await queryClient.invalidateQueries({ queryKey: ['authority-overview', institutionId] })
      navigate(listPath, { replace: true })
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not archive this issue.'),
  })

  async function confirmArchive() {
    const reason = await promptAction({
      title: 'Archive this issue?',
      inputLabel: 'Archive reason',
      inputPlaceholder: 'Enter a reason',
      requiredMessage: 'An archive reason is required',
      confirmText: 'Archive issue',
    })
    if (reason !== null) archive.mutate(reason)
  }

  function submitStatus(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const body = {
      status: nextStatus,
      note: values.get('statusNote')?.toString().trim() || undefined,
    }
    if (nextStatus === 'RESOLVED') {
      body.resolutionSummary = values.get('resolutionSummary')?.toString().trim()
    }
    statusChange.mutate(body)
  }

  function submitNote(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    addNote.mutate({
      content: values.get('content')?.toString().trim(),
      visibility,
    })
    event.currentTarget.reset()
    setVisibility('PUBLIC')
  }

  if (issueQuery.isLoading) {
    return <main className="mx-auto max-w-4xl px-5 py-10" role="status">Loading issue details…</main>
  }
  if (issueQuery.isError) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <h1 className="font-semibold">Could not load this issue</h1>
          <p className="mt-2">{issueQuery.error.response?.data?.error?.message || 'The issue may not be available to your account.'}</p>
          <Link className="mt-3 inline-block font-semibold underline" to={listPath}>Back to issues</Link>
        </div>
      </main>
    )
  }

  const issue = issueQuery.data
  const nextStatusByCurrent = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'RESOLVED', RESOLVED: 'CLOSED' }
  const availableNextStatus = nextStatusByCurrent[issue.status]

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm font-semibold text-blue-700 hover:underline" to={listPath}>Back to issues</Link>
        {authority && (
          <Link className="text-sm font-semibold text-blue-700 hover:underline" to={`/authority/institutions/${encodeURIComponent(institutionId)}/dashboard`}>
            Authority workspace
          </Link>
        )}
      </header>

      <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{label(issue.category)} · {issue.audience.toLowerCase()} audience</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{issue.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{issue.department.name} · {issue.location}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold capitalize text-slate-700">{label(issue.status)}</span>
        </div>
        <dl className="mt-6 grid gap-4 border-y border-slate-100 py-5 sm:grid-cols-3">
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Priority</dt><dd className="mt-1 font-medium capitalize text-slate-900">{label(issue.priority)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-500">Reported</dt><dd className="mt-1 font-medium text-slate-900">{new Date(issue.createdAt).toLocaleString()}</dd></div>
          {issue.reporter && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Reporter</dt><dd className="mt-1 font-medium text-slate-900">{issue.reporter.name}</dd></div>}
        </dl>
        <section className="mt-5">
          <h2 className="font-semibold text-slate-950">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-700">{issue.description}</p>
        </section>
        {issue.resolutionSummary && (
          <section className="mt-6 rounded-xl bg-green-50 p-4">
            <h2 className="font-semibold text-green-900">Resolution summary</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-green-900">{issue.resolutionSummary}</p>
          </section>
        )}
        {issue.archivedAt && (
          <section className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
            <p className="font-semibold">Archived {new Date(issue.archivedAt).toLocaleString()}</p>
            <p className="mt-1">{issue.archiveReason}</p>
            {issue.archivedBy && <p className="mt-1">By {issue.archivedBy.name}</p>}
          </section>
        )}
      </article>

      {authority && !issue.archivedAt && availableNextStatus && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Update issue status</h2>
          <form className="mt-4 grid gap-4" onSubmit={submitStatus}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Next status
              <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setNextStatus(event.target.value)} required value={nextStatus}>
                <option value="">Select the next lifecycle status</option>
                <option value={availableNextStatus}>{label(availableNextStatus)}</option>
              </select>
            </label>
            {nextStatus === 'RESOLVED' && (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Resolution summary
                <textarea className="min-h-24 rounded-lg border border-slate-300 p-3" maxLength={5000} name="resolutionSummary" required />
              </label>
            )}
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Status note (optional)
              <textarea className="min-h-20 rounded-lg border border-slate-300 p-3" maxLength={2000} name="statusNote" />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60" disabled={!nextStatus || statusChange.isPending} type="submit">
                {statusChange.isPending ? 'Saving…' : 'Save status'}
              </button>
              {(issue.status === 'RESOLVED' || issue.status === 'CLOSED') && (
                <button className="min-h-11 rounded-lg border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={archive.isPending} onClick={confirmArchive} type="button">
                  Archive issue
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {authority && !issue.archivedAt && !availableNextStatus && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Issue actions</h2>
          <button className="mt-4 min-h-11 rounded-lg border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={archive.isPending} onClick={confirmArchive} type="button">Archive issue</button>
        </section>
      )}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Status history</h2>
        {issue.history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No status history is available.</p>
        ) : (
          <ol className="mt-4 grid gap-4">
            {issue.history.map((entry) => (
              <li className="border-l-2 border-blue-200 pl-4" key={entry.id}>
                <p className="font-semibold capitalize text-slate-900">
                  {entry.oldStatus ? `${label(entry.oldStatus)} → ` : ''}{label(entry.newStatus)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.changedBy?.name || 'Member'} · {new Date(entry.createdAt).toLocaleString()}
                </p>
                {entry.note && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{entry.note}</p>}
                {entry.resolutionSummary && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{entry.resolutionSummary}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Notes</h2>
        {issue.notes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No notes are available.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {issue.notes.map((note) => (
              <li className="rounded-xl border border-slate-200 p-4" key={note.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{note.visibility} · {note.author.name}</p>
                  <time className="text-xs text-slate-500">{new Date(note.createdAt).toLocaleString()}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
        {authority && !issue.archivedAt && (
          <form className="mt-5 grid gap-3 border-t border-slate-100 pt-5" onSubmit={submitNote}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Note visibility
              <select className="min-h-10 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setVisibility(event.target.value)} value={visibility}>
                <option value="PUBLIC">Public to this issue audience</option>
                <option value="INTERNAL">Internal to Authorities</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Note
              <textarea className="min-h-24 rounded-lg border border-slate-300 p-3" maxLength={5000} name="content" required />
            </label>
            <button className="min-h-10 justify-self-start rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60" disabled={addNote.isPending} type="submit">
              {addNote.isPending ? 'Adding…' : 'Add note'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default IssueDetailsPage
