import { createClient } from '@supabase/supabase-js'

/**
 * Supabase is used for login and the session ONLY. All data goes through
 * the FastAPI backend (see api.ts). The URL and publishable key are injected
 * by vite.config.ts from the root .env; nothing else reaches the browser.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && publishableKey)

if (!isSupabaseConfigured) {
  console.error('Supabase is not configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the root .env.')
}

export const supabase = createClient(
  url || 'http://localhost:54321',
  publishableKey || 'missing-publishable-key',
  {
    auth: {
      persistSession: true, // stays logged in after a reload (localStorage)
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)
