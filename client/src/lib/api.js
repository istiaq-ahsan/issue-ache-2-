import axios from 'axios'
import { signOut } from 'firebase/auth'
import { toast } from 'sonner'
import { firebaseAuth } from '../firebase/firebase.js'
import queryClient from './query-client.js'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/api' : '')

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL must be configured for production.')
}

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

let expiredSessionHandler
let signOutPending

async function clearExpiredSession(error) {
  if (!signOutPending) {
    signOutPending = signOut(firebaseAuth)
      .then(() => expiredSessionHandler?.())
      .finally(() => {
        signOutPending = null
      })
  }

  const cleanupError = await signOutPending.then(
    () => null,
    (signOutError) => signOutError,
  )
  if (cleanupError) {
    error.authCleanupError = cleanupError
    error.apiMessage = 'Your session expired, and the sign-out could not be completed. Please sign out and try again.'
  }
}

export function setExpiredSessionHandler(handler) {
  expiredSessionHandler = handler
}

function findAdministeredInstitution(institutionId) {
  if (!institutionId) return false
  const profiles = queryClient.getQueriesData({ queryKey: ['auth', 'me'] })
  return profiles.some(([, response]) => {
    const profile = response?.data?.data || response?.data || response
    return profile?.administeredInstitutions?.some(({ id }) => id === institutionId)
  })
}

function getInstitutionIdFromRequest(config) {
  const requestUrl = config?.url || ''
  const match = requestUrl.match(/(?:^|\/)(?:institutions|notifications|audit-logs)\/([^/?#]+)/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

api.interceptors.request.use(async (config) => {
  const user = firebaseAuth?.currentUser
  if (user) {
    try {
      const token = await user.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    } catch (error) {
      error.apiMessage =
        error.code === 'auth/network-request-failed'
          ? 'Could not refresh your sign-in. Check your connection and try again.'
          : error.message || 'Could not verify your sign-in.'
      if (['auth/user-token-expired', 'auth/id-token-revoked', 'auth/invalid-user-token', 'auth/user-disabled'].includes(error.code)) {
        await clearExpiredSession(error)
      }
      throw error
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const apiError = error.response?.data?.error
    error.apiMessage =
      apiError?.message ||
      (error.request
        ? 'The server could not be reached. Check your connection and try again.'
        : error.message || 'The request could not be completed.')
    error.apiCode = apiError?.code
    error.apiStatus = status

    if (apiError?.code === 'PLAN_LIMIT_REACHED') {
      const limit = apiError.details?.limit
      toast.error(
        limit
          ? `${apiError.message} (limit: ${limit}).`
          : apiError.message || 'This plan limit has been reached.',
      )
    }

    if (apiError?.code === 'SUBSCRIPTION_INACTIVE') {
      const institutionId = getInstitutionIdFromRequest(error.config)
      if (findAdministeredInstitution(institutionId)) {
        toast.warning(apiError.message || 'Renew your institution subscription to continue.')
        const billingPath = `/institution/subscriptions?institutionId=${encodeURIComponent(institutionId)}`
        if (window.location.pathname + window.location.search !== billingPath) {
          window.location.assign(billingPath)
        }
      }
    }

    if (status === 401 && firebaseAuth?.currentUser) {
      await clearExpiredSession(error)
    }

    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error, fallback = 'The request could not be completed.') {
  return error?.apiMessage || error?.response?.data?.error?.message || fallback
}

export default api
