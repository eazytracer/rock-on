import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAppMode,
  getConfig,
  getSupabaseUrl,
} from '../../../src/config/appMode'

describe('appMode', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should return "local" mode when VITE_MOCK_AUTH is true', () => {
    vi.stubEnv('VITE_MOCK_AUTH', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')

    expect(getAppMode()).toBe('local')
  })

  it('should return "local" mode when VITE_SUPABASE_URL is not set', () => {
    vi.stubEnv('VITE_MOCK_AUTH', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', '')

    expect(getAppMode()).toBe('local')
  })

  it('should return "local" mode when VITE_SUPABASE_URL is "mock"', () => {
    vi.stubEnv('VITE_MOCK_AUTH', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', 'mock')

    expect(getAppMode()).toBe('local')
  })

  it('should return "production" mode when credentials are valid', () => {
    vi.stubEnv('VITE_MOCK_AUTH', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key')

    expect(getAppMode()).toBe('production')
  })

  it('should have correct config properties for local mode', () => {
    vi.stubEnv('VITE_MOCK_AUTH', 'true')

    const config = getConfig()
    expect(config.isLocal).toBe(true)
    expect(config.isProduction).toBe(false)
    expect(config.enableMockAuth).toBe(true)
    expect(config.enableSupabaseAuth).toBe(false)
  })

  describe('getSupabaseUrl', () => {
    it('uses the page host with the local Supabase port on the dev server', () => {
      vi.stubEnv('MODE', 'development')
      vi.stubEnv('VITE_SUPABASE_URL', 'http://host.docker.internal:54321')

      expect(getSupabaseUrl()).toBe(`http://${window.location.hostname}:54321`)
    })

    it('leaves a remote (https) Supabase URL alone on the dev server', () => {
      vi.stubEnv('MODE', 'development')
      vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')

      expect(getSupabaseUrl()).toBe('https://test.supabase.co')
    })

    it('uses VITE_SUPABASE_URL as-is outside the dev server', () => {
      vi.stubEnv('MODE', 'production')
      vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')

      expect(getSupabaseUrl()).toBe('https://test.supabase.co')
    })

    it('returns undefined when Supabase is not configured', () => {
      vi.stubEnv('MODE', 'development')
      vi.stubEnv('VITE_SUPABASE_URL', '')

      expect(getSupabaseUrl()).toBeFalsy()
    })
  })
})
