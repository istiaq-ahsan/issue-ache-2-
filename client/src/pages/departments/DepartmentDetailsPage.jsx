import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api.js'

function DepartmentDetailsPage({ institutionId, departmentId }) {
  const [authorityId, setAuthorityId] = useState('')
  const queryClient = useQueryClient()
  const queryKey = ['department', institutionId, departmentId]
  const details = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/institutions/${institutionId}/departments/${departmentId}`)).data.data.department,
  })
  const authorities = useQuery({
    queryKey: ['authorities', institutionId],
    queryFn: async () => (await api.get(`/institutions/${institutionId}/authorities`)).data.data.authorities,
    retry: false,
  })
  const assignments = useMutation({
    mutationFn: async ({ membershipId, departmentId: targetDepartmentId }) =>
      (await api.put(`/authorities/${encodeURIComponent(membershipId)}/department`, {
        departmentId: targetDepartmentId,
      }, {
        headers: { 'X-Institution-Id': institutionId },
      })).data.data.department,
    onSuccess: async () => {
      toast.success('Authority department assignments updated')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['authorities', institutionId] }),
        queryClient.invalidateQueries({ queryKey: ['institution-dashboard', institutionId] }),
      ])
    },
    onError: (error) => toast.error(error.apiMessage || 'Could not update department assignments.'),
  })

  const department = details.data
  const authorityUsage = department.authorityUsage || { used: 0, limit: null }
  const authorityLimitReached =
    Number.isInteger(authorityUsage.limit) && authorityUsage.used >= authorityUsage.limit
  const authorityLimitMessage = authorityUsage.planCode === 'BASIC'
    ? 'Upgrade to Pro for up to 3 authorities per department'
    : 'This department has reached its Authority limit.'
  const assignedIds = useMemo(
    () => new Set(department?.authorityAssignments?.map(({ id }) => id) || []),
    [department?.authorityAssignments],
  )
  const availableAuthorities = (authorities.data || []).filter(
    (authority) => !authority.deletedAt && !assignedIds.has(authority.id),
  )

  function addAuthority() {
    const authority = authorities.data?.find(({ id }) => id === authorityId)
    if (!authority) return
    assignments.mutate({
      membershipId: authority.id,
      departmentId,
    })
    setAuthorityId('')
  }

  if (details.isLoading) return <main className="mx-auto max-w-5xl px-5 py-12"><p role="status">Loading department details…</p></main>
  if (details.isError) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{details.error.apiMessage || 'Could not load this department.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => details.refetch()} type="button">Try again</button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8">
      <Link className="text-sm font-medium text-blue-700 hover:underline" to={`/institution/dashboard/${encodeURIComponent(institutionId)}/departments`}>Back to departments</Link>
      <header className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Department details</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">{department.name}</h1>
        <p className="mt-2 text-slate-600">Departments are available without separate activation or payment.</p>
      </header>

      <section aria-label="Department usage" className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Students', department.usage.students],
          ['Teachers', department.usage.teachers],
          ['Issues', department.usage.issues],
          ['Authorities', department.usage.authorities],
        ].map(([label, count]) => (
          <article className="rounded-xl border border-slate-200 bg-white p-5" key={label}>
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{count}</p>
          </article>
        ))}
      </section>

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Assigned Authorities</h2>
            <p className="mt-1 text-sm text-slate-600">
              {authorityUsage.used}/{authorityUsage.limit ?? '∞'} authorities
            </p>
          </div>
        </div>
        {authorities.isError && <p className="mt-4 text-sm text-red-700" role="alert">{authorities.error.apiMessage || 'Could not load Authority accounts.'}</p>}
        {!authorities.isError && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-2 text-sm font-medium text-slate-700">
              Add Authority
              <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setAuthorityId(event.target.value)} value={authorityId}>
                <option value="">Select an Authority</option>
                {availableAuthorities.map((authority) => (
                  <option key={authority.id} value={authority.id}>
                    {authority.user.name} · {authority.user.email}
                  </option>
                ))}
              </select>
            </label>
            <span title={authorityLimitReached ? authorityLimitMessage : undefined}>
              <button
                className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!authorityId || assignments.isPending || authorityLimitReached}
                onClick={addAuthority}
                type="button"
              >
                {assignments.isPending ? 'Saving…' : 'Add Authority'}
              </button>
            </span>
            {authorityLimitReached && (
              <p className="text-sm text-amber-800" role="status">{authorityLimitMessage}</p>
            )}
          </div>
        )}
        {department.authorityAssignments.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">No Authorities are assigned to this department.</p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {department.authorityAssignments.map((authority) => (
              <li className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4" key={authority.id}>
                <div>
                  <p className="font-semibold text-slate-900">{authority.user.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{authority.user.email}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {authority.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Changing an Authority’s department moves its access; Authorities cannot be left unassigned.
        </p>
      </section>
    </main>
  )
}

export default DepartmentDetailsPage
