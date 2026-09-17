import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/globals.css'
import { LandingPage } from './LandingPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
)
