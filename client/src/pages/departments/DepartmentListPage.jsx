import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api.js'

function DepartmentListPage({ institutionId }) {
  const [name, setName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const queryClient = useQueryClient()
  const departments = useQuery({
    queryKey: ['departments', institutionId],
    queryFn: async () =>
      (await api.get(`/institutions/${institutionId}/departments`)).data.data.departments,
  })
  const createDepartment = useMutation({
    mutationFn: async (departmentName) =>
      (await api.post(`/institutions/${institutionId}/departments`, { name: departmentName }))
        .data.data.department,
    onSuccess: async (department) => {
      setName('')
      setErrorMessage('')
      toast.success(`${department.name} created and locked`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['departments', institutionId] }),
        queryClient.invalidateQueries({ queryKey: ['institution-dashboard', institutionId] }),
      ])
    },
    onError: (error) => {
      setErrorMessage(
        error.response?.data?.error?.message || 'Could not create the department.',
      )
    },
  })

  function submit(event) {
    event.preventDefault()
    setErrorMessage('')
    createDepartment.mutate(name.trim())
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
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
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Departments</h1>
      </header>

      <form className="mt-7 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row" onSubmit={submit}>
        <label className="grid flex-1 gap-2 text-sm font-medium text-slate-700">
          Create a department
          <input
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-base"
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            placeholder="Department name"
            required
            value={name}
          />
        </label>
        <button
          className="min-h-11 self-end rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          disabled={createDepartment.isPending}
          type="submit"
        >
          {createDepartment.isPending ? 'Creating…' : 'Create department'}
        </button>
        {errorMessage && (
          <p className="text-sm text-red-700 sm:basis-full" role="alert">{errorMessage}</p>
        )}
      </form>

      {departments.isLoading ? (
        <p className="mt-8 text-slate-600" role="status">Loading departments…</p>
      ) : departments.isError ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
          <p>{departments.error.response?.data?.error?.message || 'Could not load departments.'}</p>
          <button className="mt-3 font-semibold underline" onClick={() => departments.refetch()} type="button">
            Try again
          </button>
        </div>
      ) : departments.data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
          No departments yet. Create one above; new departments are free and start locked.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {departments.data.map((department) => {
            const subscription = department.subscriptions[0]
            return (
              <li className="rounded-xl border border-slate-200 bg-white p-5" key={department.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{department.name}</h2>
                    <p className="mt-1 text-sm capitalize text-slate-600">
                      Department: {department.status.toLowerCase()}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    department.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : department.status === 'EXPIRED'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-slate-700'
                  }`}>
                    {department.status}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  Subscription: {subscription ? `${subscription.planName} · ${subscription.status}` : 'None'}
                </p>
                {subscription && (
                  <p className="mt-1 text-xs text-slate-500">
                    Expires {new Date(subscription.endsAt).toLocaleDateString()}
                  </p>
                )}
                <Link
                  className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline"
                  to={`/institution/dashboard/${encodeURIComponent(institutionId)}/departments/${encodeURIComponent(department.id)}`}
                >
                  View department details
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

export default DepartmentListPage
