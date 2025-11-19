# Task 01: Environment Setup and Configuration

## Context

Before implementing the sync architecture, we need to set up environment configuration that supports two modes:
1. **Local Dev Mode**: Uses mock auth and Dexie only (no Supabase required)
2. **Production Mode**: Uses real Supabase auth and sync

## Dependencies

- None (this is the first task)

## Objective

Create environment configuration files and mode detection logic that allows the app to run in either local or production mode.

## Test Requirements (Write These First)

### Test File: `tests/unit/config/appMode.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAppMode, config } from '../appMode'

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
})
```

## Implementation Steps

### Step 1: Create App Mode Configuration

**File**: `src/config/appMode.ts`

```typescript
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
    supabaseUrl: mode === 'production' ? import.meta.env.VITE_SUPABASE_URL : undefined,
    supabaseAnonKey: mode === 'production' ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined
  }
}

export const config = getConfig()

// Log mode on initialization
if (typeof window !== 'undefined') {
  console.log(`🚀 Rock On running in ${config.mode} mode`)
  if (config.isLocal) {
    console.log('📦 Using local-only mode (Dexie + Mock Auth)')
  } else {
    console.log('☁️  Using production mode (Dexie + Supabase sync)')
  }
}
```

### Step 2: Create Environment File Templates

**File**: `.env.local.example`

```bash
# Rock On - Local Development Environment
# Copy this to .env.local for local development

# Set to true to use mock auth and disable Supabase
VITE_MOCK_AUTH=true

# Supabase settings (not needed for local dev when VITE_MOCK_AUTH=true)
VITE_SUPABASE_URL=mock
VITE_SUPABASE_ANON_KEY=mock

# Google OAuth (not needed for local dev)
VITE_GOOGLE_CLIENT_ID=mock
```

**File**: `.env.production.example`

```bash
# Rock On - Production Environment
# Add these to Vercel environment variables

# Set to false to enable real Supabase auth
VITE_MOCK_AUTH=false

# Supabase settings (required for production)
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth (required for production)
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
```

### Step 3: Create Local Development Environment File

**File**: `.env.local`

```bash
# Local development - Mock auth mode
VITE_MOCK_AUTH=true
VITE_SUPABASE_URL=mock
VITE_SUPABASE_ANON_KEY=mock
VITE_GOOGLE_CLIENT_ID=mock
```

### Step 4: Update .gitignore

Ensure environment files are properly ignored:

```bash
# Add to .gitignore if not already present
.env.local
.env.production
.env
```

### Step 5: Update TypeScript for Import.meta.env

**File**: `src/vite-env.d.ts` (create if doesn't exist)

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_AUTH: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

## Acceptance Criteria

- [ ] `src/config/appMode.ts` file created with mode detection logic
- [ ] All environment template files created
- [ ] `.env.local` configured for local development
- [ ] Tests written and passing
- [ ] TypeScript types for environment variables defined
- [ ] Console logs correct mode on app startup
- [ ] No TypeScript errors related to env variables

## Validation Steps

### 1. Run Tests

```bash
npm test tests/unit/config/appMode.test.ts
```

All tests should pass.

### 2. Test Local Mode

```bash
# Ensure .env.local has VITE_MOCK_AUTH=true
npm run dev
```

Check console for: `🚀 Rock On running in local mode`

### 3. Test Production Mode Detection

Temporarily modify `.env.local`:
```bash
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=https://test.supabase.co
VITE_SUPABASE_ANON_KEY=test-key
```

```bash
npm run dev
```

Check console for: `🚀 Rock On running in production mode`

Then revert `.env.local` to local mode.

### 4. Test Type Checking

```bash
npm run type-check
```

Should have no errors.

## Next Steps

After completing this task, proceed to:
- **Task 02**: Supabase project setup
- **Task 03**: Database schema design
