import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// NOTE: supabaseAdmin (service_role client) has been removed from the client bundle.
// The VITE_ prefixed env var was inlined into the JS bundle at build time,
// exposing the key to any visitor via DevTools.
//
// For admin operations (user creation, bulk deletes), deploy a Supabase Edge Function
// that uses the service_role key server-side. The Edge Function is NOT exposed to the browser.
// See: supabase.com/docs/guides/functions
