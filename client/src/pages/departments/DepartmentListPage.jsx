import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api.js'
import { confirmAction } from '../../lib/confirm-action.js'

function getErrorMessage(error, fallback) {
  return error.apiMessage || error.response?.data?.error?.message || fallback
}

function DepartmentListPage({ institutionId }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const queryClient = useQueryClient()
  const departments = useQuery({
    queryKey: ['departments', institutionId],
    queryFn: async () => (await api.get(`/institutions/${institutionId}/departments`)).data.data.departments,
  })

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['departments', institutionId] }),
      queryClient.invalidateQueries({ queryKey: ['institution-dashboard', institutionId] }),
      queryClient.invalidateQueries({ queryKey: ['department', institutionId] }),
    ])
  }

  const createDepartment = useMutation({
    mutationFn: async (departmentName) =>
      (await api.post(`/institutions/${institutionId}/departments`, { name: departmentName })).data.data.department,
    onSuccess: async (department) => {
      setName('')
      setErrorMessage('')
      toast.success(`${department.name} created`)
      await refresh()
    },
    onError: (error) => setErrorMessage(getErrorMessage(error, 'Could not create the department.')),
  })
  const updateDepartment = useMutation({
    mutationFn: async ({ id, nextName }) =>
      (await api.patch(`/institutions/${institutionId}/departments/${id}`, { name: nextName })).data.data.department,
    onSuccess: async () => {
      setEditing(null)
      setErrorMessage('')
      toast.success('Department updated')
      await refresh()
    },
    onError: (error) => setErrorMessage(getErrorMessage(error, 'Could not update the department.')),
  })
  const deleteDepartment = useMutation({
    mutationFn: async (id) => api.delete(`/institutions/${institutionId}/departments/${id}`),
    onSuccess: async () => {
      setDeleteReason('')
      toast.success('Department deleted')
      await refresh()
    },
    onError: (error) => {
      const details = error.response?.data?.error?.details
      const references = details?.references || {}
      const reasons = Object.entries(references)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => `${key.replaceAll(/([A-Z])/g, ' $1').toLowerCase()} (${count})`)
      setDeleteReason(reasons?.length
        ? `Cannot delete this department because it is used by ${reasons.join(', ')}.`
        : getErrorMessage(error, 'Could not delete the department.'))
    },
  })

  function submitCreate(event) {
    event.preventDefault()
    setErrorMessage('')
    createDepartment.mutate(name.trim())
  }

  function submitEdit(event, id) {
    event.preventDefault()
    setErrorMessage('')
    updateDepartment.mutate({ id, nextName: editing.name.trim() })
  }

  async function confirmDelete(department) {
    setDeleteReason('')
    const confirmed = await confirmAction({
      title: `Delete ${department.name}?`,
      description: 'Departments can be deleted only when no members, issues, requests, or Authorities refer to them.',
      confirmText: 'Delete department',
      isDangerous: true,
    })
    if (confirmed) deleteDepartment.mutate(department.id)
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
      <Link className="text-sm font-medium text-blue-700 hover:underline" to={`/institution/dashboard/${encodeURIComponent(institutionId)}`}>
        Back to institution dashboard
      </Link>
      <header className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Institution management</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Departments</h1>
        <p className="mt-2 text-slate-600">Create and manage departments at any time. There is no department activation or separate payment.</p>
      </header>

      <form className="mt-7 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end" onSubmit={submitCreate}>
        <label className="grid flex-1 gap-2 text-sm font-medium text-slate-700">
          Create a department
          <input className="min-h-11 rounded-lg border border-slate-300 px-3 text-base" maxLength={200} onChange={(event) => setName(event.target.value)} placeholder="Department name" required value={name} />
        </label>
        <button className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60" disabled={createDepartment.isPending} type="submit">
          {createDepartment.isPending ? 'Creating…' : 'Create department'}
        </button>
      </form>
      {errorMessage && <p className="mt-3 text-sm text-red-700" role="alert">{errorMessage}</p>}
      {deleteReason && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">{deleteReason}</p>}

      {departments.isLoading ? (
        <p className="mt-8 text-slate-600" role="status">Loading departments…</p>
      ) : departments.isError ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{getErrorMessage(departments.error, 'Could not load departments.')}</p>
          <button className="mt-3 font-semibold underline" onClick={() => departments.refetch()} type="button">Try again</button>
        </div>
      ) : departments.data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">No departments yet. Create your first department above.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {departments.data.map((department) => (
            <li className="rounded-xl border border-slate-200 bg-white p-5" key={department.id}>
              {editing?.id === department.id ? (
                <form className="grid gap-3" onSubmit={(event) => submitEdit(event, department.id)}>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Department name
                    <input className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={200} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required value={editing.name} />
                  </label>
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={updateDepartment.isPending} type="submit">{updateDepartment.isPending ? 'Saving…' : 'Save'}</button>
                    <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => setEditing(null)} type="button">Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-slate-950">{department.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">Department · no separate status or subscription</p>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <Link className="text-sm font-semibold text-blue-700 hover:underline" to={`/institution/dashboard/${encodeURIComponent(institutionId)}/departments/${encodeURIComponent(department.id)}`}>View details</Link>
                    <button className="text-sm font-semibold text-slate-700 underline" onClick={() => { setErrorMessage(''); setEditing({ id: department.id, name: department.name }) }} type="button">Edit</button>
                    <button className="text-sm font-semibold text-red-700 underline disabled:opacity-50" disabled={deleteDepartment.isPending} onClick={() => confirmDelete(department)} type="button">Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default DepartmentListPage
