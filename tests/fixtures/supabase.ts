import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Get the local Supabase service role key from `supabase status`
 */
export async function getLocalServiceKey(): Promise<string> {
  try {
    const { stdout } = await execAsync('supabase status');
    const match = stdout.match(/Secret key:\s+(.+)/);
    if (match) {
      return match[1].trim();
    }
    throw new Error('Could not extract service key from supabase status');
  } catch (error) {
    throw new Error(`Failed to get service key: ${error}`);
  }
}

/**
 * Ensure local Supabase is running
 */
export async function ensureSupabaseRunning(): Promise<void> {
  try {
    await execAsync('supabase status');
  } catch (error) {
    throw new Error(
      'Supabase is not running. Start it with: supabase start'
    );
  }
}

/**
 * Create Supabase admin client for E2E tests
 * Uses service role key to bypass RLS policies
 */
let adminClient: SupabaseClient | null = null;

export async function getSupabaseAdmin(): Promise<SupabaseClient> {
  if (adminClient) {
    return adminClient;
  }

  // Check if Supabase is running
  await ensureSupabaseRunning();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

  // Get service key dynamically
  const supabaseServiceKey = await getLocalServiceKey();

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Reset the admin client (useful for tests)
 */
export function resetSupabaseAdmin(): void {
  adminClient = null;
}
