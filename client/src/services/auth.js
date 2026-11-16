import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { requireFirebaseAuth } from '../firebase/firebase.js'

export function signIn(email, password) {
  return signInWithEmailAndPassword(requireFirebaseAuth(), email, password)
}

export function signUp(email, password) {
  return createUserWithEmailAndPassword(requireFirebaseAuth(), email, password)
}

export function resetPassword(email) {
  return sendPasswordResetEmail(requireFirebaseAuth(), email)
}

export function logout() {
  return signOut(requireFirebaseAuth())
}
