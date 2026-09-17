import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/globals.css'
import { DocsPage } from './Docsite'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DocsPage />
  </StrictMode>,
)
