import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/globals.css'
import { IS_PROD_BUILD, MOCK_ALLOWED } from '@/lib/mock'
import App from './App'

// Garde anti-mock : en production, aucun repli démonstration n'est acceptable.
// Mauvaise config de build = l'application refuse de démarrer.
if (IS_PROD_BUILD && MOCK_ALLOWED) {
  throw new Error('Mock data forbidden in production: ALLOW_MOCK_DATA doit valoir false')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
