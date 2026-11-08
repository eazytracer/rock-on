/**
 * Typed Supabase client for the API layer. Types are generated from the local
 * schema (`just types` → src/types/database.types.ts); regenerate after every
 * migration so web and Flutter read the same contract.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../supabase/client'
import type { Database } from '../../types/database.types'

export function api(): SupabaseClient<Database> {
  return getSupabaseClient() as unknown as SupabaseClient<Database>
}
