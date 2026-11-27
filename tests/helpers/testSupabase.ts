import { createClient, SupabaseClient } from '@supabase/supabase-js'

let testSupabaseClient: SupabaseClient | null = null

/**
 * Get or create a Supabase client for testing
 * Uses service role key for full database access
 */
export function getTestSupabaseClient(): SupabaseClient {
  if (testSupabaseClient) {
    return testSupabaseClient
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseKey) {
    throw new Error(
      'SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY must be set for testing'
    )
  }

  testSupabaseClient = createClient(supabaseUrl, supabaseKey)
  return testSupabaseClient
}

/**
 * Verify that the Supabase schema matches expectations
 * This helps catch schema drift issues early
 */
export async function verifySupabaseSchema() {
  const supabase = getTestSupabaseClient()

  const errors: string[] = []

  // Verify shows table exists
  const { error: showsError } = await supabase
    .from('shows')
    .select('count', { count: 'exact', head: true })
  if (showsError) {
    errors.push(`Shows table error: ${showsError.message}`)
  }

  // Verify field names match spec (check for common mismatches)
  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (songError) {
    errors.push(`Songs table error: ${songError.message}`)
  } else if (song) {
    // Check that we use 'tempo' not 'bpm'
    if ('bpm' in song) {
      errors.push('Songs table still has "bpm" field - should be "tempo"')
    }
    if (!('tempo' in song)) {
      errors.push('Songs table missing "tempo" field')
    }
  }

  // Verify setlists use 'last_modified' not 'updated_date'
  const { data: setlist, error: setlistError } = await supabase
    .from('setlists')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (setlistError) {
    errors.push(`Setlists table error: ${setlistError.message}`)
  } else if (setlist) {
    if (!('last_modified' in setlist)) {
      errors.push('Setlists table missing "last_modified" field')
    }
  }

  // Verify practice_sessions table (not 'practices')
  const { error: practicesError } = await supabase
    .from('practice_sessions')
    .select('count', { count: 'exact', head: true })

  if (practicesError) {
    errors.push(`Practice sessions table error: ${practicesError.message}`)
  }

  if (errors.length > 0) {
    throw new Error(`Schema validation failed:\n${errors.join('\n')}`)
  }

  return true
}

/**
 * Check if Supabase is running and accessible
 */
export async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const supabase = getTestSupabaseClient()
    const { error } = await supabase
      .from('songs')
      .select('count', { count: 'exact', head: true })
    return !error
  } catch {
    return false
  }
}
