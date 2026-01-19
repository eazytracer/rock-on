export type AppMode = 'local' | 'production'

export interface AppConfig {
  mode: AppMode
  isLocal: boolean
  isProduction: boolean

  // Sync settings
  syncInterval: number
  syncOnStartup: boolean
  syncOnOnline: boolean

  // Auth settings
  enableMockAuth: boolean
  enableSupabaseAuth: boolean

  // Supabase settings
  supabaseUrl?: string
  supabaseAnonKey?: string
}

// Detect if we're running in Playwright E2E tests (headless browser automation)
export function isE2ETestEnvironment(): boolean {
  if (typeof window === 'undefined') return false

  try {
    // Check for headless Chrome (Playwright's default)
    if (navigator.userAgent.includes('HeadlessChrome')) return true

    // Check for webdriver flag (set by automation)
    if ((navigator as { webdriver?: boolean }).webdriver) return true
  } catch {
    // Ignore errors (e.g., in SSR)
  }

  return false
}

export function getAppMode(): AppMode {
  // Check if mock auth is explicitly enabled
  const mockAuth = import.meta.env.VITE_MOCK_AUTH === 'true'

  if (mockAuth) {
    return 'local'
  }

  // Check if Supabase credentials are configured
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  if (!supabaseUrl || supabaseUrl === 'mock' || supabaseUrl === '') {
    return 'local'
  }

  // Production mode requires both URL and anon key
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseAnonKey || supabaseAnonKey === 'mock') {
    return 'local'
  }

  return 'production'
}

export function getConfig(): AppConfig {
  const mode = getAppMode()

  return {
    mode,
    isLocal: mode === 'local',
    isProduction: mode === 'production',

    // Sync settings (only relevant in production)
    syncInterval: 30000, // 30 seconds
    syncOnStartup: true,
    syncOnOnline: true,

    // Auth settings
    enableMockAuth: mode === 'local',
    enableSupabaseAuth: mode === 'production',

    // Supabase settings
    supabaseUrl:
      mode === 'production' ? import.meta.env.VITE_SUPABASE_URL : undefined,
    supabaseAnonKey:
      mode === 'production'
        ? import.meta.env.VITE_SUPABASE_ANON_KEY
        : undefined,
  }
}

export const config = getConfig()

// Log mode on initialization (only in development - production uses logger)
if (typeof window !== 'undefined') {
  // Import logger dynamically to avoid circular dependencies
  import('../utils/logger').then(({ logger }) => {
    logger.info(`🚀 Rock On running in ${config.mode} mode`)
    if (config.isLocal) {
      logger.info('📦 Using local-only mode (Dexie + Mock Auth)')
    } else {
      logger.info('☁️  Using production mode (Dexie + Supabase sync)')
    }
  })
}
