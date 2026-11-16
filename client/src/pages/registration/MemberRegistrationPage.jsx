import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import api, { getApiErrorMessage } from '../../lib/api.js'
import { useAuth } from '../../context/use-auth.js'

const memberDetails = {
  STUDENT: {
    title: 'Student registration',
    officialIdLabel: 'Official Student ID',
    officialIdField: 'studentId',
    endpoint: '/students/register',
  },
  TEACHER: {
    title: 'Teacher registration',
    officialIdLabel: 'Official Teacher/Employee ID',
    officialIdField: 'teacherId',
    endpoint: '/teachers/register',
  },
}

function MemberRegistrationPage({ role }) {
  const details = memberDetails[role]
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [lookupCode, setLookupCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const schema = useMemo(() => z.object({
    institutionCode: z.string().trim().min(1, 'Enter your Institution Code.').max(64),
    officialId: z.string().trim().min(1, `Enter your ${details.officialIdLabel.toLowerCase()}.`).max(100),
    name: z.string().trim().min(1, 'Enter your full name.').max(200),
    email: z.string().trim().email('Enter a valid email address.').max(320),
    phone: z.string().trim().min(1, 'Enter your phone number.').max(40),
    departmentId: z.string().min(1, 'Select a department.'),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  }), [details])
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      institutionCode: '',
      officialId: '',
      name: '',
      email: '',
      phone: '',
      departmentId: '',
      password: '',
    },
  })
  const institutionCode = useWatch({
    control: form.control,
    name: 'institutionCode',
    defaultValue: '',
  })
  const departmentId = useWatch({
    control: form.control,
    name: 'departmentId',
    defaultValue: '',
  })

  const institutionLookup = useQuery({
    queryKey: ['registration-institution', lookupCode],
    queryFn: async () =>
      (await api.get(`/registrations/institutions/${encodeURIComponent(lookupCode)}/departments`))
        .data.data,
    enabled: Boolean(lookupCode),
    retry: false,
  })

  const registration = useMutation({
    mutationFn: async (formValues) => {
      const { data } = await api.post(details.endpoint, {
        institutionCode: formValues.institutionCode.trim(),
        [details.officialIdField]: formValues.officialId.trim(),
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        phone: formValues.phone.trim(),
        departmentId: formValues.departmentId,
        password: formValues.password,
      })
      return data.data.registration
    },
    onSuccess: async (_registration, formValues) => {
      try {
        await signIn(formValues.email.trim(), formValues.password)
        toast.success('Registration submitted. It is awaiting Authority approval.')
        navigate('/registration/status', { replace: true })
      } catch {
        toast.warning('Registration was submitted. Sign in to check its approval status.')
        navigate('/login', { replace: true })
      }
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, 'Registration failed. Please try again.'))
    },
  })

  function updateField(name, value) {
    setErrorMessage('')
    form.setValue(name, value, { shouldDirty: true, shouldValidate: true })
    if (name === 'institutionCode') {
      form.setValue('departmentId', '', { shouldDirty: true, shouldValidate: true })
      setLookupCode('')
    }
  }

  function loadInstitution(event) {
    event.preventDefault()
    setErrorMessage('')
    form.setValue('departmentId', '', { shouldDirty: true, shouldValidate: true })
    setLookupCode(institutionCode.trim().toUpperCase())
  }

  function submit(formValues) {
    setErrorMessage('')
    registration.mutate(formValues)
  }

  const departments = institutionLookup.data?.departments || []
  const institutionMatchesCode =
    institutionLookup.data?.institution.institutionCode === institutionCode.trim().toUpperCase()

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-12 sm:px-8">
      <Link to="/" className="text-sm font-medium text-blue-700 hover:underline">
        Issue Ache!
      </Link>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          {role === 'STUDENT' ? 'Student' : 'Teacher'} onboarding
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {details.title}
        </h1>
        <p className="mt-3 text-slate-600">
          Your registration must be approved by an Authority at your institution before you can access the application.
        </p>

        <form className="mt-7 grid gap-5 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit(submit)}>
          <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2" htmlFor="institutionCode">
            Institution Code
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                autoCapitalize="characters"
                autoComplete="off"
                className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 text-base uppercase"
                maxLength={64}
                id="institutionCode"
                {...form.register('institutionCode', {
                  onChange: (event) => updateField('institutionCode', event.target.value),
                })}
              />
              <button
                className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                disabled={!institutionCode.trim() || institutionLookup.isFetching}
                onClick={loadInstitution}
                type="button"
              >
                {institutionLookup.isFetching ? 'Checking…' : 'Find institution'}
              </button>
            </div>
            {form.formState.errors.institutionCode && <span className="text-sm text-red-700" role="alert">{form.formState.errors.institutionCode.message}</span>}
          </label>

          {institutionLookup.isError && lookupCode && (
            <p className="text-sm text-red-700 sm:col-span-2" role="alert">
              {institutionLookup.error.response?.data?.error?.message || 'Could not find that Institution Code.'}
            </p>
          )}
          {institutionMatchesCode && (
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900 sm:col-span-2" role="status">
              <p className="font-semibold">{institutionLookup.data.institution.name}</p>
              {departments.length === 0 ? (
                <p className="mt-1">This institution has no departments available for registration.</p>
              ) : (
                <label className="mt-3 grid gap-2 font-medium">
                  Department
                  <select
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
                    {...form.register('departmentId', {
                      onChange: (event) => updateField('departmentId', event.target.value),
                    })}
                  >
                    <option value="">Select a department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                  {form.formState.errors.departmentId && <span className="text-sm text-red-700" role="alert">{form.formState.errors.departmentId.message}</span>}
                </label>
              )}
            </div>
          )}

          <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="officialId">
            {details.officialIdLabel}
            <input
              autoComplete="off"
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-base"
              maxLength={100}
              id="officialId"
              {...form.register('officialId', {
                onChange: (event) => updateField('officialId', event.target.value),
              })}
            />
            {form.formState.errors.officialId && <span className="text-sm text-red-700" role="alert">{form.formState.errors.officialId.message}</span>}
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="memberName">
            Full name
            <input
              autoComplete="name"
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-base"
              maxLength={200}
              id="memberName"
              {...form.register('name', {
                onChange: (event) => updateField('name', event.target.value),
              })}
            />
            {form.formState.errors.name && <span className="text-sm text-red-700" role="alert">{form.formState.errors.name.message}</span>}
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="memberEmail">
            Email
            <input
              autoComplete="email"
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-base"
              maxLength={320}
              id="memberEmail"
              type="email"
              {...form.register('email', {
                onChange: (event) => updateField('email', event.target.value),
              })}
            />
            {form.formState.errors.email && <span className="text-sm text-red-700" role="alert">{form.formState.errors.email.message}</span>}
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="memberPhone">
            Phone
            <input
              autoComplete="tel"
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-base"
              maxLength={40}
              id="memberPhone"
              type="tel"
              {...form.register('phone', {
                onChange: (event) => updateField('phone', event.target.value),
              })}
            />
            {form.formState.errors.phone && <span className="text-sm text-red-700" role="alert">{form.formState.errors.phone.message}</span>}
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2" htmlFor="memberPassword">
            Password
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-base sm:max-w-md"
              maxLength={128}
              minLength={8}
              id="memberPassword"
              type="password"
              {...form.register('password', {
                onChange: (event) => updateField('password', event.target.value),
              })}
            />
            {form.formState.errors.password && <span className="text-sm text-red-700" role="alert">{form.formState.errors.password.message}</span>}
          </label>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2" role="alert">
              {errorMessage}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
            <button
              className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                registration.isPending ||
                !institutionMatchesCode ||
                !departmentId ||
                departments.length === 0
              }
              type="submit"
            >
              {registration.isPending ? 'Submitting registration…' : 'Submit for approval'}
            </button>
            <Link className="text-sm font-medium text-slate-600 hover:text-blue-700" to="/login">
              Already registered? Sign in
            </Link>
          </div>
        </form>
      </section>
    </main>
  )
}

export default MemberRegistrationPage
