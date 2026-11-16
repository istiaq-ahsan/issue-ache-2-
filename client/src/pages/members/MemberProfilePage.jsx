import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api.js'

function MemberProfilePage() {
  const { institutionId } = useParams()
  const queryClient = useQueryClient()
  const profileKey = ['member-profile', institutionId]
  const requestKey = ['department-change-requests', institutionId]
  const [changeType, setChangeType] = useState('STUDENT_CHANGE')
  const [currentDepartmentId, setCurrentDepartmentId] = useState('')
  const [replacementDepartmentId, setReplacementDepartmentId] = useState('')
  const profile = useQuery({
    queryKey: profileKey,
    queryFn: async () =>
      (await api.get(`/institutions/${institutionId}/profile`)).data.data.profile,
    retry: false,
  })
  const requests = useQuery({
    queryKey: requestKey,
    queryFn: async () =>
      (await api.get(`/institutions/${institutionId}/department-change-requests`)).data.data.requests,
    retry: false,
  })
  const updateProfile = useMutation({
    mutationFn: async (formData) =>
      (await api.patch(`/institutions/${institutionId}/profile`, formData)).data.data.profile,
    onSuccess: async () => {
      toast.success('Profile updated')
      await queryClient.invalidateQueries({ queryKey: profileKey })
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not update your profile.'),
  })
  const submitRequest = useMutation({
    mutationFn: async (formData) =>
      (await api.post(`/institutions/${institutionId}/department-change-requests`, formData)).data.data.request,
    onSuccess: async () => {
      toast.success('Department change request submitted')
      await queryClient.invalidateQueries({ queryKey: requestKey })
      await queryClient.invalidateQueries({ queryKey: profileKey })
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not submit your request.'),
  })
  const cancelRequest = useMutation({
    mutationFn: async (requestId) =>
      (await api.post(`/institutions/${institutionId}/department-change-requests/${requestId}/cancel`)).data.data.request,
    onSuccess: async () => {
      toast.success('Request cancelled')
      await queryClient.invalidateQueries({ queryKey: requestKey })
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Could not cancel this request.'),
  })

  function handleRequestSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const reason = formData.get('reason')?.toString().trim()
    const data = { changeType, reason }
    if (changeType === 'TEACHER_REMOVE') {
      data.currentDepartmentId = currentDepartmentId
      if (replacementDepartmentId) data.replacementDepartmentId = replacementDepartmentId
    } else {
      data.requestedDepartmentId = formData.get('requestedDepartmentId')
    }
    submitRequest.mutate(data)
  }

  if (profile.isLoading || requests.isLoading) {
    return <main className="mx-auto max-w-4xl px-5 py-10" role="status">Loading your profile…</main>
  }

  if (profile.isError || requests.isError) {
    const error = profile.error || requests.error
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <h1 className="font-semibold">Could not load your profile</h1>
          <p className="mt-2">{error.response?.data?.error?.message || 'Please try again.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => { profile.refetch(); requests.refetch() }} type="button">
            Try again
          </button>
        </div>
      </main>
    )
  }

  const member = profile.data
  const teacher = member.role === 'TEACHER'
  const pendingRequest = requests.data.some((request) => request.status === 'PENDING')
  const memberDepartments = member.departments.filter((department) => department.status === 'ACTIVE')
  const activeDepartmentIds = new Set(memberDepartments.map((department) => department.id))
  const availableDepartments = member.activeDepartments.filter((department) => {
    if (!teacher || changeType === 'TEACHER_ADD') return !activeDepartmentIds.has(department.id)
    return activeDepartmentIds.has(department.id)
  })
  const selectedCurrentDepartment = memberDepartments.find((department) => department.id === currentDepartmentId)
  const paidDepartmentIds = new Set(member.activeDepartments.map((department) => department.id))
  const replacementOptions = memberDepartments.filter((department) => (
    department.id !== currentDepartmentId && paidDepartmentIds.has(department.id)
  ))

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-8">
      <header>
        <div>
          <Link className="text-sm font-semibold text-blue-700 hover:underline" to={`/${member.role.toLowerCase()}/dashboard/${institutionId}`}>
            Back to dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">Your profile</h1>
          <p className="mt-1 text-slate-600">{member.institution.name}</p>
        </div>
      </header>

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Account details</h2>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            updateProfile.mutate({
              name: form.get('name')?.toString().trim(),
              phone: form.get('phone')?.toString().trim(),
            })
          }}
        >
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Full name
            <input className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={member.user.name} maxLength={200} name="name" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Phone
            <input className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={member.user.phone || ''} maxLength={40} name="phone" required />
          </label>
          <div className="text-sm text-slate-600">
            <p>Email: <span className="font-medium text-slate-900">{member.user.email}</span></p>
            <p className="mt-1">{teacher ? 'Teacher ID' : 'Student ID'}: <span className="font-medium text-slate-900">{member.officialId}</span></p>
          </div>
          <button className="min-h-11 justify-self-start rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60" disabled={updateProfile.isPending} type="submit">
            {updateProfile.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="font-semibold text-slate-900">Department memberships</h3>
          {member.departments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No active departments are associated with your profile.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {member.departments.map((department) => (
                <li className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700" key={department.id}>
                  {department.name}{department.isPrimary ? ' · Primary' : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Request a department change</h2>
        <p className="mt-1 text-sm text-slate-600">Changes take effect only after an Authority reviews and approves your request.</p>
        {pendingRequest ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">You already have a pending request. Cancel it before submitting another.</p>
        ) : (
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleRequestSubmit}>
            {teacher && (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Request type
                <select
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"
                  onChange={(event) => {
                    setChangeType(event.target.value)
                    setCurrentDepartmentId('')
                    setReplacementDepartmentId('')
                  }}
                  value={changeType}
                >
                  <option value="TEACHER_ADD">Add a department</option>
                  <option value="TEACHER_REMOVE">Remove a department</option>
                  <option value="TEACHER_PRIMARY_CHANGE">Change primary department</option>
                </select>
              </label>
            )}
            {changeType === 'TEACHER_REMOVE' ? (
              <>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Department to remove
                  <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => { setCurrentDepartmentId(event.target.value); setReplacementDepartmentId('') }} required value={currentDepartmentId}>
                    <option value="">Select a department</option>
                    {memberDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}{department.isPrimary ? ' (primary)' : ''}</option>)}
                  </select>
                </label>
                {selectedCurrentDepartment?.isPrimary && (
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Replacement primary department
                    <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setReplacementDepartmentId(event.target.value)} required value={replacementDepartmentId}>
                      <option value="">Select a current department</option>
                      {replacementOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </label>
                )}
              </>
            ) : (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {changeType === 'TEACHER_PRIMARY_CHANGE' ? 'New primary department' : 'Department'}
                <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" name="requestedDepartmentId" required>
                  <option value="">Select a department</option>
                  {availableDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
            )}
            {availableDepartments.length === 0 && changeType !== 'TEACHER_REMOVE' && (
              <p className="text-sm text-slate-600 sm:col-span-2">
                {changeType === 'TEACHER_PRIMARY_CHANGE' ? 'You have no other active department memberships.' : 'No eligible active departments are available.'}
              </p>
            )}
            <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
              Reason
              <textarea className="min-h-24 rounded-lg border border-slate-300 p-3" maxLength={2000} minLength={1} name="reason" required />
            </label>
            <button
              className="min-h-11 justify-self-start rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              disabled={submitRequest.isPending || (changeType !== 'TEACHER_REMOVE' && availableDepartments.length === 0)}
              type="submit"
            >
              {submitRequest.isPending ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Department change request history</h2>
        {requests.data.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">You have not submitted any department change requests.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {requests.data.map((request) => (
              <li className="rounded-xl border border-slate-200 p-4" key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{request.changeType.toLowerCase().replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {request.currentDepartment?.name || '—'} → {request.requestedDepartment?.name || request.replacementDepartment?.name || '—'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
                    <p className="mt-2 text-xs text-slate-500">Submitted {new Date(request.requestedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'APPROVED' ? 'bg-green-100 text-green-800' : request.status === 'REJECTED' ? 'bg-red-100 text-red-800' : request.status === 'CANCELLED' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-900'}`}>
                      {request.status}
                    </span>
                    {request.status === 'PENDING' && (
                      <button className="text-sm font-semibold text-red-700 underline disabled:opacity-60" disabled={cancelRequest.isPending} onClick={() => cancelRequest.mutate(request.id)} type="button">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default MemberProfilePage
