import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'
import { confirmAction } from '../../lib/confirm-action.js'

function getErrorMessage(error, fallback) {
  return error.response?.data?.error?.message || fallback
}

function AuthorityManagementPage({ institutionId }) {
  const queryClient = useQueryClient()
  const [newAuthority, setNewAuthority] = useState({ name: '', email: '', password: '' })
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({ name: '', email: '' })
  const [formError, setFormError] = useState('')

  const authorities = useQuery({
    queryKey: ['authorities', institutionId],
    queryFn: async () =>
      (await api.get(`/institutions/${institutionId}/authorities`)).data.data.authorities,
    retry: false,
  })

  async function refreshAuthorities() {
    await queryClient.invalidateQueries({ queryKey: ['authorities', institutionId] })
  }

  const createAuthority = useMutation({
    mutationFn: async (account) =>
      (await api.post(`/institutions/${institutionId}/authorities`, account)).data.data.authority,
    onSuccess: async () => {
      setNewAuthority({ name: '', email: '', password: '' })
      setFormError('')
      toast.success('Authority account created. Deliver the initial credentials securely.')
      await refreshAuthorities()
    },
    onError: (error) => setFormError(getErrorMessage(error, 'Could not create the Authority account.')),
  })

  const updateAuthority = useMutation({
    mutationFn: async ({ id, values }) =>
      (await api.patch(`/institutions/${institutionId}/authorities/${id}`, values))
        .data.data.authority,
    onSuccess: async () => {
      setEditingId(null)
      toast.success('Authority account updated')
      await refreshAuthorities()
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update the Authority account.')),
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
    setEditValues({ name: authority.user.name, email: authority.user.email })
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
          Create and manage accounts for this institution. Initial passwords are not stored by the application;
          deliver them to the Authority through a secure channel.
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
          disabled={createAuthority.isPending}
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
                      <div className="flex gap-3 sm:col-span-2">
                        <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={updateAuthority.isPending} type="submit">
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
