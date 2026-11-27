import '@testing-library/jest-dom'
import { beforeAll, vi } from 'vitest'
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
}) as unknown as typeof fetch

// Global test setup.
// Post Phase 2 there is no local IndexedDB mirror — the web client is a naive
// online Supabase client — so there is no test database to open/reset/delete.
beforeAll(async () => {
  // Verify Supabase schema if available (optional — won't fail if Supabase is not running)
  if (process.env.VITE_SUPABASE_URL && (await isSupabaseAvailable())) {
    try {
      await verifySupabaseSchema()
      console.log('✅ Supabase schema verified')
    } catch (error) {
      console.warn('⚠️  Supabase schema verification failed:', error)
      // Don't fail tests if Supabase is not available
    }
  }
})
