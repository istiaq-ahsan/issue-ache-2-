import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api.js'
import { useAuth } from '../../context/use-auth.js'
import {
  getAuthorizedReturnPath,
  getLoginCandidates,
  getLoginDestination,
  hasPendingRegistration,
} from '../../services/login-access.js'
import { getActiveAuthorityDashboardPath } from '../../services/authority-access.js'

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

const loginTypes = {
  authority: {
    title: 'Authority Login',
    roleLabel: 'Authority',
    description: 'Sign in with the email and password provided by your institution.',
  },
  institution: {
    title: 'Institution Admin Login',
    roleLabel: 'institution administrator',
    description: 'Sign in with the account used to manage your institution workspace.',
  },
  student: {
    title: 'Student Login',
    roleLabel: 'Student',
    description: 'Sign in with the account registered with your institution.',
  },
  teacher: {
    title: 'Teacher Login',
    roleLabel: 'Teacher',
    description: 'Sign in with the account registered with your institution.',
  },
}

function getErrorMessage(error) {
  if (
    ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(
      error.code,
    )
  ) {
    return 'Email or password is incorrect.'
  }
  if (error.response?.status === 403) {
    return 'This account does not have an application profile. Check the selected login type or contact your institution.'
  }
  return (
    error.apiMessage ||
    error.response?.data?.error?.message ||
    error.message ||
    'Unable to sign in. Please try again.'
  )
}

function RoleLoginPage({ accountType }) {
  const config = loginTypes[accountType]
  const { signIn, resetPassword, logout, user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [initialSessionChecked, setInitialSessionChecked] = useState(false)
  const [choices, setChoices] = useState([])
  const [submittingChoice, setSubmittingChoice] = useState(false)
  const initialAuthCheck = useRef(true)
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const handleRoleMismatch = useCallback(async (message) => {
    setChoices([])
    form.resetField('password')
    queryClient.clear()
    try {
      await logout()
      setErrorMessage(message)
    } catch {
      queryClient.clear()
      setErrorMessage(
        `${message} The Firebase session could not be cleared; please sign out and try again.`,
      )
    }
  }, [form, logout, queryClient])

  const verifyAndRoute = useCallback(async () => {
    setErrorMessage('')
    setChoices([])
    try {
      const { data } = await api.get('/auth/me')
      const profile = data.data
      const candidates = getLoginCandidates(accountType, profile)

      if (candidates.length === 0) {
        if (hasPendingRegistration(accountType, profile)) {
          navigate(`/registration/status?role=${accountType.toUpperCase()}`, {
            replace: true,
          })
          return
        }

        await handleRoleMismatch(
          `This account does not have an active ${config.roleLabel} membership or institution access.`,
        )
        return
      }

      const returnPath = getAuthorizedReturnPath(
        accountType,
        location.state?.from,
        candidates,
      )

      if (accountType === 'institution') {
        if (returnPath) {
          navigate(returnPath, { replace: true })
        } else if (candidates.length === 1) {
          navigate(getLoginDestination(accountType, candidates[0].id), {
            replace: true,
          })
        } else {
          navigate('/institution/dashboard', { replace: true })
        }
        return
      }

      if (returnPath) {
        navigate(returnPath, { replace: true })
        return
      }

      if (candidates.length === 1) {
        navigate(
          accountType === 'authority'
            ? getActiveAuthorityDashboardPath(candidates)
            : getLoginDestination(accountType, candidates[0].institutionId),
          { replace: true },
        )
        return
      }

      setChoices(candidates)
    } catch (error) {
      if (error.response?.status === 403) {
        await handleRoleMismatch(getErrorMessage(error))
      } else {
        setErrorMessage(getErrorMessage(error))
      }
    }
  }, [
    accountType,
    config.roleLabel,
    handleRoleMismatch,
    location.state,
    navigate,
  ])

  useEffect(() => {
    if (authLoading || !initialAuthCheck.current) return
    initialAuthCheck.current = false
    if (user) {
      void Promise.resolve()
        .then(verifyAndRoute)
        .finally(() => setInitialSessionChecked(true))
    }
  }, [authLoading, user, verifyAndRoute])

  async function submit(values) {
    setErrorMessage('')
    setHasSubmitted(true)
    setSubmitting(true)
    try {
      await signIn(values.email.trim(), values.password)
      await verifyAndRoute()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function requestPasswordReset() {
    setResetMessage('')
    setResetError('')
    const email = form.getValues('email')
    if (!email.trim() || !z.string().email().safeParse(email).success) {
      setResetError('Enter your account email first.')
      return
    }

    setResetSubmitting(true)
    try {
      await resetPassword(email.trim())
      setResetMessage(
        'If an account exists for that email, Firebase will send a password reset link.',
      )
    } catch {
      setResetError('Could not send a password reset email. Check the address and try again.')
    } finally {
      setResetSubmitting(false)
    }
  }

  function chooseInstitution(candidate) {
    setSubmittingChoice(true)
    const returnPath = getAuthorizedReturnPath(
      accountType,
      location.state?.from,
      choices,
    )
    navigate(
      returnPath ||
        getLoginDestination(accountType, candidate.institutionId || candidate.id),
      { replace: true },
    )
  }

  if (
    authLoading ||
    submitting ||
    (user && !hasSubmitted && !initialSessionChecked)
  ) {
    return <p className="p-8" role="status">Verifying your {config.roleLabel} access…</p>
  }

  const registrationHref =
    accountType === 'institution'
      ? '/institution/register'
      : accountType === 'student' || accountType === 'teacher'
        ? `/${accountType}/register`
        : null

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <Link className="text-sm font-medium text-blue-700 hover:underline" to="/login">
          Back to login options
        </Link>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-blue-700">
          {config.roleLabel} workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{config.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{config.description}</p>

        {choices.length > 1 ? (
          <div className="mt-6 grid gap-3" aria-labelledby="institutionChoicesHeading">
            <h2 id="institutionChoicesHeading" className="font-semibold text-slate-950">
              Choose an institution
            </h2>
            {choices.map((choice) => {
              const institution = choice.institution || choice
              const id = choice.institutionId || choice.id
              return (
                <button
                  className="min-h-14 rounded-lg border border-slate-300 px-4 py-3 text-left hover:border-blue-500 hover:bg-blue-50 disabled:opacity-60"
                  disabled={submittingChoice}
                  key={id}
                  onClick={() => chooseInstitution(choice)}
                  type="button"
                >
                  <span className="block font-semibold text-slate-900">
                    {institution.name || 'Institution'}
                  </span>
                  {institution.institutionCode && (
                    <span className="mt-1 block text-sm text-slate-600">
                      Code: {institution.institutionCode}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <form
            className="mt-6 grid gap-4"
            noValidate
            onSubmit={form.handleSubmit(submit)}
          >
            <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`${accountType}Email`}>
              Email
              <input
                autoComplete="email"
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                id={`${accountType}Email`}
                maxLength={320}
                type="email"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <span className="text-sm text-red-700" role="alert">
                  {form.formState.errors.email.message}
                </span>
              )}
            </label>
            <button
              className="justify-self-start text-sm font-semibold text-blue-700 underline disabled:opacity-60"
              disabled={resetSubmitting}
              onClick={requestPasswordReset}
              type="button"
            >
              {resetSubmitting ? 'Sending reset email…' : 'Forgot password?'}
            </button>
            {resetMessage && <p className="text-sm text-green-800" role="status">{resetMessage}</p>}
            {resetError && <p className="text-sm text-red-700" role="alert">{resetError}</p>}
            <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`${accountType}Password`}>
              Password
              <input
                autoComplete="current-password"
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                id={`${accountType}Password`}
                type="password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <span className="text-sm text-red-700" role="alert">
                  {form.formState.errors.password.message}
                </span>
              )}
            </label>
            {errorMessage && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                {errorMessage}
              </p>
            )}
            <button
              className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              Sign in as {config.roleLabel}
            </button>
          </form>
        )}

        {registrationHref && (
          <p className="mt-5 text-sm text-slate-600">
            {accountType === 'institution'
              ? 'New institution? '
              : `New ${accountType}? `}
            <Link className="font-semibold text-blue-700 underline" to={registrationHref}>
              Register here
            </Link>
          </p>
        )}
      </section>
    </main>
  )
}

export default RoleLoginPage
