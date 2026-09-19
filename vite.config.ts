import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tailwindcss(), tsConfigPaths({ projects: ['./tsconfig.json'] })],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    // Garde anti-mock : injecté au build, interdit par défaut. En production
    // toute valeur truthy fait échouer le démarrage (src/main.tsx).
    'import.meta.env.ALLOW_MOCK_DATA': JSON.stringify(process.env.ALLOW_MOCK_DATA === 'true'),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5299',
        changeOrigin: true,
      },
    },
  },
})
