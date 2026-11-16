import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import api, { getApiErrorMessage } from '../../lib/api.js'

const categories = [
  ['CLASSROOM_EQUIPMENT', 'Classroom equipment'],
  ['WIFI_NETWORKING', 'Wi-Fi / networking'],
  ['ELECTRICAL', 'Electrical'],
  ['FURNITURE_INFRASTRUCTURE', 'Furniture / infrastructure'],
  ['CLEANING_SANITATION', 'Cleaning / sanitation'],
  ['LAB_EQUIPMENT', 'Lab equipment'],
  ['OTHER', 'Other'],
]

const issueSchema = z.object({
  departmentId: z.string().min(1, 'Select a department.'),
  category: z.enum(categories.map(([value]) => value)),
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(200),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  location: z.string().trim().min(1, 'Enter the issue location.').max(300),
  description: z.string().trim().min(1, 'Describe the issue.').max(10000),
})

function IssueCreatePage({ role }) {
  const { institutionId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const basePath = `/${role.toLowerCase()}/issues/${encodeURIComponent(institutionId)}`
  const form = useForm({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      departmentId: '',
      category: 'CLASSROOM_EQUIPMENT',
      title: '',
      priority: 'MEDIUM',
      location: '',
      description: '',
    },
  })
  const profile = useQuery({
    queryKey: ['member-profile', institutionId],
    queryFn: async () => (await api.get(`/institutions/${institutionId}/profile`)).data.data.profile,
    retry: false,
  })
  const departments = useMemo(() => {
    if (!profile.data) return []
    return profile.data.departments
  }, [profile.data])
  const createIssue = useMutation({
    mutationFn: async (data) => (await api.post(`/issues/${institutionId}`, data)).data.data.issue,
    onSuccess: async (issue) => {
      toast.success('Issue reported')
      await queryClient.invalidateQueries({ queryKey: ['issues', institutionId] })
      await queryClient.invalidateQueries({ queryKey: ['authority-overview', institutionId] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', institutionId] })
      navigate(`${basePath}/${encodeURIComponent(issue.id)}`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not report this issue.')),
  })

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-8">
      <Link className="text-sm font-semibold text-blue-700 hover:underline" to={basePath}>Back to issues</Link>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Issue report</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Report a campus issue</h1>
        <p className="mt-2 text-sm text-slate-600">Your audience is determined by your account role.</p>
        {profile.isLoading ? (
          <p className="mt-6 text-slate-600" role="status">Loading your departments…</p>
        ) : profile.isError ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
            {profile.error.response?.data?.error?.message || 'Could not load your profile.'}
            <button className="ml-2 font-semibold underline" onClick={() => profile.refetch()} type="button">Try again</button>
          </div>
        ) : departments.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-4 text-slate-600">
            You need an active membership in at least one department to report an issue.
          </p>
        ) : (
          <form className="mt-6 grid gap-4 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit((values) => createIssue.mutate(values))}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Department
              <select aria-invalid={Boolean(form.formState.errors.departmentId)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" {...form.register('departmentId')}>
                <option value="">Select a department</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              {form.formState.errors.departmentId && <span className="text-sm text-red-700" role="alert">{form.formState.errors.departmentId.message}</span>}
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Category
              <select aria-invalid={Boolean(form.formState.errors.category)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" {...form.register('category')}>
                {categories.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>
              {form.formState.errors.category && <span className="text-sm text-red-700" role="alert">{form.formState.errors.category.message}</span>}
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Title
              <input aria-invalid={Boolean(form.formState.errors.title)} className="min-h-11 rounded-lg border border-slate-300 px-3 sm:col-span-2" maxLength={200} {...form.register('title')} />
              {form.formState.errors.title && <span className="text-sm text-red-700" role="alert">{form.formState.errors.title.message}</span>}
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Priority
              <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3" {...form.register('priority')}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Location
              <input aria-invalid={Boolean(form.formState.errors.location)} className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={300} {...form.register('location')} />
              {form.formState.errors.location && <span className="text-sm text-red-700" role="alert">{form.formState.errors.location.message}</span>}
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
              Description
              <textarea aria-invalid={Boolean(form.formState.errors.description)} className="min-h-32 rounded-lg border border-slate-300 p-3" maxLength={10000} {...form.register('description')} />
              {form.formState.errors.description && <span className="text-sm text-red-700" role="alert">{form.formState.errors.description.message}</span>}
            </label>
            <button className="min-h-11 justify-self-start rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60" disabled={createIssue.isPending} type="submit">
              {createIssue.isPending ? 'Submitting…' : 'Submit issue'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default IssueCreatePage
