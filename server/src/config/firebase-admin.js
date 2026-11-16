const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const env = require('./env')

const APP_NAME = 'issue-ache-api'

function getFirebaseAuth() {
  if (!env.FIREBASE_PROJECT_ID) {
    throw new Error(
      'FIREBASE_PROJECT_ID is required to verify Firebase ID tokens. Configure Firebase Admin credentials or application default credentials.',
    )
  }

  if (
    env.NODE_ENV === 'production' &&
    (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY)
  ) {
    throw new Error('Firebase Admin service-account credentials are required in production.')
  }

  const existingApp = getApps().find((app) => app.name === APP_NAME)
  if (existingApp) {
    return getAuth(existingApp)
  }

  const credential =
    env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
      ? cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      : applicationDefault()

  const app = initializeApp(
    {
      credential,
      projectId: env.FIREBASE_PROJECT_ID,
    },
    APP_NAME,
  )

  return getAuth(app)
}

module.exports = { getFirebaseAuth }
