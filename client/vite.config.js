import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const apiBaseUrl = process.env.VITE_API_BASE_URL || fileEnv.VITE_API_BASE_URL

  if (process.env.VERCEL === '1' && mode === 'production') {
    const requiredFirebaseVariables = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
    ]
    const missingFirebaseVariables = requiredFirebaseVariables.filter(
      (key) => !(process.env[key] || fileEnv[key]),
    )

    if (missingFirebaseVariables.length > 0) {
      throw new Error(
        `Configure the Firebase web app variables in Vercel: ${missingFirebaseVariables.join(', ')}`,
      )
    }

    let parsedApiUrl
    try {
      parsedApiUrl = new URL(apiBaseUrl)
    } catch {
      throw new Error('Set VITE_API_BASE_URL to the deployed HTTPS API origin ending in /api.')
    }

    if (
      parsedApiUrl.protocol !== 'https:' ||
      parsedApiUrl.pathname.replace(/\/+$/, '') !== '/api' ||
      parsedApiUrl.search ||
      parsedApiUrl.hash
    ) {
      throw new Error('VITE_API_BASE_URL must be an HTTPS URL ending in /api.')
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
