import { exec } from 'child_process';
import { promisify } from 'util';
import { getSupabaseAdmin } from './supabase';

const execAsync = promisify(exec);

/**
 * Reset the local Supabase database to a clean state
 * WARNING: This deletes ALL data!
 */
export async function resetLocalDatabase(): Promise<void> {
  // Safety check: only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot reset production database!');
  }

  try {
    console.log('Resetting local database...');
    await execAsync('supabase db reset --local');
    console.log('Database reset complete');
  } catch (error) {
    throw new Error(`Failed to reset database: ${error}`);
  }
}

/**
 * Seed the database with test data
 */
export async function seedTestData(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot seed production database!');
  }

  try {
    console.log('Seeding test data...');
    // Note: supabase db seed uses the seed.sql file if it exists
    // For E2E tests, we typically create data programmatically instead
    await execAsync('supabase db seed --local');
    console.log('Seed complete');
  } catch (error) {
    // If no seed file exists, this is not an error for E2E tests
    console.log('No seed file found (this is okay for E2E tests)');
  }
}

/**
 * Clear test data from specific tables
 * Only deletes records with emails matching @rockontesting.com
 */
export async function clearTestData(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clear data in production database!');
  }

  const supabase = await getSupabaseAdmin();

  try {
    console.log('Clearing test data...');

    // Get all test users (emails ending with @rockontesting.com)
    const { data: testUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', '%@rockontesting.com');

    if (usersError) {
      throw usersError;
    }

    if (!testUsers || testUsers.length === 0) {
      console.log('No test users found');
      return;
    }

    const testUserIds = testUsers.map((u) => u.id);

    // Delete in order (respecting foreign key constraints)
    // Note: With CASCADE deletes, we might only need to delete users
    // But being explicit is safer

    // 1. Delete band memberships
    await supabase
      .from('band_memberships')
      .delete()
      .in('user_id', testUserIds);

    // 2. Delete practice sessions (for bands owned by test users)
    const { data: testBands } = await supabase
      .from('bands')
      .select('id')
      .in('owner_id', testUserIds);

    if (testBands && testBands.length > 0) {
      const testBandIds = testBands.map((b) => b.id);

      await supabase
        .from('practice_sessions')
        .delete()
        .in('band_id', testBandIds);

      // 3. Delete shows
      await supabase.from('shows').delete().in('band_id', testBandIds);

      // 4. Delete setlists
      await supabase.from('setlists').delete().in('band_id', testBandIds);

      // 5. Delete songs
      await supabase.from('songs').delete().in('context_id', testBandIds);

      // 6. Delete bands
      await supabase.from('bands').delete().in('id', testBandIds);
    }

    // 7. Delete users (should cascade to auth.users via trigger)
    await supabase.from('users').delete().in('id', testUserIds);

    console.log(`Cleared data for ${testUserIds.length} test users`);
  } catch (error) {
    throw new Error(`Failed to clear test data: ${error}`);
  }
}

/**
 * Wait for database to be ready
 */
export async function waitForDatabase(timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      await execAsync('supabase status');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Database did not become ready in time');
}
