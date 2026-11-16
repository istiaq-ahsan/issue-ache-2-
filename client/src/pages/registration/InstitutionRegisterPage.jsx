import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import api, { getApiErrorMessage } from '../../lib/api.js'
import { useAuth } from '../../context/use-auth.js'

function getErrorMessage(error) {
  return getApiErrorMessage(error, 'Institution registration failed. Please try again.')
}

function InstitutionRegisterPage() {
  const [errorMessage, setErrorMessage] = useState('')
  const { signUp, user } = useAuth()
  const navigate = useNavigate()
  const schema = useMemo(() => z.object({
    institutionName: z.string().trim().min(1, 'Enter the institution name.').max(200),
    contactPersonName: z.string().trim().min(1, 'Enter a contact person.').max(200),
    contactEmail: z.string().trim().email('Enter a valid contact email.').max(320),
    administratorEmail: user
      ? z.string().optional()
      : z.string().trim().email('Enter a valid administrator email.').max(320),
    administratorPassword: user
      ? z.string().optional()
      : z.string().min(8, 'Password must be at least 8 characters.').max(128),
    campusType: z.string().trim().min(1, 'Enter the campus type.').max(100),
    campusSize: z.string().trim().min(1, 'Enter the campus size.').max(100),
    location: z.string().trim().min(1, 'Enter the institution location.').max(500),
  }), [user])
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      institutionName: '',
      contactPersonName: '',
      contactEmail: '',
      administratorEmail: '',
      administratorPassword: '',
      campusType: '',
      campusSize: '',
      location: '',
    },
  })
  const registration = useMutation({
    mutationFn: async (values) => {
      if (!user) {
        await signUp(values.administratorEmail, values.administratorPassword)
      }

      const { data } = await api.post('/institutions/register', {
        institutionName: values.institutionName,
        contactPersonName: values.contactPersonName,
        contactEmail: values.contactEmail,
        campusType: values.campusType,
        campusSize: values.campusSize,
        location: values.location,
      })
      return data.data.institution
    },
    onSuccess: (institution) => {
      toast.success('Institution registered successfully')
      navigate(`/institution/dashboard/${institution.id}`, { replace: true })
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error))
    },
  })

  function submit(values) {
    setErrorMessage('')
    registration.mutate(values)
  }

  const fields = [
    ['institutionName', 'Institution name', 'text', true],
    ['contactPersonName', 'Contact person', 'text', true],
    ['contactEmail', 'Institution contact email', 'email', true],
    ['administratorEmail', 'Administrator sign-in email', 'email', !user],
    ['administratorPassword', 'Administrator password', 'password', !user],
    ['campusType', 'Campus type', 'text', true],
    ['campusSize', 'Campus size', 'text', true],
    ['location', 'Location', 'text', true],
  ]

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-12 sm:px-8">
      <Link to="/" className="text-sm font-medium text-blue-700 hover:underline">
        Issue Ache!
      </Link>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Institution onboarding
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Register your institution
        </h1>
        <p className="mt-3 text-slate-600">
          Your administrator account is separate from application roles. Use it
          to manage the institution workspace.
        </p>

        {user && (
          <div className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
            Signed in as {user.email}. This account will administer the new
            institution.
          </div>
        )}

        <form className="mt-7 grid gap-5 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit(submit)}>
          {fields.map(([name, label, type, required]) =>
            required || !user ? (
              <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={name} key={name}>
                {label}
                <input
                  autoComplete={
                    name === 'administratorPassword'
                      ? 'new-password'
                      : name.toLowerCase().includes('email')
                        ? 'email'
                        : 'off'
                  }
                  className="min-h-11 rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  id={name}
                  required={required}
                  type={type}
                  {...form.register(name)}
                />
                {form.formState.errors[name] && (
                  <span className="text-sm text-red-700" role="alert">
                    {form.formState.errors[name].message}
                  </span>
                )}
              </label>
            ) : null,
          )}

          {errorMessage && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
            <button
              className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={registration.isPending}
              type="submit"
            >
              {registration.isPending ? 'Registering institution…' : 'Register institution'}
            </button>
            <Link className="text-sm font-medium text-slate-600 hover:text-blue-700" to="/login">
              Already have an administrator account? Sign in
            </Link>
          </div>
        </form>
      </section>
    </main>
  )
}

export default InstitutionRegisterPage
