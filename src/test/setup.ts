import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { beforeAll, afterAll, afterEach } from 'vitest'
import { db } from '../services/database'
import { resetTestDatabase } from '../../tests/helpers/testDatabase'
import {
  verifySupabaseSchema,
  isSupabaseAvailable,
} from '../../tests/helpers/testSupabase'

// Global test setup
beforeAll(async () => {
  // Verify Supabase schema if available (optional - won't fail if Supabase is not running)
  if (process.env.VITE_SUPABASE_URL && (await isSupabaseAvailable())) {
    try {
      await verifySupabaseSchema()
      console.log('✅ Supabase schema verified')
    } catch (error) {
      console.warn('⚠️  Supabase schema verification failed:', error)
      // Don't fail tests if Supabase is not available
    }
  }

  // Initialize IndexedDB for tests
  try {
    await db.open()
    await resetTestDatabase()
    console.log('✅ Test database initialized')
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error)
    throw error
  }
})

// Clean up after each test to prevent state leakage
afterEach(async () => {
  // Optional: Reset database after each test
  // Uncomment if tests are interfering with each other
  // await resetTestDatabase()
})

// Global test teardown
afterAll(async () => {
  try {
    await db.delete()
    console.log('✅ Test database cleaned up')
  } catch (error) {
    console.error('❌ Failed to clean up test database:', error)
  }
})
