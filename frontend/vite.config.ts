import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The single .env lives at the repo root. Load every key, but expose ONLY the
  // two browser-safe values below. Never add an `envPrefix` here: it could leak
  // SUPABASE_SECRET_KEY or DATABASE_URL into the bundle.
  const env = loadEnv(mode, repoRoot, '')
  const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || ''
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(here, 'src') } },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(publishableKey),
    },
    server: {
      proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
