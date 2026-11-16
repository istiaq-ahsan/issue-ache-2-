import axios from 'axios'
import { signOut } from 'firebase/auth'
import { firebaseAuth } from '../firebase/firebase.js'

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
