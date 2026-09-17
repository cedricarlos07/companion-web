import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Build marketing — landing + docs (companion.kamaloka.ai / docs.companion.kamaloka.ai).
 * Sortie : website/dist (servi par le Control Center ou n'importe quel static host).
 * Réutilise le design system Companion (BoardUI + Hugeicons + tokens) via l'alias @.
 */
export default defineConfig({
  root: 'website',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: path.resolve(__dirname, 'website/landing.html'),
        docs: path.resolve(__dirname, 'website/docs.html'),
      },
    },
  },
})
