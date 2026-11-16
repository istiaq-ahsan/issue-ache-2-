import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onAuthStateChanged } from 'firebase/auth'
import { firebaseAuth } from '../firebase/firebase.js'
import { logout, resetPassword, signIn, signUp } from '../services/auth.js'
import AuthContext from './auth-context.js'
import { setExpiredSessionHandler } from '../lib/api.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(firebaseAuth))
  const queryClient = useQueryClient()
  const previousUid = useRef(null)

  async function handleSignIn(email, password) {
    const credential = await signIn(email, password)
    if (previousUid.current && previousUid.current !== credential.user.uid) {
      queryClient.clear()
    }
    setUser(credential.user)
    return credential
  }

  async function handleSignUp(email, password) {
    const credential = await signUp(email, password)
    queryClient.clear()
    setUser(credential.user)
    return credential
  }

  async function handlePasswordReset(email) {
    return resetPassword(email)
  }

  async function handleLogout() {
    await logout()
    queryClient.clear()
    setUser(null)
  }

  useEffect(() => {
    setExpiredSessionHandler(() => {
      queryClient.clear()
    })

    if (!firebaseAuth) {
      return undefined
    }

    return onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (previousUid.current !== firebaseUser?.uid) {
        queryClient.clear()
      }
      previousUid.current = firebaseUser?.uid || null
      setUser(firebaseUser)
      setLoading(false)
    })
  }, [queryClient])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        resetPassword: handlePasswordReset,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
