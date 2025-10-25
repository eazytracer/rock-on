---
timestamp: 2025-10-24T00:09
type: Deployment Readiness Assessment
status: COMPREHENSIVE ANALYSIS
original_prompt: Assess codebase for Vercel deployment with Supabase backend, identify gaps in IndexedDB-to-Supabase sync, database setup, and migration strategy
---

# Rock On - Deployment Readiness Report

## Executive Summary

**Current State**: The application is **NOT ready for production deployment** to Vercel with Supabase. Despite having Supabase credentials configured, there is **ZERO integration** between the application and Supabase. The entire application currently runs on client-side IndexedDB with mock authentication.

**Gap Analysis**: Transitioning to a deployed Supabase-backed application requires substantial architectural changes across authentication, data persistence, and sync logic.

**Recommendation**: Plan for **2-3 weeks of development** to properly integrate Supabase, implement authentication, create database schema, and build sync/migration logic.

---

## Part 1: Current State Analysis

### ✅ What's Working (IndexedDB/Local)

1. **Database Schema (IndexedDB)**
   - **Location**: `src/services/database/index.ts`
   - **Technology**: Dexie.js (IndexedDB wrapper)
   - **Current Version**: 5
   - **Tables**: 15 tables fully implemented
     - Core: `bands`, `members`, `songs`, `practiceSessions`, `setlists`
     - Auth: `users`, `userProfiles`, `bandMemberships`, `inviteCodes`
     - Advanced: `songGroups`, `songGroupMemberships`, `songCastings`, `songAssignments`, `assignmentRoles`, `castingTemplates`, `memberCapabilities`
   - **Status**: ✅ Fully functional for local development
   - **Seed Data**: Comprehensive MVP seed data (`src/database/seedMvpData.ts`) with 3 users, 1 band, 17 songs, 4 setlists, 5 shows, 5 practices

2. **Authentication (Mock)**
   - **Service**: `MockAuthService` (`src/services/auth/MockAuthService.ts`)
   - **Storage**: localStorage for sessions
   - **Features**: Email/password signup/signin, 3 hardcoded test users
   - **Status**: ✅ Works for local development
   - **Limitation**: ⚠️ Not suitable for production (no real auth, plain text passwords)

3. **Build Configuration**
   - **Vercel Config**: `vercel.json` exists with basic SPA routing
   - **Build Command**: `npm run build` (TypeScript + Vite)
   - **Output**: `dist/` directory
   - **Status**: ✅ Ready for static deployment

4. **Environment Variables**
   - **File**: `.env.local` (local only, not in git)
   - **Configured**:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_GOOGLE_CLIENT_ID`
     - `VITE_ENABLE_AUTH=true`
     - `VITE_MOCK_AUTH=true`
   - **Status**: ⚠️ Values exist but unused in code

### ❌ What's Missing (Supabase Integration)

1. **No Supabase Client Initialization**
   - **Search Results**: Zero instances of `createClient` from `@supabase/supabase-js`
   - **Package Installed**: `@supabase/supabase-js` v2.76.1 in package.json
   - **Status**: ❌ Dependencies installed but never imported/used

2. **No Supabase Authentication**
   - **Current**: MockAuthService with localStorage sessions
   - **Missing**: Integration with Supabase Auth
   - **Missing**: Google OAuth flow implementation
   - **Missing**: Session refresh with Supabase tokens
   - **Status**: ❌ Complete authentication rewrite needed

3. **No Database Schema (SQL)**
   - **Search Results**: Zero `.sql` files in codebase
   - **Missing**: Supabase table definitions
   - **Missing**: Row Level Security (RLS) policies
   - **Missing**: Database indexes and constraints
   - **Missing**: Foreign key relationships
   - **Status**: ❌ Entire SQL schema must be created from scratch

4. **No Supabase Migrations**
   - **Search Results**: No `supabase/` directory
   - **Missing**: Migration files for schema versioning
   - **Missing**: Seed data scripts for Supabase
   - **Status**: ❌ Migration strategy undefined

5. **No Sync Logic (IndexedDB ↔ Supabase)**
   - **Current Behavior**: All data operations target IndexedDB directly
   - **No Sync Code**: No logic to sync local IndexedDB with remote Supabase
   - **No Offline Support**: No conflict resolution for offline writes
   - **Status**: ❌ Data layer needs complete redesign

6. **No Multi-Environment Setup**
   - **Current**: Single `.env.local` file
   - **Missing**: Separate test/staging/prod Supabase projects
   - **Missing**: Vercel environment variable configuration
   - **Status**: ❌ Environment strategy undefined

---

## Part 2: Critical Questions & Architecture Decisions

### Decision 1: Sync Strategy - Local + Remote OR Remote Only?

**Option A: Remote Only (Recommended)**
- Replace IndexedDB entirely with Supabase Postgres
- Use `@supabase/supabase-js` for all data operations
- Simpler architecture, single source of truth
- **Pros**: Less complexity, easier to maintain, real-time features available
- **Cons**: Requires internet connection, higher latency for reads

**Option B: Local-First with Sync**
- Keep IndexedDB for offline support
- Implement bi-directional sync with Supabase
- Complex conflict resolution needed
- **Pros**: Offline support, instant local reads
- **Cons**: Complex to implement, sync bugs, data conflicts, significantly more development time

**Recommendation**: **Start with Option A (Remote Only)**. Add offline sync in a future phase if truly needed. Most band management use cases require internet for collaboration anyway.

### Decision 2: Database Migration Strategy

**Option A: Manual SQL Scripts**
- Write SQL migrations by hand
- Run via Supabase Dashboard or CLI
- Version control in `supabase/migrations/`

**Option B: Supabase CLI with Type Generation**
- Use `supabase db diff` to auto-generate migrations
- TypeScript types auto-generated from schema
- Version control migrations automatically

**Recommendation**: **Option B (Supabase CLI)**. Better DX, type safety, easier collaboration.

### Decision 3: Authentication Flow

**Current State**: MockAuthService with hardcoded users
**Target State**: Supabase Auth with Google OAuth

**Migration Path**:
1. Replace `MockAuthService` with `SupabaseAuthService` implementing `IAuthService` interface
2. Configure Google OAuth in Supabase Dashboard
3. Update `AuthContext` to use Supabase session management
4. Handle OAuth redirect flow in Vercel deployment
5. Migrate existing mock users to Supabase (manual one-time migration)

---

## Part 3: What Needs to Be Done

### Phase 1: Supabase Database Setup (High Priority)

**Tasks**:

1. **Create Supabase SQL Schema** ⏱️ 2-3 days
   - Map IndexedDB schema to Postgres tables
   - Create tables matching current Dexie schema (15 tables)
   - Define foreign key relationships
   - Add indexes for performance
   - **Files to Create**:
     - `supabase/migrations/20251024000000_initial_schema.sql`
   - **Key Considerations**:
     - UUIDs vs auto-incrementing IDs
     - Timestamp fields (created_date, updated_date)
     - JSONB fields for complex objects (setlist items, song structure)
     - Enum types for status fields

2. **Implement Row Level Security (RLS)** ⏱️ 1-2 days
   - Users can only see their own data
   - Band members can see band data
   - Role-based permissions (admin, member, viewer)
   - **Critical for Security**: Without RLS, any user can access any data
   - **Files to Create**:
     - `supabase/migrations/20251024010000_rls_policies.sql`

3. **Create Database Seed Script** ⏱️ 1 day
   - Port `seedMvpData.ts` to SQL
   - Create test data for dev/staging environments
   - **Files to Create**:
     - `supabase/seed.sql`

4. **Set Up Supabase Project** ⏱️ 1 day
   - Create 3 Supabase projects (dev, staging, prod)
   - Configure API keys and URLs
   - Enable Google OAuth provider
   - Configure email templates
   - Set up database backups

**Blockers**: None - can start immediately

**Output**:
- Working Supabase database with schema matching IndexedDB
- RLS policies protecting user data
- Test data seeded for development

---

### Phase 2: Authentication Integration (High Priority)

**Tasks**:

1. **Create Supabase Auth Service** ⏱️ 2-3 days
   - Replace `MockAuthService` with real Supabase auth
   - Implement `IAuthService` interface for drop-in replacement
   - **Files to Create**:
     - `src/services/auth/SupabaseAuthService.ts`
     - `src/services/auth/supabaseClient.ts` (initialize client)
   - **Key Features**:
     - Email/password signup
     - Google OAuth signin
     - Session management (access token, refresh token)
     - Session persistence
     - Auth state change listeners

2. **Update AuthContext** ⏱️ 1 day
   - Wire up `SupabaseAuthService` instead of `MockAuthService`
   - Handle OAuth redirects from Google
   - Update session refresh logic
   - **Files to Modify**:
     - `src/contexts/AuthContext.tsx`

3. **Configure Google OAuth** ⏱️ 1 day
   - Set up OAuth consent screen in Google Console
   - Add authorized redirect URIs for Vercel domains
   - Configure Supabase with Google credentials
   - Test OAuth flow locally and in deployed environments

4. **Environment Variables Setup** ⏱️ 1 day
   - Configure Vercel environment variables for:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_GOOGLE_CLIENT_ID`
   - Set up separate values for preview/production deployments
   - Remove `VITE_MOCK_AUTH` in production

**Blockers**: Requires Phase 1 (Supabase database) to be complete

**Output**:
- Real authentication working in deployed app
- Google OAuth login functional
- User sessions persist across page refreshes

---

### Phase 3: Data Layer Migration (High Priority)

**Decision Required**: Remote-only OR local-first sync?

**Option A: Remote-Only (Recommended)**

**Tasks**:

1. **Create Supabase Data Services** ⏱️ 3-4 days
   - Replace direct Dexie calls with Supabase queries
   - Update all service files:
     - `src/services/SongService.ts`
     - `src/services/BandService.ts`
     - `src/services/BandMembershipService.ts`
     - `src/services/PracticeSessionService.ts`
     - `src/services/SetlistService.ts`
     - And 5+ more service files
   - Implement using Supabase JS client:
     ```typescript
     // Before (IndexedDB)
     await db.songs.add(song)

     // After (Supabase)
     const { data, error } = await supabase
       .from('songs')
       .insert(song)
       .select()
       .single()
     ```

2. **Update React Components** ⏱️ 2-3 days
   - Replace Dexie hooks with Supabase queries
   - Add loading states for async operations
   - Add error handling for network failures
   - **Files to Modify**: All pages and components that query data
     - `src/pages/NewLayout/SongsPage.tsx`
     - `src/pages/NewLayout/SetlistsPage.tsx`
     - `src/pages/NewLayout/PracticesPage.tsx`
     - `src/pages/NewLayout/ShowsPage.tsx`
     - `src/pages/NewLayout/BandMembersPage.tsx`

3. **Implement Real-Time Updates (Optional)** ⏱️ 1-2 days
   - Subscribe to Supabase real-time changes
   - Update UI when other users modify data
   - Great for collaborative band features

**Option B: Local-First with Sync (Not Recommended for MVP)**

This would require significantly more work:
- Build sync engine (2+ weeks)
- Implement conflict resolution
- Handle offline writes queue
- Test edge cases exhaustively

**Recommendation**: **Postpone local-first sync** until after successful remote-only deployment.

**Blockers**: Requires Phase 1 and Phase 2 complete

**Output**:
- All data operations use Supabase instead of IndexedDB
- Components fetch data from Postgres
- Real-time collaboration features (optional)

---

### Phase 4: Schema Migration Strategy (Medium Priority)

**Problem**: How do we handle schema changes after initial deployment?

**Solution**: Supabase Migrations Workflow

1. **Install Supabase CLI** ⏱️ 30 minutes
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

2. **Set Up Migration Workflow** ⏱️ 1 day
   - Initialize local Supabase: `supabase init`
   - Create migration template: `supabase migration new <name>`
   - Pull remote schema: `supabase db pull`
   - Push migrations: `supabase db push`
   - **Files Created**: `supabase/migrations/*.sql`

3. **Create Migration Process Documentation** ⏱️ 1 day
   - Document how to create new migrations
   - Document how to test migrations locally
   - Document deployment process
   - Add to `CLAUDE.md` for future reference

4. **Automate Type Generation** ⏱️ 1 day
   - Generate TypeScript types from schema: `supabase gen types typescript`
   - Add to build pipeline
   - Update TypeScript interfaces to match generated types

**Blockers**: None - can set up in parallel with Phase 1

**Output**:
- Clear migration workflow documented
- Automated type generation
- Schema versioning under source control

---

### Phase 5: Multi-Environment Setup (Medium Priority)

**Goal**: Separate dev, test/staging, and production environments

**Tasks**:

1. **Create Supabase Projects** ⏱️ 1 hour
   - **Dev**: `rock-on-dev` (for local development)
   - **Staging**: `rock-on-staging` (for PR previews)
   - **Production**: `rock-on-prod` (for main branch)

2. **Configure Vercel Environment Variables** ⏱️ 1 hour
   - Set variables for each environment
   - Use Vercel's preview/production context
   - Ensure credentials are secure (not in git)

3. **Set Up CI/CD** ⏱️ 2 days
   - Auto-run migrations on deployment
   - Run tests before deployment
   - Preview deployments for PRs
   - **Files to Create**:
     - `.github/workflows/deploy.yml` (if using GitHub Actions)
     - Or configure in Vercel dashboard

**Blockers**: Requires Phases 1-3 mostly complete

**Output**:
- 3 isolated environments (dev/staging/prod)
- Safe testing before production release
- Automatic deployments on merge

---

### Phase 6: Data Migration (One-Time Task)

**Problem**: How to migrate existing local IndexedDB data to Supabase?

**Options**:

**Option A: Fresh Start (Recommended for Beta)**
- Since this is beta, start with clean Supabase database
- Users re-enter data in deployed app
- Simplest approach
- **Best for**: Early beta with few users

**Option B: Export/Import Script**
- Build script to export IndexedDB data to JSON
- Import JSON into Supabase via API
- **Required for**: Existing users with significant data

**Tasks** (if Option B needed):

1. **Create Export Script** ⏱️ 1 day
   - Read all tables from IndexedDB
   - Export to JSON format
   - **File**: `src/scripts/exportLocalData.ts`

2. **Create Import Script** ⏱️ 1 day
   - Read JSON
   - Insert into Supabase via API
   - Handle errors gracefully
   - **File**: `src/scripts/importToSupabase.ts`

3. **Test Migration** ⏱️ 1 day
   - Test with real user data
   - Verify data integrity
   - Rollback plan if needed

**Recommendation**: **Start with Option A** (fresh start) for beta launch. Add Option B if users request data migration later.

**Blockers**: None - independent task

**Output**:
- Migration scripts (if needed)
- Documented migration process

---

## Part 4: Risk Assessment

### High-Risk Items 🔴

1. **Data Loss Without Sync**
   - Current app uses localStorage + IndexedDB
   - Users will lose data if browser cache is cleared
   - **Mitigation**: Complete Supabase migration ASAP

2. **RLS Policy Bugs**
   - Incorrect RLS policies could expose user data
   - **Mitigation**: Thorough testing, security review before production

3. **Authentication Edge Cases**
   - OAuth redirect failures
   - Session expiration handling
   - **Mitigation**: Comprehensive error handling, user testing

### Medium-Risk Items 🟡

1. **Performance with Remote DB**
   - Network latency for every query
   - **Mitigation**: Implement query optimization, caching, pagination

2. **Migration Downtime**
   - Switching from IndexedDB to Supabase may cause temporary UX issues
   - **Mitigation**: Feature flags, gradual rollout

3. **Schema Mismatch**
   - TypeScript types may drift from Supabase schema
   - **Mitigation**: Automated type generation in CI/CD

### Low-Risk Items 🟢

1. **Vercel Deployment**
   - Basic config already exists
   - Vite builds successfully
   - **Mitigation**: Minimal - just needs env vars

2. **Google OAuth Setup**
   - Well-documented process
   - **Mitigation**: Follow Supabase docs closely

---

## Part 5: Deployment Timeline

### Minimum Viable Deployment (2 weeks)

**Week 1: Database + Auth**
- Days 1-3: Create Supabase SQL schema + RLS policies
- Days 4-5: Set up Supabase Auth + Google OAuth
- Days 6-7: Update AuthContext, test authentication flow

**Week 2: Data Layer + Deployment**
- Days 1-4: Migrate data services from Dexie to Supabase
- Day 5: Update all components for async data loading
- Days 6-7: Test deployment, fix bugs, deploy to staging

**Deliverable**: Working deployed app with Supabase backend

### Full Production Release (3-4 weeks)

Add to Minimum Viable Deployment:
- Week 3: Multi-environment setup (dev/staging/prod)
- Week 3-4: Migration scripts (if needed), real-time features, extensive testing
- Week 4: Production deployment, monitoring, bug fixes

**Deliverable**: Production-ready app with full features

---

## Part 6: Recommended Action Plan

### Immediate Next Steps (This Week)

1. **Make Architecture Decisions** ⏱️ 1 hour
   - Decide: Remote-only OR local-first sync? (Recommend: Remote-only)
   - Decide: Fresh start OR data migration? (Recommend: Fresh start for beta)
   - Decide: Timeline (2 weeks MVP or 4 weeks full production?)

2. **Create Supabase Projects** ⏱️ 1 hour
   - Sign up for Supabase
   - Create dev, staging, prod projects
   - Note API keys and URLs

3. **Start SQL Schema Design** ⏱️ 2-3 days
   - Use `database-schema.md` as reference
   - Write initial migration SQL
   - Test locally with Supabase CLI

### Week 1 Focus

- Complete Phase 1 (Database setup)
- Start Phase 2 (Authentication)

### Week 2 Focus

- Complete Phase 2 (Authentication)
- Start Phase 3 (Data layer migration)

### Week 3+ Focus

- Complete Phase 3 (Data layer)
- Phases 4-5 (Migrations, environments)
- Testing and deployment

---

## Part 7: Code Examples

### Example 1: Supabase Client Initialization

**New File**: `src/services/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/supabase' // Auto-generated types

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

### Example 2: Supabase Auth Service

**New File**: `src/services/auth/SupabaseAuthService.ts`

```typescript
import { supabase } from '../supabase/client'
import { IAuthService, AuthSession, SignUpCredentials, SignInCredentials, AuthResponse } from './types'

export class SupabaseAuthService implements IAuthService {
  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          name: credentials.name
        }
      }
    })

    if (error) {
      return { user: null, session: null, error: error.message }
    }

    // Create user profile in database
    if (data.user) {
      await supabase.from('user_profiles').insert({
        user_id: data.user.id,
        display_name: credentials.name
      })
    }

    return {
      user: data.user ? this.mapSupabaseUser(data.user) : null,
      session: data.session ? this.mapSupabaseSession(data.session) : null
    }
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    })

    if (error) {
      return { user: null, session: null, error: error.message }
    }

    return {
      user: data.user ? this.mapSupabaseUser(data.user) : null,
      session: data.session ? this.mapSupabaseSession(data.session) : null
    }
  }

  async signInWithGoogle(): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) {
      return { user: null, session: null, error: error.message }
    }

    return { user: null, session: null } // Redirect happens, no immediate response
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  async getSession(): Promise<AuthSession | null> {
    const { data } = await supabase.auth.getSession()
    return data.session ? this.mapSupabaseSession(data.session) : null
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(session ? this.mapSupabaseSession(session) : null)
    })

    return () => subscription.unsubscribe()
  }

  // Helper methods to map Supabase types to app types
  private mapSupabaseUser(supabaseUser: any) {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.user_metadata.name,
      authProvider: 'supabase',
      createdDate: new Date(supabaseUser.created_at),
      lastLogin: new Date()
    }
  }

  private mapSupabaseSession(supabaseSession: any): AuthSession {
    return {
      user: this.mapSupabaseUser(supabaseSession.user),
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: supabaseSession.expires_at * 1000
    }
  }
}
```

### Example 3: RLS Policy SQL

**New File**: `supabase/migrations/20251024010000_rls_policies.sql`

```sql
-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own user record
CREATE POLICY "Users can read own user"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own user record
CREATE POLICY "Users can update own user"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can read bands they're a member of
CREATE POLICY "Users can read member bands"
  ON bands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_memberships.band_id = bands.id
        AND band_memberships.user_id = auth.uid()
        AND band_memberships.status = 'active'
    )
  );

-- Users can read songs in their bands
CREATE POLICY "Users can read band songs"
  ON songs FOR SELECT
  USING (
    context_type = 'band' AND
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_memberships.band_id = songs.context_id
        AND band_memberships.user_id = auth.uid()
        AND band_memberships.status = 'active'
    )
  );

-- Users can read their personal songs
CREATE POLICY "Users can read personal songs"
  ON songs FOR SELECT
  USING (
    context_type = 'personal' AND context_id = auth.uid()
  );

-- Band admins can insert/update/delete band songs
CREATE POLICY "Band admins can manage songs"
  ON songs FOR ALL
  USING (
    context_type = 'band' AND
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_memberships.band_id = songs.context_id
        AND band_memberships.user_id = auth.uid()
        AND band_memberships.role IN ('admin', 'owner')
        AND band_memberships.status = 'active'
    )
  );

-- Similar policies for setlists, practice_sessions, etc.
```

### Example 4: Migrating a Service

**Before** (`src/services/SongService.ts` - IndexedDB):

```typescript
import { db } from './database'

export class SongService {
  static async getSongsByBand(bandId: string) {
    return await db.songs
      .where('contextType').equals('band')
      .and(song => song.contextId === bandId)
      .toArray()
  }

  static async addSong(song: Song) {
    return await db.songs.add(song)
  }
}
```

**After** (`src/services/SongService.ts` - Supabase):

```typescript
import { supabase } from './supabase/client'

export class SongService {
  static async getSongsByBand(bandId: string) {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('context_type', 'band')
      .eq('context_id', bandId)
      .order('created_date', { ascending: false })

    if (error) throw error
    return data
  }

  static async addSong(song: Song) {
    const { data, error } = await supabase
      .from('songs')
      .insert(song)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
```

---

## Part 8: Critical Files & Locations

### Files to Create

```
supabase/
├── migrations/
│   ├── 20251024000000_initial_schema.sql
│   ├── 20251024010000_rls_policies.sql
│   └── 20251024020000_indexes.sql
├── seed.sql
└── config.toml

src/
├── services/
│   ├── supabase/
│   │   └── client.ts (NEW)
│   └── auth/
│       └── SupabaseAuthService.ts (NEW)
└── types/
    └── supabase.ts (AUTO-GENERATED)

.github/
└── workflows/
    └── deploy.yml (OPTIONAL - CI/CD)
```

### Files to Modify

```
src/
├── contexts/
│   └── AuthContext.tsx (Update to use SupabaseAuthService)
├── services/
│   ├── SongService.ts (Migrate from Dexie to Supabase)
│   ├── BandService.ts (Migrate from Dexie to Supabase)
│   ├── SetlistService.ts (Migrate from Dexie to Supabase)
│   ├── PracticeSessionService.ts (Migrate from Dexie to Supabase)
│   └── BandMembershipService.ts (Migrate from Dexie to Supabase)
└── pages/
    └── NewLayout/
        ├── SongsPage.tsx (Update for async Supabase queries)
        ├── SetlistsPage.tsx (Update for async Supabase queries)
        ├── PracticesPage.tsx (Update for async Supabase queries)
        ├── ShowsPage.tsx (Update for async Supabase queries)
        └── BandMembersPage.tsx (Update for async Supabase queries)

.env.local (Add Supabase credentials)
vercel.json (Add environment variable references)
```

### Files to Reference

- **Database Schema**: `.claude/specifications/database-schema.md` (source of truth for table structure)
- **Auth Summary**: `.claude/artifacts/2025-10-21T21:42_phase-1-auth-completion-summary.md`
- **Seed Data**: `src/database/seedMvpData.ts` (convert to SQL)

---

## Part 9: Answers to Specific Questions

### Q1: Have we done anything to deal with syncing IndexedDB to Supabase?

**Answer**: **No, absolutely nothing.** There is zero sync logic. The codebase has no awareness of Supabase beyond having the npm package installed. All data operations target IndexedDB exclusively via Dexie.

**Impact**: Users will lose all data if they clear browser cache or switch devices.

### Q2: Are we going to have issues with syncing?

**Answer**: **Yes, if you try to implement sync.** Bi-directional sync is extremely complex:
- Conflict resolution (what if user edits same song offline and online?)
- Queue management (offline writes need to be queued and replayed)
- Data consistency (ensure IndexedDB and Supabase match)
- Edge cases (network failures mid-sync, corrupted data)

**Recommendation**: Don't implement sync for initial deployment. Use remote-only approach (Supabase as single source of truth). Add offline support in future phase if needed.

### Q3: How will the database initially be setup and configured?

**Answer**: Manual setup required:

1. **Create Supabase Project**: Via Supabase Dashboard (supabase.com)
2. **Run Initial Migration**: `supabase db push` to create all tables
3. **Enable RLS Policies**: Part of migration SQL
4. **Configure Auth**: Enable Google OAuth in Supabase settings
5. **Seed Test Data**: Run seed SQL script for dev/staging environments
6. **Configure Vercel**: Add environment variables with Supabase credentials

**Timeline**: 1-2 days for initial setup

### Q4: How will we handle database schema updates/migrations?

**Answer**: Use Supabase CLI migration workflow:

1. **Local Development**:
   ```bash
   # Make schema changes locally
   supabase db diff -f migration_name

   # Test migration
   supabase db reset

   # Commit migration file to git
   git add supabase/migrations/*.sql
   git commit -m "Add new column to songs table"
   ```

2. **Deployment**:
   ```bash
   # Deploy to staging
   supabase db push --db-url <staging-url>

   # Deploy to production
   supabase db push --db-url <prod-url>
   ```

3. **Type Generation**:
   ```bash
   # Auto-generate TypeScript types
   supabase gen types typescript --db-url <url> > src/types/supabase.ts
   ```

**Best Practice**: Never modify production database manually. Always use migrations in version control.

### Q5: Are credentials secure?

**Answer**: **Partially secure, needs improvement**:

✅ **Good**:
- `.env.local` is gitignored (not committed to repo)
- Anon key is public-facing (safe to expose)

⚠️ **Needs Fixing**:
- Must configure Vercel environment variables separately (don't deploy .env.local)
- Service role key (if you have one) must NEVER be exposed to client
- Enable RLS policies to prevent anon key abuse

🔐 **Production Checklist**:
- [x] .env.local gitignored
- [ ] Vercel environment variables configured
- [ ] RLS policies enabled on all tables
- [ ] Service role key stored securely (backend only)
- [ ] OAuth redirect URLs configured in Google Console

### Q6: How will test vs prod environments work?

**Answer**: Create separate Supabase projects:

| Environment | Supabase Project | Vercel Context | Use Case |
|-------------|------------------|----------------|----------|
| Development | `rock-on-dev` | Local | Local development |
| Staging | `rock-on-staging` | Preview | PR previews, testing |
| Production | `rock-on-prod` | Production | Main branch, live users |

**Vercel Configuration**:

```json
// In Vercel Dashboard, configure environment variables:
// Preview:
VITE_SUPABASE_URL = https://staging-project.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGc...staging-key

// Production:
VITE_SUPABASE_URL = https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGc...prod-key
```

**Workflow**:
1. Develop locally with `rock-on-dev`
2. Push branch → auto-deploy to `rock-on-staging`
3. Merge to main → auto-deploy to `rock-on-prod`

---

## Part 10: Summary & Recommendations

### Current Readiness: ❌ NOT READY

**Percentage Complete**: ~15%
- ✅ Frontend UI complete
- ✅ Local IndexedDB working
- ✅ Mock auth functional
- ❌ No Supabase integration (0%)
- ❌ No production auth (0%)
- ❌ No SQL schema (0%)
- ❌ No RLS policies (0%)
- ❌ No deployment config (0%)

### Effort Required: 2-4 Weeks Full-Time

**Breakdown**:
- Week 1: Database setup + Auth integration (40 hours)
- Week 2: Data layer migration (40 hours)
- Week 3-4: Testing, multi-env, polish (40-80 hours)

**Total**: 120-160 hours of development

### Critical Path

1. ✅ **Now**: Make architecture decisions (sync strategy, migration approach)
2. 🔴 **Week 1**: Create Supabase schema + RLS policies
3. 🔴 **Week 1**: Implement real Supabase authentication
4. 🔴 **Week 2**: Migrate all data services from Dexie to Supabase
5. 🟡 **Week 2-3**: Update React components for async data
6. 🟢 **Week 3-4**: Deploy to staging, test, fix bugs, deploy to production

### Top Recommendations

1. **Remote-Only First**: Skip IndexedDB sync for initial deployment. Use Supabase as single source of truth.

2. **Fresh Start for Beta**: Don't migrate existing local data. Have users re-enter data in deployed app.

3. **Use Supabase CLI**: Automate migrations and type generation from day one.

4. **Enable RLS**: Absolutely critical for security. Without RLS, any user can read any data.

5. **Start Small**: Deploy to staging first. Test thoroughly before production.

6. **Plan for 3 Weeks**: Be realistic about timeline. Rushing will create security/data bugs.

### What to Build First

**Priority 1 (Must Have for Deployment)**:
- Supabase SQL schema
- RLS policies
- Real authentication (Google OAuth)
- Basic CRUD operations (songs, setlists, practices, shows, band members)

**Priority 2 (Should Have)**:
- Migration workflow
- Multi-environment setup
- Type generation

**Priority 3 (Nice to Have)**:
- Real-time updates
- Offline support with sync
- Data migration scripts

---

## Part 11: Next Actions

### This Week

1. **Read this report thoroughly** ⏱️ 1 hour
2. **Make architecture decisions** ⏱️ 1 hour
   - Remote-only or sync?
   - Fresh start or migration?
   - 2-week MVP or 4-week full production?
3. **Create Supabase projects** ⏱️ 1 hour
4. **Begin SQL schema design** ⏱️ 2-3 days

### Need Help With?

If you want me to:
- ✅ Create the initial SQL migration file
- ✅ Write the Supabase Auth Service
- ✅ Set up RLS policies
- ✅ Migrate specific service files
- ✅ Create the migration workflow documentation

...just ask! I'm ready to help implement any phase.

---

## Conclusion

You have a solid foundation with IndexedDB and mock auth working locally. However, deploying to Vercel with Supabase requires substantial work across authentication, database schema, data layer, and deployment configuration.

**The good news**: The architecture is clean with service abstractions (IAuthService, separate service files), making the migration to Supabase straightforward once you commit to it.

**The reality**: Plan for 2-4 weeks of focused development to properly integrate Supabase and deploy securely.

**Let me know how you want to proceed!** 🚀
