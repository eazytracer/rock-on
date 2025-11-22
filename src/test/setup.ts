import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { db } from '../services/database'
import { resetTestDatabase } from '../../tests/helpers/testDatabase'
import {
  verifySupabaseSchema,
  isSupabaseAvailable,
} from '../../tests/helpers/testSupabase'

// Mock fetch for Supabase calls in tests
global.fetch = vi.fn((url, _options) => {
  // Mock successful empty responses for Supabase endpoints
  if (typeof url === 'string' && url.includes('supabase')) {
    // Parse URL to detect .maybeSingle() or .single() queries (limit=1 in query params)
    const urlObj = new URL(url)
    const isSingleQuery =
      urlObj.searchParams.has('limit') &&
      urlObj.searchParams.get('limit') === '1'

    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      // Return null for single item queries (.maybeSingle()), empty array for list queries
      json: async () => ({ data: isSingleQuery ? null : [], error: null }),
      text: async () =>
        JSON.stringify({ data: isSingleQuery ? null : [], error: null }),
      blob: async () => new Blob(),
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: () => mockResponse,
    }
    return Promise.resolve(mockResponse as Response)
  }
  // For other URLs, return 404
  return Promise.reject(new Error(`Unmocked fetch call to ${url}`))
}) as any

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
