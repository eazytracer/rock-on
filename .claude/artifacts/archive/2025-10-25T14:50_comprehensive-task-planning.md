---
timestamp: 2025-10-25T14:50
prompt: Create comprehensive task planning for all unplanned phases in TASK-INDEX.md, ensuring no task is left without a clear plan or dependency note
---

# Comprehensive Task Planning - Rock On Supabase Sync

This document provides detailed planning for all remaining tasks (phases 2-10) to complete the Supabase offline sync implementation.

## Status Overview

**Completed (Phase 1)**:
- ✅ Environment Setup (Task 01)
- ✅ Repository Pattern Core (Task 30)
- ✅ Repository implementations for Bands, Setlists, Sessions (Tasks 31-33, 35)
- ✅ Sync Engine Core (Task 40)
- ✅ SyncRepository (Task 41)
- ✅ Conflict Resolution (Task 42)
- ✅ Sync Metadata & Error Recovery (Tasks 43, 46)
- **73 tests passing** for core infrastructure

**Remaining**: Phases 2-10 (62 tasks)

---

# Phase 2: Supabase Infrastructure (Tasks 11-14)

## Task 11: Supabase Database Seeding
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Task 10 (Schema deployed)

### Objective
Create seed data scripts for development and testing environments.

### Implementation Steps
1. **Create seed script structure**
   ```
   supabase/
   ├── seeds/
   │   ├── 01_test_users.sql
   │   ├── 02_sample_bands.sql
   │   ├── 03_sample_songs.sql
   │   └── 04_sample_setlists.sql
   ```

2. **Test User Accounts** (`01_test_users.sql`)
   - Create 3-5 test user accounts
   - Assign proper auth credentials
   - Link to `users` table profiles

3. **Sample Bands** (`02_sample_bands.sql`)
   - Create 2-3 sample bands
   - Add band memberships for test users
   - Include various roles (admin, member, viewer)

4. **Sample Songs** (`03_sample_songs.sql`)
   - 20-30 sample songs across different genres
   - Varied metadata (keys, tempos, ratings)
   - Assigned to different bands/contexts

5. **Sample Setlists** (`04_sample_setlists.sql`)
   - 5-10 setlists with songs
   - Practice sessions linked to bands
   - Casting assignments

### Validation
```bash
# Apply seeds to local Supabase
supabase db seed

# Verify in psql
psql $DATABASE_URL -c "SELECT COUNT(*) FROM songs;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bands;"
```

### Files Created
- `supabase/seeds/01_test_users.sql`
- `supabase/seeds/02_sample_bands.sql`
- `supabase/seeds/03_sample_songs.sql`
- `supabase/seeds/04_sample_setlists.sql`

---

## Task 12: Supabase Project Setup
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Task 10 (Schema complete)

### Objective
Set up Supabase project (local + production) and deploy schema.

### Implementation Steps

1. **Local Supabase Setup**
   ```bash
   # Initialize Supabase (if not already)
   supabase init

   # Link to project (or create new)
   supabase link --project-ref your-project-ref

   # Start local instance
   supabase start
   ```

2. **Apply Schema Migrations**
   ```bash
   # Create migration from schema design (Task 10)
   supabase migration new initial_schema

   # Copy SQL from 10-supabase-schema-design.md into migration
   # Apply migration
   supabase db push
   ```

3. **Configure Environment Variables**
   - Update `.env.local` with local Supabase URLs
   - Update `.env.production` with production URLs
   - Document in `.env.*.example` files

4. **Verify Setup**
   ```bash
   # Check tables exist
   supabase db diff

   # Run seed data (Task 11)
   supabase db seed
   ```

### Configuration
```bash
# .env.local (for development)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# .env.production (for deployment)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

### Files Modified
- `.env.local`
- `.env.production`
- `supabase/migrations/initial_schema.sql`

---

## Task 13: RLS Policy Testing
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Tasks 10, 12 (Schema deployed)

### Objective
Test Row Level Security policies to ensure proper data isolation and access control.

### Implementation Steps

1. **Create RLS Test Suite** (`tests/integration/rls-policies.test.ts`)
   ```typescript
   import { createClient } from '@supabase/supabase-js'

   describe('RLS Policies', () => {
     describe('Songs Table', () => {
       it('should allow user to read their own songs', async () => {
         // Test user can read songs in their bands
       })

       it('should prevent reading songs from other bands', async () => {
         // Test isolation between bands
       })

       it('should allow band admin to update songs', async () => {
         // Test role-based permissions
       })
     })
   })
   ```

2. **Test Scenarios**
   - **User Isolation**: Users can only see their data
   - **Band Context**: Band members see band-specific data
   - **Role-based Access**: Admins have write access, viewers read-only
   - **Public vs Private**: Public setlists accessible, private hidden

3. **Test Each Entity Type**
   - Songs (user/band context)
   - Bands (membership-based access)
   - Setlists (public/private visibility)
   - Practice Sessions (band member access)
   - Casting (band member access)

### Validation
```bash
npm test -- tests/integration/rls-policies.test.ts
```

### Files Created
- `tests/integration/rls-policies.test.ts`
- `tests/integration/supabase-helpers.ts` (test utilities)

---

## Task 14: Supabase Functions (Optional)
**Priority**: Low
**Estimated Time**: 4-6 hours
**Dependencies**: Tasks 10, 12

### Objective
Implement serverless functions for complex operations (batch operations, analytics, etc.)

### Scope
**Optional - Defer until needed**. Current client-side logic is sufficient for MVP.

Potential future functions:
- Batch song operations
- Setlist analytics
- Practice session statistics
- Conflict resolution server-side logic

### Decision
Mark as **deferred** until performance issues or complexity warrant server-side functions.

---

# Phase 3: Authentication System (Tasks 20-29)

## Task 20: Dual-Mode Auth System
**Priority**: Critical
**Estimated Time**: 4-6 hours
**Dependencies**: Task 01 (appMode), Task 21 (Supabase Auth)

### Objective
Implement authentication that works in both local-only mode (MockAuth) and production mode (Supabase Auth).

### Implementation Steps

1. **Create Auth Interface** (`src/services/auth/IAuthService.ts`)
   ```typescript
   export interface IAuthService {
     signIn(email: string, password: string): Promise<AuthResult>
     signOut(): Promise<void>
     signUp(email: string, password: string, metadata?: UserMetadata): Promise<AuthResult>
     signInWithOAuth(provider: 'google' | 'github'): Promise<AuthResult>
     getCurrentUser(): Promise<User | null>
     onAuthStateChange(callback: (user: User | null) => void): UnsubscribeFn
     resetPassword(email: string): Promise<void>
   }

   export interface AuthResult {
     user: User | null
     session: Session | null
     error: AuthError | null
   }
   ```

2. **Enhance MockAuthService** (`src/services/auth/MockAuthService.ts`)
   - Implement full `IAuthService` interface
   - Add in-memory user storage
   - Simulate async auth operations
   - Support auth state changes

3. **Auth Factory** (`src/services/auth/AuthFactory.ts`)
   ```typescript
   import { config } from '@/config/appMode'
   import { MockAuthService } from './MockAuthService'
   import { SupabaseAuthService } from './SupabaseAuthService'

   export function createAuthService(): IAuthService {
     if (config.isLocal) {
       return new MockAuthService()
     }
     return new SupabaseAuthService()
   }

   export const authService = createAuthService()
   ```

4. **Update AuthContext** (`src/contexts/AuthContext.tsx`)
   - Use `authService` from factory
   - Remove direct Supabase dependency
   - Work seamlessly in both modes

### Validation
```bash
npm test -- tests/unit/services/auth/AuthFactory.test.ts
npm test -- tests/unit/services/auth/MockAuthService.test.ts
```

### Files Created
- `src/services/auth/IAuthService.ts`
- `src/services/auth/AuthFactory.ts`
- `tests/unit/services/auth/AuthFactory.test.ts`

### Files Modified
- `src/services/auth/MockAuthService.ts` (enhance)
- `src/contexts/AuthContext.tsx` (use factory)

---

## Task 21: Supabase Auth Service
**Priority**: Critical
**Estimated Time**: 3-4 hours
**Dependencies**: Task 20 (IAuthService interface), Task 12 (Supabase setup)

### Objective
Implement `IAuthService` using Supabase Auth SDK.

### Implementation Steps

1. **Create SupabaseAuthService** (`src/services/auth/SupabaseAuthService.ts`)
   ```typescript
   import { supabase } from '@/services/supabase/client'
   import type { IAuthService } from './IAuthService'

   export class SupabaseAuthService implements IAuthService {
     async signIn(email: string, password: string): Promise<AuthResult> {
       const { data, error } = await supabase.auth.signInWithPassword({
         email,
         password,
       })
       return { user: data.user, session: data.session, error }
     }

     async signInWithOAuth(provider: 'google' | 'github'): Promise<AuthResult> {
       const { data, error } = await supabase.auth.signInWithOAuth({
         provider,
         options: {
           redirectTo: `${window.location.origin}/auth/callback`
         }
       })
       // Handle OAuth flow
     }

     // ... implement other methods
   }
   ```

2. **OAuth Callback Handler** (`src/pages/AuthCallback.tsx`)
   - Handle OAuth redirect
   - Extract session from URL
   - Redirect to app

3. **Error Handling**
   - Map Supabase errors to app-specific errors
   - Handle network failures gracefully
   - Provide user-friendly error messages

### Validation
```bash
npm test -- tests/unit/services/auth/SupabaseAuthService.test.ts
```

### Files Created
- `src/services/auth/SupabaseAuthService.ts`
- `src/pages/AuthCallback.tsx`
- `tests/unit/services/auth/SupabaseAuthService.test.ts`

---

## Task 22: Google OAuth Setup
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Task 21 (SupabaseAuthService)

### Objective
Configure Google OAuth provider in Supabase and implement sign-in flow.

### Implementation Steps

1. **Supabase Dashboard Configuration**
   - Enable Google provider in Authentication settings
   - Add OAuth client ID and secret from Google Cloud Console
   - Configure redirect URLs

2. **Google Cloud Console Setup**
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `https://your-project.supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (dev)

3. **Implement UI Button**
   ```tsx
   // src/components/auth/GoogleSignInButton.tsx
   export function GoogleSignInButton() {
     const handleSignIn = async () => {
       await authService.signInWithOAuth('google')
     }

     return (
       <button onClick={handleSignIn} className="...">
         <GoogleIcon /> Sign in with Google
       </button>
     )
   }
   ```

4. **Test OAuth Flow**
   - Click button → redirect to Google
   - Authorize → redirect back to app
   - User logged in with Google profile

### Validation
- Manual testing of OAuth flow
- Verify user profile data synced

### Files Created
- `src/components/auth/GoogleSignInButton.tsx`
- Documentation in `docs/oauth-setup.md`

---

## Tasks 23-29: Additional Auth Features

### Task 23: Auth Factory Pattern
**Status**: ✅ Covered in Task 20

### Task 24: Session Management
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Task 21

**Details needed after Task 21 implementation**. Will include:
- Session persistence (localStorage/sessionStorage)
- Token refresh logic
- Session expiration handling
- Multi-tab synchronization

### Task 25: Auth Context Updates
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Task 20, 21

**Details needed after Tasks 20-21 implementation**. Will include:
- Integrate auth factory
- Add loading states
- Error boundary for auth failures
- User profile management

### Task 26: Protected Routes
**Priority**: Medium
**Estimated Time**: 1-2 hours
**Dependencies**: Task 25

**Details needed after Task 25 implementation**. Will include:
- `<ProtectedRoute>` wrapper component
- Redirect to login if unauthenticated
- Role-based route protection

### Tasks 27-29: Reserved for Future Auth Features
**Status**: Not yet scoped
**Examples**: Email verification, password reset flows, multi-factor auth

---

# Phase 4: Repository Pattern Completion (Tasks 34, 36, 38)

## Task 34: RemoteRepository - Casting
**Priority**: High
**Estimated Time**: 3-4 hours
**Dependencies**: Task 31 (RemoteRepository pattern established)

### Objective
Implement Casting entity operations in RemoteRepository.

### Implementation Steps

1. **Update RemoteRepository** (`src/services/data/RemoteRepository.ts`)
   ```typescript
   async getCasting(filter?: CastingFilter): Promise<Casting[]> {
     let query = this.supabase.from('casting').select('*')

     if (filter?.practiceSessionId) {
       query = query.eq('practice_session_id', filter.practiceSessionId)
     }
     if (filter?.bandId) {
       query = query.eq('band_id', filter.bandId)
     }

     const { data, error } = await query
     if (error) throw new SupabaseError(error)

     return data.map(mapCastingFromSupabase)
   }

   async addCasting(casting: CastingInsert): Promise<Casting> {
     const supabaseData = mapCastingToSupabase(casting)
     const { data, error } = await this.supabase
       .from('casting')
       .insert(supabaseData)
       .select()
       .single()

     if (error) throw new SupabaseError(error)
     return mapCastingFromSupabase(data)
   }

   // updateCasting, deleteCasting...
   ```

2. **Field Mapping** (add to existing utilities)
   ```typescript
   export function mapCastingFromSupabase(data: SupabaseCasting): Casting {
     return {
       id: data.id,
       practiceSessionId: data.practice_session_id,
       songId: data.song_id,
       bandId: data.band_id,
       assignments: data.assignments, // JSONB
       notes: data.notes,
       createdAt: data.created_at,
       updatedAt: data.updated_at,
     }
   }
   ```

3. **Add Tests** (`tests/unit/services/data/RemoteRepository.test.ts`)
   - CRUD operations for Casting
   - Filtering by practice session
   - Filtering by band

### Validation
```bash
npm test -- tests/unit/services/data/RemoteRepository.test.ts
```

### Files Modified
- `src/services/data/RemoteRepository.ts`
- `tests/unit/services/data/RemoteRepository.test.ts`

---

## Task 36: Repository Factory
**Priority**: High
**Estimated Time**: 1-2 hours
**Dependencies**: Task 30 (Repository pattern established)

### Objective
Create factory for instantiating appropriate repository based on app mode.

### Implementation Steps

1. **Create Factory** (`src/services/data/RepositoryFactory.ts`)
   ```typescript
   import { config } from '@/config/appMode'
   import { LocalRepository } from './LocalRepository'
   import { SyncRepository } from './SyncRepository'
   import type { IDataRepository } from './IDataRepository'

   export function createRepository(): IDataRepository {
     // Always use SyncRepository - it handles both local and remote
     return SyncRepository.getInstance()
   }

   export const repository = createRepository()
   ```

2. **Update Service Files**
   - Replace direct imports with factory
   - Ensures consistent repository usage across app

3. **Add Tests**
   ```typescript
   describe('RepositoryFactory', () => {
     it('should return SyncRepository instance', () => {
       const repo = createRepository()
       expect(repo).toBeInstanceOf(SyncRepository)
     })
   })
   ```

### Validation
```bash
npm test -- tests/unit/services/data/RepositoryFactory.test.ts
```

### Files Created
- `src/services/data/RepositoryFactory.ts`
- `tests/unit/services/data/RepositoryFactory.test.ts`

---

## Task 38: Repository Caching (Optional)
**Priority**: Low
**Estimated Time**: 4-6 hours
**Dependencies**: Task 30

### Scope
**Optional - Defer until needed**. Current SyncRepository with LocalRepository provides effective caching via IndexedDB.

Potential future enhancements:
- In-memory LRU cache for frequently accessed data
- Query result caching
- Cache invalidation strategies

### Decision
Mark as **deferred** until performance profiling indicates need.

---

# Phase 5: Sync Engine Completion (Tasks 44-45, 47)

## Task 44: Pull Sync Implementation
**Priority**: High
**Estimated Time**: 4-6 hours
**Dependencies**: Task 40 (Sync Engine core)

### Objective
Implement pull synchronization to fetch changes from Supabase to local storage.

### Implementation Steps

1. **Add Pull Sync to SyncEngine** (`src/services/data/SyncEngine.ts`)
   ```typescript
   async pullSync(entityType: EntityType): Promise<PullSyncResult> {
     try {
       // Get last sync timestamp for entity type
       const lastSync = await this.getLastSyncTimestamp(entityType)

       // Fetch changes since lastSync from remote
       const changes = await this.remoteRepository.getChangesSince(
         entityType,
         lastSync
       )

       // Apply changes to local repository
       for (const change of changes) {
         await this.localRepository.upsert(entityType, change)
       }

       // Update sync timestamp
       await this.setLastSyncTimestamp(entityType, new Date())

       return {
         success: true,
         changesApplied: changes.length,
         entityType,
       }
     } catch (error) {
       this.logger.error(`Pull sync failed for ${entityType}:`, error)
       return {
         success: false,
         error: error as Error,
         entityType,
       }
     }
   }

   async syncAll(): Promise<SyncResult> {
     // Push local changes first
     await this.pushSync('songs')
     await this.pushSync('bands')
     // ... other entities

     // Then pull remote changes
     await this.pullSync('songs')
     await this.pullSync('bands')
     // ... other entities

     return { success: true }
   }
   ```

2. **Add Timestamp Tracking** (in SyncRepository or metadata table)
   ```typescript
   // Store last sync time per entity type
   private async getLastSyncTimestamp(entityType: EntityType): Promise<Date> {
     const metadata = await this.db.syncMetadata
       .where('entityType')
       .equals(entityType)
       .first()

     return metadata?.lastSyncedAt || new Date(0) // Epoch if never synced
   }
   ```

3. **Add Remote Changes Query**
   - RemoteRepository needs `getChangesSince(entityType, since)` method
   - Use Supabase `updated_at` column to filter

4. **Handle Conflicts**
   - If local has unsyncedchanges and remote has newer data
   - Use existing conflict resolution (Task 42)

### Validation
```bash
npm test -- tests/unit/services/data/SyncEngine.test.ts
```

### Files Modified
- `src/services/data/SyncEngine.ts`
- `src/services/data/RemoteRepository.ts` (add `getChangesSince`)
- `tests/unit/services/data/SyncEngine.test.ts`

---

## Task 45: Delta Sync Optimization
**Priority**: Medium
**Estimated Time**: 4-6 hours
**Dependencies**: Task 44 (Pull sync)

### Objective
Optimize sync to only transfer changed fields (deltas) instead of full entities.

**Details needed after Task 44 implementation**. Will include:
- Field-level change tracking
- Delta computation algorithm
- Bandwidth optimization measurements
- Decision on client vs server-side delta calculation

### Decision
Evaluate performance of full-entity sync first. If bandwidth/latency is acceptable, defer delta sync optimization.

---

## Task 47: Sync Analytics/Logging
**Priority**: Low
**Estimated Time**: 2-3 hours
**Dependencies**: Task 40

### Objective
Add detailed logging and analytics for sync operations.

**Details needed after production deployment**. Will include:
- Sync duration metrics
- Success/failure rates
- Conflict frequency
- Data volume per sync
- Integration with monitoring tools (e.g., Sentry, LogRocket)

### Decision
Mark as **deferred** until production deployment and monitoring needs are clear.

---

# Phase 6: Service Migration (Tasks 50-59)

**Critical Phase**: Migrate existing services to use new Repository + Sync architecture.

## Task 50: Migration Strategy
**Priority**: Critical
**Estimated Time**: 2-3 hours
**Dependencies**: Tasks 30, 40, 41 (Infrastructure complete)

### Objective
Define strategy and plan for migrating existing services to use SyncRepository.

### Implementation Steps

1. **Analyze Current Services**
   - `SongService`: Reads/writes songs from Dexie directly
   - `BandService`: Band management
   - `SetlistService`: Setlist operations
   - `PracticeSessionService`: Session management
   - `BandMembershipService`: Membership CRUD
   - `CastingService`: Casting assignments

2. **Define Migration Pattern**
   ```typescript
   // BEFORE (old pattern)
   class SongService {
     async getSongs(): Promise<Song[]> {
       return await db.songs.toArray()
     }

     async addSong(song: Song): Promise<string> {
       return await db.songs.add(song)
     }
   }

   // AFTER (new pattern)
   import { repository } from '@/services/data/RepositoryFactory'

   class SongService {
     async getSongs(): Promise<Song[]> {
       // repository is SyncRepository - handles local + sync
       return await repository.getSongs()
     }

     async addSong(song: Song): Promise<string> {
       const result = await repository.addSong(song)
       return result.id
     }
   }
   ```

3. **Migration Checklist** (for each service)
   - [ ] Replace direct Dexie calls with `repository` calls
   - [ ] Remove Dexie database imports
   - [ ] Update method signatures to match IDataRepository
   - [ ] Add error handling for sync failures
   - [ ] Update tests to mock repository instead of Dexie
   - [ ] Verify UI still works

4. **Create Migration Order** (by dependency)
   1. SongService (no dependencies)
   2. BandService (no dependencies)
   3. SetlistService (depends on Songs)
   4. PracticeSessionService (depends on Songs, Bands)
   5. BandMembershipService (depends on Bands)
   6. CastingService (depends on Sessions, Songs)
   7. SongGroupService (depends on Songs)

### Artifacts
- `docs/service-migration-plan.md` (detailed migration plan)
- Migration checklist per service

---

## Task 51: SongService Migration
**Priority**: Critical
**Estimated Time**: 3-4 hours
**Dependencies**: Task 50 (Migration strategy)

### Implementation Steps

1. **Update SongService** (`src/services/SongService.ts`)
   ```typescript
   import { repository } from '@/services/data/RepositoryFactory'

   export class SongService {
     async getSongs(filter?: SongFilter): Promise<Song[]> {
       return await repository.getSongs(filter)
     }

     async getSong(id: string): Promise<Song | undefined> {
       const songs = await repository.getSongs({ id })
       return songs[0]
     }

     async addSong(song: SongInsert): Promise<Song> {
       return await repository.addSong(song)
     }

     async updateSong(id: string, updates: SongUpdate): Promise<Song> {
       return await repository.updateSong(id, updates)
     }

     async deleteSong(id: string): Promise<void> {
       await repository.deleteSong(id)
     }

     // Remove all direct db.songs.* calls
   }
   ```

2. **Update Tests** (`tests/unit/services/SongService.test.ts`)
   ```typescript
   import { vi } from 'vitest'
   import * as RepositoryFactory from '@/services/data/RepositoryFactory'

   describe('SongService', () => {
     let mockRepository: MockRepository

     beforeEach(() => {
       mockRepository = createMockRepository()
       vi.spyOn(RepositoryFactory, 'createRepository')
         .mockReturnValue(mockRepository)
     })

     it('should get songs via repository', async () => {
       mockRepository.getSongs.mockResolvedValue([mockSong])
       const songs = await songService.getSongs()
       expect(songs).toEqual([mockSong])
     })
   })
   ```

3. **Manual Testing**
   - Open Songs page
   - Verify songs load
   - Add new song → see it appear
   - Update song → see changes
   - Delete song → verify removed

### Validation
```bash
npm test -- tests/unit/services/SongService.test.ts
npm run dev # Manual UI testing
```

### Files Modified
- `src/services/SongService.ts`
- `tests/unit/services/SongService.test.ts`

---

## Tasks 52-57: Remaining Service Migrations

All follow same pattern as Task 51. Each task:
1. Replace Dexie calls with `repository` calls
2. Update tests to mock repository
3. Manual UI testing

### Task 52: BandService Migration
**Priority**: Critical
**Estimated Time**: 2-3 hours
**Dependencies**: Task 50

**Details**: Straightforward migration, follows SongService pattern.

### Task 53: SetlistService Migration
**Priority**: Critical
**Estimated Time**: 2-3 hours
**Dependencies**: Task 51 (Songs migrated)

**Details**: Depends on SongService being migrated first for relational queries.

### Task 54: PracticeSessionService Migration
**Priority**: Critical
**Estimated Time**: 3-4 hours
**Dependencies**: Tasks 51, 52

**Details**: More complex, involves Songs + Bands relationships.

### Task 55: BandMembershipService Migration
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Task 52

### Task 56: CastingService Migration
**Priority**: High
**Estimated Time**: 3-4 hours
**Dependencies**: Tasks 51, 54

### Task 57: SongGroupService Migration
**Priority**: Medium
**Estimated Time**: 2-3 hours
**Dependencies**: Task 51

---

## Task 58: Service Testing
**Priority**: High
**Estimated Time**: 4-6 hours
**Dependencies**: Tasks 51-57 (All services migrated)

### Objective
Comprehensive integration testing of all migrated services.

### Implementation Steps

1. **Create Integration Test Suite** (`tests/integration/services.test.ts`)
   ```typescript
   describe('Service Integration Tests', () => {
     describe('Song → Setlist Flow', () => {
       it('should add song and include in setlist', async () => {
         // Add song
         const song = await songService.addSong(mockSong)

         // Create setlist with song
         const setlist = await setlistService.addSetlist({
           name: 'Test Setlist',
           songIds: [song.id],
         })

         // Verify song in setlist
         const fetchedSetlist = await setlistService.getSetlist(setlist.id)
         expect(fetchedSetlist.songs).toContainEqual(song)
       })
     })

     describe('Band → Practice Session → Casting Flow', () => {
       // Test full workflow
     })
   })
   ```

2. **Test Scenarios**
   - Cross-service data consistency
   - Cascade deletes (e.g., delete band → remove memberships)
   - Sync behavior across services
   - Offline → online transitions

3. **Performance Testing**
   - Load 1000 songs → measure query time
   - Sync 100 changes → measure duration
   - Acceptable thresholds: <100ms reads, <500ms writes

### Validation
```bash
npm test -- tests/integration/services.test.ts
```

### Files Created
- `tests/integration/services.test.ts`
- Performance benchmark report

---

# Phase 7: UI/UX Integration (Tasks 60-69)

## Task 60: Sync Status Hook
**Priority**: Critical
**Estimated Time**: 2-3 hours
**Dependencies**: Task 40 (Sync Engine)

### Objective
Create React hook for accessing real-time sync status.

### Implementation Steps

1. **Create Hook** (`src/hooks/useSyncStatus.ts`)
   ```typescript
   import { useState, useEffect } from 'react'
   import { SyncRepository } from '@/services/data/SyncRepository'

   export function useSyncStatus() {
     const [status, setStatus] = useState<SyncStatus>({
       isSyncing: false,
       lastSyncedAt: null,
       pendingChanges: 0,
       isOnline: navigator.onLine,
       error: null,
     })

     useEffect(() => {
       const repo = SyncRepository.getInstance()

       // Subscribe to sync events
       const unsubscribe = repo.onSyncStatusChange((newStatus) => {
         setStatus(newStatus)
       })

       // Listen for online/offline events
       const handleOnline = () => setStatus(s => ({ ...s, isOnline: true }))
       const handleOffline = () => setStatus(s => ({ ...s, isOnline: false }))

       window.addEventListener('online', handleOnline)
       window.addEventListener('offline', handleOffline)

       return () => {
         unsubscribe()
         window.removeEventListener('online', handleOnline)
         window.removeEventListener('offline', handleOffline)
       }
     }, [])

     const manualSync = async () => {
       const repo = SyncRepository.getInstance()
       await repo.syncAll()
     }

     return { ...status, sync: manualSync }
   }
   ```

2. **Add Event Emitter to SyncRepository**
   ```typescript
   class SyncRepository {
     private syncStatusCallbacks: Set<(status: SyncStatus) => void> = new Set()

     onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
       this.syncStatusCallbacks.add(callback)
       return () => this.syncStatusCallbacks.delete(callback)
     }

     private emitSyncStatusChange(status: SyncStatus) {
       this.syncStatusCallbacks.forEach(cb => cb(status))
     }
   }
   ```

3. **Add Tests**
   ```typescript
   describe('useSyncStatus', () => {
     it('should return current sync status', () => {
       const { result } = renderHook(() => useSyncStatus())
       expect(result.current.isSyncing).toBe(false)
       expect(result.current.isOnline).toBe(true)
     })
   })
   ```

### Validation
```bash
npm test -- tests/unit/hooks/useSyncStatus.test.ts
```

### Files Created
- `src/hooks/useSyncStatus.ts`
- `tests/unit/hooks/useSyncStatus.test.ts`

### Files Modified
- `src/services/data/SyncRepository.ts` (add event emitter)

---

## Task 61: SyncStatusIndicator Component
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Task 60 (useSyncStatus hook)

### Objective
Create UI component to display sync status to users.

### Implementation Steps

1. **Create Component** (`src/components/sync/SyncStatusIndicator.tsx`)
   ```tsx
   import { useSyncStatus } from '@/hooks/useSyncStatus'

   export function SyncStatusIndicator() {
     const { isSyncing, lastSyncedAt, pendingChanges, isOnline, error } = useSyncStatus()

     return (
       <div className="flex items-center gap-2 text-sm">
         {/* Online/Offline Indicator */}
         <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />

         {/* Sync Status */}
         {isSyncing && (
           <span className="text-gray-600">
             <LoadingSpinner size="sm" /> Syncing...
           </span>
         )}

         {!isSyncing && pendingChanges > 0 && (
           <span className="text-yellow-600">
             {pendingChanges} changes pending
           </span>
         )}

         {!isSyncing && pendingChanges === 0 && lastSyncedAt && (
           <span className="text-gray-500">
             Synced {formatRelativeTime(lastSyncedAt)}
           </span>
         )}

         {error && (
           <span className="text-red-600">
             Sync error: {error.message}
           </span>
         )}
       </div>
     )
   }
   ```

2. **Add to Layout**
   - Include in header/nav bar
   - Visible on all pages
   - Subtle but informative

3. **Add Tests**
   ```tsx
   describe('SyncStatusIndicator', () => {
     it('should show online status', () => {
       render(<SyncStatusIndicator />)
       expect(screen.getByText(/synced/i)).toBeInTheDocument()
     })
   })
   ```

### Validation
```bash
npm test -- tests/unit/components/sync/SyncStatusIndicator.test.tsx
npm run dev # Visual testing
```

### Files Created
- `src/components/sync/SyncStatusIndicator.tsx`
- `tests/unit/components/sync/SyncStatusIndicator.test.tsx`

---

## Tasks 62-67: Additional UI Components

### Task 62: Offline Indicator
**Priority**: High
**Estimated Time**: 1-2 hours
**Dependencies**: Task 60

**Details**: Simple banner at top when offline. "You're offline. Changes will sync when online."

### Task 63: Optimistic UI Patterns
**Priority**: High
**Estimated Time**: 3-4 hours
**Dependencies**: Task 41 (SyncRepository with optimistic writes)

**Details needed after UI testing**. Will include:
- Loading states for async operations
- Optimistic UI updates (show change immediately)
- Rollback on failure
- Toast notifications for errors

### Task 64: Sync Error UI
**Priority**: Medium
**Estimated Time**: 2-3 hours
**Dependencies**: Task 61

**Details**: Error modal/toast with:
- Error description
- Retry button
- "View Details" for technical info
- "Dismiss" or "Ignore"

### Task 65: Manual Sync Button
**Priority**: Medium
**Estimated Time**: 1-2 hours
**Dependencies**: Task 60

**Details**: Button in settings or header to trigger manual sync. Shows spinner while syncing.

### Task 66: Sync Settings UI
**Priority**: Low
**Estimated Time**: 2-3 hours
**Dependencies**: Task 65

**Details needed after user feedback**. Settings for:
- Auto-sync frequency
- Sync on Wi-Fi only
- Clear local cache
- View sync logs

### Task 67: Conflict Resolution UI
**Priority**: Low
**Estimated Time**: 4-6 hours
**Dependencies**: Task 42 (Conflict resolution logic)

**Details needed after conflict scenarios are observed in production**. UI for:
- Show conflicting versions side-by-side
- Let user choose which to keep
- Manual merge option

**Decision**: Defer until conflicts are observed in real usage. Current last-write-wins may be sufficient.

---

# Phase 8: Testing (Tasks 70-79)

## Task 70: Unit Testing Strategy
**Priority**: Critical
**Estimated Time**: 2-3 hours
**Dependencies**: None (planning task)

### Objective
Define comprehensive unit testing strategy for the project.

### Implementation Steps

1. **Document Testing Standards** (`docs/testing-strategy.md`)
   - **Coverage Target**: 80% for critical paths (repositories, sync engine, services)
   - **Test Structure**: Arrange-Act-Assert pattern
   - **Mocking Strategy**: Mock external dependencies (Supabase, network)
   - **Test Organization**: Mirror `src/` structure in `tests/unit/`

2. **Testing Patterns**
   ```typescript
   // Pattern 1: Repository Tests
   describe('LocalRepository', () => {
     let db: MockDexie
     let repository: LocalRepository

     beforeEach(async () => {
       db = await createMockDatabase()
       repository = new LocalRepository(db)
     })

     afterEach(async () => {
       await db.delete()
     })

     it('should add song to database', async () => {
       const song = await repository.addSong(mockSong)
       expect(song.id).toBeDefined()

       const fetched = await repository.getSongs()
       expect(fetched).toContainEqual(song)
     })
   })

   // Pattern 2: Service Tests (with mocked repository)
   describe('SongService', () => {
     let mockRepository: MockRepository
     let service: SongService

     beforeEach(() => {
       mockRepository = createMockRepository()
       vi.spyOn(RepositoryFactory, 'createRepository')
         .mockReturnValue(mockRepository)
       service = new SongService()
     })

     it('should get songs from repository', async () => {
       mockRepository.getSongs.mockResolvedValue([mockSong])
       const songs = await service.getSongs()
       expect(mockRepository.getSongs).toHaveBeenCalled()
       expect(songs).toEqual([mockSong])
     })
   })
   ```

3. **Test Utilities** (`tests/unit/test-utils.ts`)
   - Mock data factories (createMockSong, createMockBand, etc.)
   - Mock repository implementation
   - Database reset utilities
   - Async test helpers

### Artifacts
- `docs/testing-strategy.md`
- `tests/unit/test-utils.ts`
- Updated test templates

---

## Task 71: Repository Unit Tests
**Priority**: Critical
**Estimated Time**: 4-6 hours
**Dependencies**: Tasks 30-35 (Repositories implemented)

### Objective
Ensure comprehensive unit test coverage for all repository implementations.

**Status**: ✅ **Already Complete!**
- LocalRepository: 17 tests ✅
- RemoteRepository: 13 tests ✅
- SyncRepository: 27 tests ✅

**Remaining**: Add tests for Casting entity (Task 34)

### Additional Tests Needed
- Casting CRUD in RemoteRepository (after Task 34)
- Casting sync in SyncRepository (after Task 34)

---

## Task 72: Sync Engine Unit Tests
**Priority**: Critical
**Estimated Time**: 4-6 hours
**Dependencies**: Tasks 40-46 (Sync Engine implemented)

### Objective
Comprehensive unit tests for sync engine.

**Status**: ✅ **Already Complete!**
- SyncEngine: 11 tests ✅

**Remaining**: Add tests for pull sync (Task 44) when implemented.

---

## Task 73: Service Integration Tests
**Priority**: High
**Estimated Time**: 4-6 hours
**Dependencies**: Tasks 51-57 (Services migrated)

**See Task 58** - Covered in Service Testing task.

---

## Task 74: Offline Sync E2E Tests
**Priority**: High
**Estimated Time**: 4-6 hours
**Dependencies**: Tasks 40, 41 (Sync complete), Task 12 (Supabase setup)

### Objective
End-to-end tests simulating offline → online sync scenarios.

### Implementation Steps

1. **Create E2E Test Suite** (`tests/e2e/offline-sync.test.ts`)
   ```typescript
   import { test, expect } from '@playwright/test'

   test.describe('Offline Sync', () => {
     test('should queue changes while offline and sync when online', async ({ page, context }) => {
       await page.goto('/')
       await page.click('[data-testid="login-button"]')
       // Log in

       // Go offline
       await context.setOffline(true)

       // Add a song while offline
       await page.click('[data-testid="add-song-button"]')
       await page.fill('[name="title"]', 'Offline Song')
       await page.click('[data-testid="save-song"]')

       // Verify song appears locally
       await expect(page.locator('text=Offline Song')).toBeVisible()

       // Go back online
       await context.setOffline(false)

       // Wait for sync
       await page.waitForSelector('[data-testid="sync-complete"]', { timeout: 5000 })

       // Verify song synced to server (check via API or refresh page)
       await page.reload()
       await expect(page.locator('text=Offline Song')).toBeVisible()
     })

     test('should handle conflicts gracefully', async ({ page }) => {
       // Simulate conflict scenario
     })
   })
   ```

2. **Test Scenarios**
   - Add song offline → sync online
   - Update song offline → sync online
   - Delete song offline → sync online
   - Conflict resolution (edit same song on two devices)
   - Network error during sync → retry

3. **Setup Playwright**
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

### Validation
```bash
npm run test:e2e
```

### Files Created
- `tests/e2e/offline-sync.test.ts`
- `playwright.config.ts`

---

## Task 75: Conflict Resolution Tests
**Priority**: High
**Estimated Time**: 3-4 hours
**Dependencies**: Task 42 (Conflict resolution implemented)

### Objective
Test conflict resolution logic in various scenarios.

**Details needed after Task 44 (Pull sync) is implemented**. Will include:
- Same entity updated on two devices
- Delete vs update conflicts
- Last-write-wins verification
- Conflict logs/alerts

---

## Task 76: Auth Flow Tests
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: Tasks 20-22 (Auth implemented)

### Objective
Test authentication flows (sign in, sign out, OAuth, etc.)

**Details needed after Tasks 20-22 are implemented**. Will include:
- Sign in with email/password
- Sign in with Google OAuth
- Sign out
- Session persistence
- Protected route redirects

---

## Task 77: Performance Testing
**Priority**: Medium
**Estimated Time**: 3-4 hours
**Dependencies**: Tasks 51-57 (Services migrated)

### Objective
Benchmark performance of sync operations and identify bottlenecks.

**Details needed after production deployment**. Will include:
- Load time benchmarks
- Sync operation duration
- Query performance with large datasets
- Memory usage profiling

---

## Task 78: Security Testing
**Priority**: Medium
**Estimated Time**: 3-4 hours
**Dependencies**: Task 13 (RLS policies)

### Objective
Validate security measures (RLS policies, auth, data isolation).

**Details needed after Tasks 13, 20-22 are implemented**. Will include:
- RLS policy enforcement tests
- Cross-user data isolation
- SQL injection resistance
- XSS protection

---

# Phase 9: Deployment (Tasks 80-89)

## Task 80: Vercel Setup
**Priority**: Critical
**Estimated Time**: 1-2 hours
**Dependencies**: None

### Implementation Steps

1. **Connect GitHub to Vercel**
   - Import repository in Vercel dashboard
   - Select framework: Vite
   - Configure build settings

2. **Configure Build Settings**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "installCommand": "npm install"
   }
   ```

3. **Set up Environments**
   - Production: main branch
   - Preview: all PRs

### Validation
- Trigger deployment
- Visit preview URL
- Verify app loads

---

## Task 81: Environment Variables
**Priority**: Critical
**Estimated Time**: 1 hour
**Dependencies**: Task 80

### Implementation Steps

1. **Add Environment Variables in Vercel**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_MODE` (optional, defaults to auto-detect)

2. **Create `.env.production.example`**
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. **Document in README**
   - List required environment variables
   - Instructions for setting them up

### Files Created
- `.env.production.example`
- Updated `README.md`

---

## Tasks 82-88: Deployment Workflow

### Task 82: Build Configuration
**Priority**: High
**Estimated Time**: 1-2 hours

**Details**: Verify production build works, optimize bundle size, configure caching.

### Task 83: Deployment Checklist
**Priority**: High
**Estimated Time**: 1 hour

**Details**: Pre-deployment checklist:
- [ ] All tests passing
- [ ] No console errors
- [ ] Environment variables set
- [ ] Supabase schema deployed
- [ ] RLS policies enabled
- [ ] OAuth configured

### Task 84: Staging Deployment
**Priority**: High
**Estimated Time**: 1-2 hours

**Details**: Deploy to staging environment, run smoke tests.

### Task 85: Production Deployment
**Priority**: Critical
**Estimated Time**: 1-2 hours

**Details**: Deploy to production, monitor for errors.

### Task 86: Rollback Plan
**Priority**: High
**Estimated Time**: 1 hour

**Details**: Document rollback procedure, test rollback.

### Task 87: Monitoring Setup
**Priority**: Medium
**Estimated Time**: 2-3 hours

**Details needed after deployment**. Will include:
- Vercel Analytics
- Error tracking (Sentry)
- Performance monitoring

### Task 88: Error Tracking (Sentry)
**Priority**: Medium
**Estimated Time**: 2-3 hours

**Details**: Install Sentry, configure error reporting, test error capture.

---

# Phase 10: Documentation (Tasks 90-99)

## Task 90: Architecture Documentation
**Priority**: High
**Estimated Time**: 3-4 hours
**Dependencies**: All implementation complete

### Artifacts
- `docs/architecture.md`
  - System overview
  - Data flow diagrams
  - Component relationships
  - Sync flow explanation

---

## Task 91: API Documentation
**Priority**: High
**Estimated Time**: 2-3 hours

### Artifacts
- `docs/api/repository-api.md`
- `docs/api/sync-engine-api.md`
- `docs/api/services-api.md`

---

## Tasks 92-96: Additional Documentation

### Task 92: Developer Guide
**Priority**: Medium
**Estimated Time**: 2-3 hours

**Details**: Setup instructions, development workflow, testing guide.

### Task 93: Troubleshooting Guide
**Priority**: Medium
**Estimated Time**: 2-3 hours

**Details**: Common issues, debugging sync problems, FAQ.

### Task 94: Deployment Guide
**Priority**: High
**Estimated Time**: 2-3 hours

**Details**: Step-by-step deployment instructions, environment setup.

### Task 95: User Migration Guide
**Priority**: Low
**Estimated Time**: 1-2 hours

**Details needed after production deployment**. Migration guide for existing users.

### Task 96: README Updates
**Priority**: Medium
**Estimated Time**: 1 hour

**Details**: Update README with new architecture, features, setup instructions.

---

# Summary: Task Dependencies and Order

## Immediate Next Steps (Week 1)
1. ✅ Fix __tests__ references (Complete)
2. **Task 12**: Supabase Project Setup (deploy schema)
3. **Task 11**: Supabase Database Seeding
4. **Task 13**: RLS Policy Testing
5. **Task 20**: Dual-Mode Auth System
6. **Task 21**: Supabase Auth Service

## Week 2: Auth + Service Migration
7. **Task 22**: Google OAuth Setup
8. **Task 24-26**: Session Management, Auth Context, Protected Routes
9. **Task 50**: Service Migration Strategy
10. **Task 51**: Migrate SongService
11. **Task 52**: Migrate BandService

## Week 3: Complete Service Migration + UI
12. **Tasks 53-57**: Migrate remaining services
13. **Task 58**: Service Integration Testing
14. **Task 60**: useSyncStatus Hook
15. **Task 61**: SyncStatusIndicator Component
16. **Task 62**: Offline Indicator

## Week 4: Testing + Deployment
17. **Task 70**: Unit Testing Strategy
18. **Task 74**: Offline Sync E2E Tests
19. **Task 76**: Auth Flow Tests
20. **Task 80-81**: Vercel Setup + Environment Variables
21. **Task 83-85**: Deployment Workflow

## Week 5: Polish + Documentation
22. **Task 44**: Pull Sync Implementation (if needed)
23. **Task 34**: RemoteRepository - Casting (if needed)
24. **Tasks 90-96**: Documentation
25. **Task 87-88**: Monitoring & Error Tracking

---

# Deferred/Optional Tasks

These tasks are marked for future consideration:
- **Task 14**: Supabase Functions (optional server-side logic)
- **Task 38**: Repository Caching (IndexedDB provides sufficient caching)
- **Task 45**: Delta Sync Optimization (optimize after profiling)
- **Task 47**: Sync Analytics/Logging (defer until production)
- **Task 63**: Optimistic UI Patterns (details needed after UI testing)
- **Task 66**: Sync Settings UI (defer until user feedback)
- **Task 67**: Conflict Resolution UI (defer until conflicts observed)
- **Task 77**: Performance Testing (defer until production)
- **Task 78**: Security Testing (partial coverage in Task 13)

---

**Document Complete**: 2025-10-25T14:50
**Total Tasks Planned**: 62 (Phase 1 complete with 73 tests passing)
**Estimated Time to MVP**: 4-5 weeks
**Next Action**: Review with user, begin Task 12 (Supabase Project Setup)
