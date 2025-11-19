import { createClient } from '@supabase/supabase-js'
import { config } from '../../config/appMode'

let supabaseInstance: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  // Allow Supabase client when Supabase auth is enabled (production mode)
  if (!config.enableSupabaseAuth) {
    throw new Error('Supabase client should only be used when Supabase auth is enabled')
  }

  if (!supabaseInstance) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Supabase URL and anon key must be configured')
    }

    supabaseInstance = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    )
  }

  return supabaseInstance
}

// Export singleton instance (only when Supabase auth is enabled)
export const supabase = config.enableSupabaseAuth ? getSupabaseClient() : null
