import { defineConfig } from '@tanstack/react-start/config'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    preset: 'node-server',
    port: 5299,
  },
  vite: {
    plugins: [
      tsConfigPaths({ projects: ['./tsconfig.json'] }),
      tailwindcss(),
    ],
  },
})
