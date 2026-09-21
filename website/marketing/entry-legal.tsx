import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './marketing.css'
import { LegalPage } from './LegalPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LegalPage />
  </StrictMode>,
)
