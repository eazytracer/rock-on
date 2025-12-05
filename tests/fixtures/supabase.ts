import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Well-known local Supabase service role key (same for all local instances)
// This is NOT a secret - it's the default key for local development
const LOCAL_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

/**
 * Get the local Supabase service role key from `npx supabase status`
 * Falls back to well-known local key if command fails
 */
export async function getLocalServiceKey(): Promise<string> {
  try {
    const { stdout } = await execAsync('npx supabase status');
    const match = stdout.match(/Secret[^:]*:\s+(.+)/);
    if (match) {
      return match[1].trim();
    }
    // Fall back to well-known local key
    return LOCAL_SERVICE_ROLE_KEY;
  } catch (error) {
    // Fall back to well-known local key for local testing
    console.warn('Could not get service key from supabase status, using default local key');
    return LOCAL_SERVICE_ROLE_KEY;
  }
}

/**
 * Ensure local Supabase is running
 */
export async function ensureSupabaseRunning(): Promise<void> {
  try {
    await execAsync('npx supabase status');
  } catch (error) {
    throw new Error(
      'Supabase is not running. Start it with: npx supabase start'
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
