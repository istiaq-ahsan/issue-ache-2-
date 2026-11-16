import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'
import { confirmAction } from '../../lib/confirm-action.js'

function getErrorMessage(error, fallback) {
  return error.apiMessage || error.response?.data?.error?.message || error.message || fallback
}

function AuthorityManagementPage({ institutionId }) {
  const queryClient = useQueryClient()
  const [newAuthority, setNewAuthority] = useState({ name: '', email: '', password: '', departmentIds: [] })
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({ name: '', email: '', departmentIds: [] })
  const [formError, setFormError] = useState('')

  const authorities = useQuery({
    queryKey: ['authorities', institutionId],
    queryFn: async () =>
      (await api.get(`/institutions/${institutionId}/authorities`)).data.data.authorities,
    retry: false,
  })
  const departments = useQuery({
    queryKey: ['departments', institutionId],
    queryFn: async () =>
      (await api.get(`/institutions/${institutionId}/departments`)).data.data.departments,
  })

  async function refreshAuthorities() {
    await queryClient.invalidateQueries({ queryKey: ['authorities', institutionId] })
  }

  const createAuthority = useMutation({
    mutationFn: async (account) => {
      if (account.departmentIds.length === 0) throw new Error('Assign the Authority to at least one department.')
      return (await api.post(`/institutions/${institutionId}/authorities`, account)).data.data.authority
    },
    onSuccess: async () => {
      setNewAuthority({ name: '', email: '', password: '', departmentIds: [] })
      setFormError('')
      toast.success('Authority account created with department access.')
      await refreshAuthorities()
    },
    onError: (error) => setFormError(getErrorMessage(error, 'Could not create the Authority account.')),
  })

  const updateAuthority = useMutation({
    mutationFn: async ({ id, values }) => {
      if (values.departmentIds.length === 0) throw new Error('An Authority must have at least one department.')
      await api.put(`/authorities/${encodeURIComponent(id)}/departments`, {
        departmentIds: values.departmentIds,
      })
      return (await api.patch(`/institutions/${institutionId}/authorities/${id}`, {
        name: values.name,
        email: values.email,
      })).data.data.authority
    },
    onSuccess: async () => {
      setEditingId(null)
      toast.success('Authority account updated')
      await refreshAuthorities()
    },
    onError: async (error) => {
      toast.error(getErrorMessage(error, 'Could not update the Authority account.'))
      await refreshAuthorities()
    },
  })

  const setAuthorityEnabled = useMutation({
    mutationFn: async ({ id, enabled }) =>
      (await api.patch(`/institutions/${institutionId}/authorities/${id}/status`, { enabled }))
        .data.data,
    onSuccess: async (result) => {
      if (result.warning) toast.warning(result.warning)
      else toast.success(`Authority account ${result.authority.status === 'ACTIVE' ? 'enabled' : 'disabled'}`)
      await refreshAuthorities()
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not change Authority access.')),
  })

  const deleteAuthority = useMutation({
    mutationFn: async (id) =>
      (await api.delete(`/institutions/${institutionId}/authorities/${id}`)).data.data,
    onSuccess: async (result) => {
      if (result.warning) toast.warning(result.warning)
      else toast.success('Authority account deleted')
      await refreshAuthorities()
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not delete the Authority account.')),
  })

  function submitCreate(event) {
    event.preventDefault()
    setFormError('')
    createAuthority.mutate(newAuthority)
  }

  function beginEdit(authority) {
    setEditingId(authority.id)
    setEditValues({
      name: authority.user.name,
      email: authority.user.email,
      departmentIds: authority.departments.map(({ id }) => id),
    })
  }

  function selectedDepartmentIds(event) {
    return Array.from(event.target.selectedOptions, (option) => option.value)
  }

  function submitEdit(event, id) {
    event.preventDefault()
    updateAuthority.mutate({ id, values: editValues })
  }

  async function confirmDelete(authority) {
    const confirmed = await confirmAction({
      title: 'Delete this Authority account?',
      description: `${authority.user.name} will lose access to this institution. Audit history will be retained.`,
      confirmText: 'Delete account',
      isDangerous: true,
    })
    if (confirmed) deleteAuthority.mutate(authority.id)
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8">
      <Link
        className="text-sm font-medium text-blue-700 hover:underline"
        to={`/institution/dashboard/${encodeURIComponent(institutionId)}`}
      >
        Back to institution dashboard
      </Link>
      <header className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Institution management
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Authority accounts</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Create institution Authorities and assign one or more departments. Initial passwords are not stored; deliver them securely.
        </p>
      </header>

      <form
        className="mt-7 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
        onSubmit={submitCreate}
      >
        <h2 className="text-lg font-semibold text-slate-950 sm:col-span-2">Create Authority account</h2>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Full name
          <input
            autoComplete="name"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-base"
            maxLength={200}
            onChange={(event) => setNewAuthority({ ...newAuthority, name: event.target.value })}
            required
            value={newAuthority.name}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          Departments
          <select
            aria-describedby="new-authority-departments-help"
            className="min-h-28 rounded-lg border border-slate-300 bg-white px-3 py-2"
            disabled={departments.isLoading || departments.isError}
            multiple
            onChange={(event) => setNewAuthority({ ...newAuthority, departmentIds: selectedDepartmentIds(event) })}
            required
            value={newAuthority.departmentIds}
          >
            {(departments.data || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <span className="text-xs font-normal text-slate-500" id="new-authority-departments-help">
            Select at least one department. Use Ctrl or Command to select multiple.
          </span>
          {departments.isError && <span className="text-sm text-red-700" role="alert">Could not load departments for assignment.</span>}
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input
            autoComplete="email"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-base"
            onChange={(event) => setNewAuthority({ ...newAuthority, email: event.target.value })}
            required
            type="email"
            value={newAuthority.email}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          Initial password
          <input
            autoComplete="new-password"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-base sm:max-w-md"
            maxLength={128}
            minLength={8}
            onChange={(event) => setNewAuthority({ ...newAuthority, password: event.target.value })}
            required
            type="password"
            value={newAuthority.password}
          />
        </label>
        {formError && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{formError}</p>}
        <button
          className="min-h-11 justify-self-start rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          disabled={createAuthority.isPending || departments.isLoading || departments.isError || departments.data?.length === 0}
          type="submit"
        >
          {createAuthority.isPending ? 'Creating account…' : 'Create Authority'}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-950">Institution Authorities</h2>
        {authorities.isLoading ? (
          <p className="mt-4 text-slate-600" role="status">Loading Authority accounts…</p>
        ) : authorities.isError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
            <p>{getErrorMessage(authorities.error, 'Could not load Authority accounts.')}</p>
            <button className="mt-3 font-semibold underline" onClick={() => authorities.refetch()} type="button">
              Try again
            </button>
          </div>
        ) : authorities.data.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
            No Authority accounts have been created for this institution.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {authorities.data.map((authority) => {
              const isDeleted = Boolean(authority.deletedAt)
              const isEditing = editingId === authority.id
              return (
                <li className="rounded-xl border border-slate-200 bg-white p-5" key={authority.id}>
                  {isEditing ? (
                    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => submitEdit(event, authority.id)}>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Name
                        <input
                          className="min-h-11 rounded-lg border border-slate-300 px-3"
                          maxLength={200}
                          onChange={(event) => setEditValues({ ...editValues, name: event.target.value })}
                          required
                          value={editValues.name}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Email
                        <input
                          className="min-h-11 rounded-lg border border-slate-300 px-3"
                          onChange={(event) => setEditValues({ ...editValues, email: event.target.value })}
                          required
                          type="email"
                          value={editValues.email}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                        Departments
                        <select
                          className="min-h-28 rounded-lg border border-slate-300 bg-white px-3 py-2"
                          disabled={departments.isLoading || departments.isError}
                          multiple
                          onChange={(event) => setEditValues({ ...editValues, departmentIds: selectedDepartmentIds(event) })}
                          required
                          value={editValues.departmentIds}
                        >
                          {(departments.data || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                        <span className="text-xs font-normal text-slate-500">An Authority must remain assigned to at least one department.</span>
                      </label>
                      <div className="flex gap-3 sm:col-span-2">
                        <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={updateAuthority.isPending || departments.isLoading || departments.isError} type="submit">
                          {updateAuthority.isPending ? 'Saving…' : 'Save changes'}
                        </button>
                        <button className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700" onClick={() => setEditingId(null)} type="button">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-950">{authority.user.name}</h3>
                          <p className="mt-1 text-sm text-slate-600">{authority.user.email}</p>
                          <div aria-label={`Departments assigned to ${authority.user.name}`} className="mt-3 flex flex-wrap gap-1.5">
                            {authority.departments.map((department) => (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800" key={department.id}>{department.name}</span>
                            ))}
                          </div>
                          <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                            isDeleted
                              ? 'bg-slate-100 text-slate-700'
                              : authority.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-900'
                          }`}>
                            {isDeleted ? 'DELETED' : authority.status}
                          </span>
                        </div>
                        {!isDeleted && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => beginEdit(authority)}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              disabled={setAuthorityEnabled.isPending}
                              onClick={() =>
                                setAuthorityEnabled.mutate({
                                  id: authority.id,
                                  enabled: authority.status !== 'ACTIVE',
                                })
                              }
                              type="button"
                            >
                              {authority.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                              disabled={deleteAuthority.isPending}
                              onClick={() => confirmDelete(authority)}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

export default AuthorityManagementPage
