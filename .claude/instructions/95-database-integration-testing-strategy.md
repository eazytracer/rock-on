---
title: Database Integration Testing Strategy
created: 2025-10-29T00:27
status: Planning
priority: High
dependencies:
  - unified-database-schema.md (specifications)
  - Migration consolidation plan
  - CI/CD pipeline setup
context: |
  Establish comprehensive integration testing for database schema validation,
  RLS policy verification, and sync service CRUD operations. Tests should run
  against fresh Supabase instances in CI/CD pipeline.
---

# Database Integration Testing Strategy

## Overview

**Goal**: Create a comprehensive suite of integration tests that validate our database schema, RLS policies, and sync operations against a fresh Supabase instance.

**Why**:
- Catch schema drift before production
- Validate migration consolidation doesn't break anything
- Ensure RLS policies work correctly for all user roles
- Verify sync services can perform all CRUD operations
- Enable confident deployments with automated validation

**Test Types**:
1. **Schema Validation** - Tables, columns, constraints exist
2. **RLS Policy Validation** - Permissions work correctly
3. **Sync Service Integration** - CRUD operations via sync layer

---

## Test Architecture

### Test Structure

```
tests/
  ├── integration/
  │   ├── database/
  │   │   ├── schema/
  │   │   │   ├── 01-tables.test.ts        # Table existence
  │   │   │   ├── 02-columns.test.ts       # Column definitions
  │   │   │   ├── 03-indexes.test.ts       # Index existence
  │   │   │   ├── 04-constraints.test.ts   # FK, CHECK constraints
  │   │   │   └── 05-triggers.test.ts      # Trigger functions
  │   │   ├── rls/
  │   │   │   ├── 01-songs.rls.test.ts     # Songs RLS policies
  │   │   │   ├── 02-bands.rls.test.ts     # Bands RLS policies
  │   │   │   ├── 03-setlists.rls.test.ts  # Setlists RLS policies
  │   │   │   ├── 04-shows.rls.test.ts     # Shows RLS policies
  │   │   │   └── 05-practices.rls.test.ts # Practices RLS policies
  │   │   └── sync/
  │   │       ├── 01-songs.sync.test.ts    # Songs CRUD via sync
  │   │       ├── 02-bands.sync.test.ts    # Bands CRUD via sync
  │   │       ├── 03-setlists.sync.test.ts # Setlists CRUD via sync
  │   │       ├── 04-shows.sync.test.ts    # Shows CRUD via sync
  │   │       └── 05-practices.sync.test.ts # Practices CRUD via sync
  │   └── setup/
  │       ├── supabase-test-instance.ts    # Fresh instance setup
  │       ├── test-data-factory.ts         # Test data generation
  │       └── cleanup.ts                   # Teardown helpers
  └── fixtures/
      └── expected-schema.json             # Expected schema definition
```

---

## Phase 1: Schema Validation Tests

### 1.1 Table Existence Tests

**Purpose**: Verify all required tables exist

**Implementation**: `tests/integration/database/schema/01-tables.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestSupabaseClient } from '../setup/supabase-test-instance'

describe('Database Schema - Table Existence', () => {
  let supabase: SupabaseClient

  beforeAll(async () => {
    supabase = await createTestSupabaseClient()
  })

  const REQUIRED_TABLES = [
    'users',
    'user_profiles',
    'bands',
    'band_memberships',
    'invite_codes',
    'songs',
    'song_groups',
    'song_group_memberships',
    'setlists',
    'shows',
    'practice_sessions',
    'song_castings',
    'song_assignments',
    'assignment_roles',
    'casting_templates',
    'member_capabilities'
  ]

  REQUIRED_TABLES.forEach(tableName => {
    it(`should have table: ${tableName}`, async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })

  it('should not have obsolete gig-related fields in practice_sessions', async () => {
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'practice_sessions'
    })

    const columnNames = data?.map((col: any) => col.column_name) || []

    // Ensure old show fields are NOT in practice_sessions
    expect(columnNames).not.toContain('name')  // Should be in shows table only
    expect(columnNames).not.toContain('venue') // Should be in shows table only
  })

  it('should have shows table with correct fields', async () => {
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'shows'
    })

    const columnNames = data?.map((col: any) => col.column_name) || []

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('venue')
    expect(columnNames).toContain('band_id')
    expect(columnNames).toContain('setlist_id')
    expect(columnNames).toContain('scheduled_date')
    expect(columnNames).toContain('contacts')  // JSONB field
    expect(columnNames).toContain('status')
  })
})
```

**Helper Function** (create via migration or seed):
```sql
-- Helper function to get table columns
CREATE OR REPLACE FUNCTION get_table_columns(table_name TEXT)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  column_default TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = get_table_columns.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.2 Column Definition Tests

**Purpose**: Verify columns have correct types, nullability, defaults

**Implementation**: `tests/integration/database/schema/02-columns.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { createTestSupabaseClient } from '../setup/supabase-test-instance'
import expectedSchema from '../../../fixtures/expected-schema.json'

describe('Database Schema - Column Definitions', () => {
  it('songs table should have correct columns', async () => {
    const supabase = await createTestSupabaseClient()

    const { data } = await supabase.rpc('get_table_columns', {
      table_name: 'songs'
    })

    const columns = data as Array<{
      column_name: string
      data_type: string
      is_nullable: string
    }>

    // Check critical columns
    const titleCol = columns.find(c => c.column_name === 'title')
    expect(titleCol).toBeDefined()
    expect(titleCol?.data_type).toBe('text')
    expect(titleCol?.is_nullable).toBe('NO')

    const tempoCol = columns.find(c => c.column_name === 'tempo')
    expect(tempoCol).toBeDefined()
    expect(tempoCol?.data_type).toBe('integer')

    // Verify NO 'bpm' column (should be 'tempo')
    const bpmCol = columns.find(c => c.column_name === 'bpm')
    expect(bpmCol).toBeUndefined()
  })

  it('setlists table should use last_modified not updated_date', async () => {
    const supabase = await createTestSupabaseClient()

    const { data } = await supabase.rpc('get_table_columns', {
      table_name: 'setlists'
    })

    const columns = data as Array<{ column_name: string }>
    const columnNames = columns.map(c => c.column_name)

    expect(columnNames).toContain('last_modified')
    expect(columnNames).not.toContain('updated_date')
  })

  it('shows table should have JSONB contacts field', async () => {
    const supabase = await createTestSupabaseClient()

    const { data } = await supabase.rpc('get_table_columns', {
      table_name: 'shows'
    })

    const contactsCol = data?.find((c: any) => c.column_name === 'contacts')
    expect(contactsCol).toBeDefined()
    expect(contactsCol?.data_type).toBe('jsonb')
  })

  it('practice_sessions should NOT have type=gig', async () => {
    const supabase = await createTestSupabaseClient()

    const { data } = await supabase.rpc('get_column_constraint', {
      table_name: 'practice_sessions',
      column_name: 'type'
    })

    // Check constraint should NOT include 'gig'
    const constraint = data?.[0]?.check_clause || ''
    expect(constraint).not.toContain('gig')
    expect(constraint).toContain('rehearsal')
  })
})
```

### 1.3 Index Tests

**Purpose**: Verify performance-critical indexes exist

**Implementation**: `tests/integration/database/schema/03-indexes.test.ts`

```typescript
describe('Database Schema - Indexes', () => {
  const REQUIRED_INDEXES = [
    { table: 'songs', column: 'context_type, context_id' },
    { table: 'songs', column: 'created_by' },
    { table: 'bands', column: 'is_active' },
    { table: 'band_memberships', column: 'user_id' },
    { table: 'band_memberships', column: 'band_id' },
    { table: 'setlists', column: 'band_id' },
    { table: 'setlists', column: 'show_id' },
    { table: 'shows', column: 'band_id' },
    { table: 'shows', column: 'scheduled_date' },
    { table: 'practice_sessions', column: 'band_id' },
    { table: 'practice_sessions', column: 'scheduled_date' },
  ]

  REQUIRED_INDEXES.forEach(({ table, column }) => {
    it(`should have index on ${table}(${column})`, async () => {
      const supabase = await createTestSupabaseClient()

      const { data } = await supabase.rpc('check_index_exists', {
        table_name: table,
        column_names: column
      })

      expect(data).toBe(true)
    })
  })
})
```

---

## Phase 2: RLS Policy Validation Tests

### 2.1 Songs RLS Tests

**Purpose**: Verify songs RLS policies work for band members

**Implementation**: `tests/integration/database/rls/01-songs.rls.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestSupabaseClient, createTestUsers } from '../setup/supabase-test-instance'

describe('RLS Policies - Songs', () => {
  let adminClient: SupabaseClient
  let memberClient: SupabaseClient
  let outsiderClient: SupabaseClient
  let testBandId: string
  let testSongId: string

  beforeAll(async () => {
    // Create 3 test users and a band
    const setup = await createTestUsers()
    adminClient = setup.adminClient
    memberClient = setup.memberClient
    outsiderClient = setup.outsiderClient
    testBandId = setup.bandId
  })

  describe('SELECT policy', () => {
    it('band members can view band songs', async () => {
      const { data, error } = await memberClient
        .from('songs')
        .select('*')
        .eq('context_type', 'band')
        .eq('context_id', testBandId)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('outsiders cannot view band songs', async () => {
      const { data, error } = await outsiderClient
        .from('songs')
        .select('*')
        .eq('context_type', 'band')
        .eq('context_id', testBandId)

      // RLS should return empty array (not error)
      expect(data).toEqual([])
    })
  })

  describe('INSERT policy', () => {
    it('band members can create songs', async () => {
      const { data, error } = await memberClient
        .from('songs')
        .insert({
          title: 'Test Song',
          artist: 'Test Artist',
          context_type: 'band',
          context_id: testBandId,
          created_by: setup.memberId,
          tempo: 120
        })
        .select()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      testSongId = data![0].id
    })

    it('outsiders cannot create songs for band', async () => {
      const { data, error } = await outsiderClient
        .from('songs')
        .insert({
          title: 'Forbidden Song',
          artist: 'Hacker',
          context_type: 'band',
          context_id: testBandId,
          created_by: setup.outsiderId,
          tempo: 120
        })

      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501') // RLS violation
    })
  })

  describe('UPDATE policy', () => {
    it('band members can update band songs', async () => {
      const { error } = await memberClient
        .from('songs')
        .update({ title: 'Updated Title' })
        .eq('id', testSongId)

      expect(error).toBeNull()
    })

    it('outsiders cannot update band songs', async () => {
      const { error } = await outsiderClient
        .from('songs')
        .update({ title: 'Hacked Title' })
        .eq('id', testSongId)

      expect(error).not.toBeNull()
    })
  })

  describe('DELETE policy', () => {
    it('creators can delete their songs', async () => {
      const { error } = await memberClient
        .from('songs')
        .delete()
        .eq('id', testSongId)

      expect(error).toBeNull()
    })

    it('non-creators cannot delete others songs', async () => {
      // Create song as admin
      const { data: song } = await adminClient
        .from('songs')
        .insert({
          title: 'Admin Song',
          artist: 'Admin',
          context_type: 'band',
          context_id: testBandId,
          created_by: setup.adminId,
          tempo: 100
        })
        .select()
        .single()

      // Try to delete as member
      const { error } = await memberClient
        .from('songs')
        .delete()
        .eq('id', song.id)

      expect(error).not.toBeNull()
    })
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanup(testBandId)
  })
})
```

### 2.2 Shows RLS Tests

**Purpose**: Verify shows table has correct RLS policies

**Implementation**: `tests/integration/database/rls/04-shows.rls.test.ts`

```typescript
describe('RLS Policies - Shows', () => {
  it('band members can create shows', async () => {
    const { data, error } = await memberClient
      .from('shows')
      .insert({
        name: 'Test Show',
        band_id: testBandId,
        scheduled_date: new Date().toISOString(),
        duration: 120,
        status: 'scheduled',
        contacts: [],  // JSONB field
        created_by: setup.memberId
      })
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('shows table accepts JSONB contacts without manual JSON.stringify', async () => {
    const contacts = [
      { id: '1', name: 'Venue Manager', role: 'Manager', phone: '555-1234' }
    ]

    const { data, error } = await memberClient
      .from('shows')
      .insert({
        name: 'Show with Contacts',
        band_id: testBandId,
        scheduled_date: new Date().toISOString(),
        duration: 120,
        status: 'scheduled',
        contacts: contacts,  // Pass object directly (NOT JSON.stringify!)
        created_by: setup.memberId
      })
      .select()

    expect(error).toBeNull()
    expect(data![0].contacts).toEqual(contacts)
    expect(typeof data![0].contacts).toBe('object') // Not string!
  })
})
```

---

## Phase 3: Sync Service Integration Tests

### 3.1 Songs Sync Tests

**Purpose**: Verify sync services can perform CRUD via repository layer

**Implementation**: `tests/integration/database/sync/01-songs.sync.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { SongService } from '../../../src/services/SongService'
import { createTestSupabaseClient, createTestUsers } from '../setup/supabase-test-instance'

describe('Sync Integration - Songs', () => {
  let testBandId: string
  let userId: string

  beforeAll(async () => {
    const setup = await createTestUsers()
    testBandId = setup.bandId
    userId = setup.memberId
  })

  it('should create song via SongService', async () => {
    const song = await SongService.createSong({
      title: 'Sync Test Song',
      artist: 'Sync Artist',
      contextType: 'band',
      contextId: testBandId,
      tempo: 120,
      duration: 180
    })

    expect(song).toBeDefined()
    expect(song.title).toBe('Sync Test Song')
    expect(song.id).toBeDefined()
  })

  it('should map tempo field correctly (not bpm)', async () => {
    // Create via frontend model (uses 'bpm')
    const song = await SongService.createSong({
      title: 'Tempo Test',
      artist: 'Artist',
      contextType: 'band',
      contextId: testBandId,
      bpm: 140,  // Frontend uses 'bpm'
      duration: 200
    })

    // Verify in database (uses 'tempo')
    const supabase = await createTestSupabaseClient()
    const { data } = await supabase
      .from('songs')
      .select('tempo')
      .eq('id', song.id)
      .single()

    expect(data.tempo).toBe(140)
  })

  it('should update song via SongService', async () => {
    const song = await SongService.createSong({
      title: 'Original Title',
      artist: 'Artist',
      contextType: 'band',
      contextId: testBandId,
      tempo: 100,
      duration: 150
    })

    const updated = await SongService.updateSong(song.id, {
      title: 'Updated Title',
      tempo: 110
    })

    expect(updated.title).toBe('Updated Title')
    expect(updated.bpm).toBe(110)  // Mapped back to bpm
  })

  it('should delete song via SongService', async () => {
    const song = await SongService.createSong({
      title: 'To Delete',
      artist: 'Artist',
      contextType: 'band',
      contextId: testBandId,
      tempo: 100,
      duration: 150
    })

    await SongService.deleteSong(song.id)

    // Verify deleted
    const result = await SongService.getSong(song.id)
    expect(result).toBeNull()
  })
})
```

### 3.2 Shows Sync Tests

**Purpose**: Verify shows sync correctly via services

**Implementation**: `tests/integration/database/sync/04-shows.sync.test.ts`

```typescript
describe('Sync Integration - Shows', () => {
  it('should create show via ShowService', async () => {
    const show = await ShowService.createShow({
      name: 'Test Show',
      bandId: testBandId,
      scheduledDate: new Date('2025-12-01'),
      venue: 'Test Venue',
      duration: 120,
      status: 'scheduled',
      contacts: [
        { id: '1', name: 'Manager', role: 'Venue Manager' }
      ]
    })

    expect(show).toBeDefined()
    expect(show.name).toBe('Test Show')
    expect(show.contacts).toHaveLength(1)
  })

  it('should handle JSONB contacts field correctly', async () => {
    const contacts = [
      { id: '1', name: 'John', role: 'Manager', phone: '555-0001' },
      { id: '2', name: 'Jane', role: 'Sound', email: 'jane@venue.com' }
    ]

    const show = await ShowService.createShow({
      name: 'Multi-Contact Show',
      bandId: testBandId,
      scheduledDate: new Date('2025-12-15'),
      duration: 180,
      contacts: contacts
    })

    // Contacts should be objects, not strings
    expect(Array.isArray(show.contacts)).toBe(true)
    expect(show.contacts).toHaveLength(2)
    expect(show.contacts[0].name).toBe('John')
  })
})
```

---

## Phase 4: Migration Consolidation Correlation

### 4.1 Test Against Consolidated Migration

**Goal**: Ensure consolidated migration produces identical schema to current migrations

**Process**:
1. Run all current migrations → Snapshot schema A
2. Run consolidated migration → Snapshot schema B
3. Compare schemas → Must be identical

**Implementation**: `tests/integration/database/migration-consolidation.test.ts`

```typescript
describe('Migration Consolidation Validation', () => {
  it('consolidated migration produces identical schema to current migrations', async () => {
    // Setup 1: Fresh instance with current migrations
    const instance1 = await createFreshSupabaseInstance()
    await instance1.applyAllMigrations()  // 12 files
    const schemaA = await instance1.exportSchema()

    // Setup 2: Fresh instance with consolidated migration
    const instance2 = await createFreshSupabaseInstance()
    await instance2.applyConsolidatedMigration()  // 1 file
    const schemaB = await instance2.exportSchema()

    // Compare schemas
    expect(schemaB.tables).toEqual(schemaA.tables)
    expect(schemaB.indexes).toEqual(schemaA.indexes)
    expect(schemaB.constraints).toEqual(schemaA.constraints)
    expect(schemaB.triggers).toEqual(schemaA.triggers)
    expect(schemaB.policies).toEqual(schemaA.policies)
  })
})
```

### 4.2 Test Data Migration

**Goal**: Ensure data migrates correctly from old to new schema

```typescript
describe('Data Migration Validation', () => {
  it('migrates shows from practice_sessions correctly', async () => {
    const instance = await createFreshSupabaseInstance()

    // Apply old schema (with gig type)
    await instance.applyMigration('20251026190000_add_gig_type.sql')

    // Insert test gig
    await instance.insert('practice_sessions', {
      band_id: testBandId,
      type: 'gig',
      scheduled_date: '2025-12-01',
      name: 'Test Gig',
      venue: 'Test Venue'
    })

    // Apply shows migration
    await instance.applyMigration('20251028000000_create_shows_table.sql')

    // Verify show was migrated
    const shows = await instance.select('shows')
    expect(shows).toHaveLength(1)
    expect(shows[0].name).toBe('Test Gig')

    // Verify gig removed from practice_sessions
    const practices = await instance.select('practice_sessions', { type: 'gig' })
    expect(practices).toHaveLength(0)
  })
})
```

---

## Phase 5: CI/CD Pipeline Integration

### 5.1 GitHub Actions Workflow

**File**: `.github/workflows/database-tests.yml`

```yaml
name: Database Integration Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'supabase/migrations/**'
      - 'src/services/data/**'
      - 'tests/integration/database/**'
  pull_request:
    branches: [main, develop]

jobs:
  database-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase (with migrations)
        run: npx supabase start

      - name: Wait for Supabase
        run: |
          timeout 60 bash -c 'until npx supabase status; do sleep 1; done'

      - name: Seed test data
        run: |
          cat supabase/seed-local-dev.sql | \
          docker exec -i $(docker ps -qf "name=supabase_db") \
          psql -U postgres -d postgres

      - name: Run Schema Validation Tests
        run: npm test -- tests/integration/database/schema

      - name: Run RLS Policy Tests
        run: npm test -- tests/integration/database/rls

      - name: Run Sync Integration Tests
        run: npm test -- tests/integration/database/sync

      - name: Stop Supabase
        if: always()
        run: npx supabase stop
```

### 5.2 Test with Consolidated Migration

**File**: `.github/workflows/consolidated-migration-test.yml`

```yaml
name: Consolidated Migration Test

on:
  push:
    paths:
      - 'supabase/migrations/consolidated/**'

jobs:
  test-consolidated-migration:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      # ... setup steps ...

      - name: Test Consolidated Migration
        run: |
          # Create temp directory with only consolidated migration
          mkdir -p temp_migrations
          cp supabase/migrations/consolidated/*.sql temp_migrations/

          # Start Supabase with consolidated migration only
          npx supabase start --migrations-path temp_migrations

          # Run all tests
          npm test -- tests/integration/database
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Create test utilities (`supabase-test-instance.ts`, `test-data-factory.ts`)
- [ ] Add helper SQL functions (`get_table_columns`, etc.)
- [ ] Write table existence tests (01-tables.test.ts)
- [ ] Write column definition tests (02-columns.test.ts)

### Phase 2: RLS Validation (Week 1-2)
- [ ] Create test user factory with different roles
- [ ] Write Songs RLS tests
- [ ] Write Bands RLS tests
- [ ] Write Setlists RLS tests
- [ ] Write Shows RLS tests
- [ ] Write Practices RLS tests

### Phase 3: Sync Integration (Week 2)
- [ ] Write Songs sync tests
- [ ] Write Bands sync tests
- [ ] Write Setlists sync tests
- [ ] Write Shows sync tests
- [ ] Write Practices sync tests

### Phase 4: Migration Consolidation (Week 3)
- [ ] Create consolidated migration file
- [ ] Write schema comparison tests
- [ ] Write data migration tests
- [ ] Validate all tests pass with consolidated migration

### Phase 5: CI/CD (Week 3)
- [ ] Create GitHub Actions workflow
- [ ] Configure Supabase CLI in CI
- [ ] Add test coverage reporting
- [ ] Add badge to README

---

## Test Utilities

### supabase-test-instance.ts

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export async function createTestSupabaseClient(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.TEST_SUPABASE_URL || 'http://127.0.0.1:54321'
  const supabaseKey = process.env.TEST_SUPABASE_ANON_KEY || 'test-key'

  return createClient(supabaseUrl, supabaseKey)
}

export async function createTestUsers() {
  const supabase = await createTestSupabaseClient()

  // Create 3 users: admin, member, outsider
  const adminId = crypto.randomUUID()
  const memberId = crypto.randomUUID()
  const outsiderId = crypto.randomUUID()

  // Create band
  const bandId = crypto.randomUUID()

  // ... create users and memberships ...

  return {
    adminClient: createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    }),
    memberClient: createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${memberToken}`
        }
      }
    }),
    outsiderClient: createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${outsiderToken}`
        }
      }
    }),
    adminId,
    memberId,
    outsiderId,
    bandId
  }
}
```

### expected-schema.json

```json
{
  "tables": {
    "songs": {
      "columns": {
        "id": { "type": "uuid", "nullable": false },
        "title": { "type": "text", "nullable": false },
        "tempo": { "type": "integer", "nullable": true },
        "context_type": { "type": "text", "nullable": false },
        "context_id": { "type": "text", "nullable": false }
      },
      "indexes": [
        "idx_songs_context",
        "idx_songs_created_by"
      ],
      "policies": [
        "songs_select_if_member",
        "songs_insert_if_member",
        "songs_update_if_member",
        "songs_delete_if_creator"
      ]
    },
    "shows": {
      "columns": {
        "id": { "type": "uuid", "nullable": false },
        "name": { "type": "text", "nullable": false },
        "band_id": { "type": "uuid", "nullable": false },
        "contacts": { "type": "jsonb", "nullable": true },
        "status": { "type": "text", "nullable": false }
      }
    }
  }
}
```

---

## Success Criteria

### All Tests Pass
- ✅ 100% of schema validation tests pass
- ✅ 100% of RLS policy tests pass
- ✅ 100% of sync integration tests pass

### Consolidated Migration Validated
- ✅ Consolidated migration produces identical schema
- ✅ Data migrates correctly
- ✅ All tests pass with consolidated migration

### CI/CD Integration
- ✅ Tests run automatically on PR
- ✅ Tests run on migration changes
- ✅ Fresh Supabase instance created per test run

### Documentation
- ✅ Test README explains how to run tests locally
- ✅ CI/CD workflow documented
- ✅ Test coverage report generated

---

## Related Documents

- **Schema Reference**: `.claude/specifications/unified-database-schema.md`
- **Migration Plan**: `.claude/artifacts/2025-10-29T00:25_migration-vs-freshinit-analysis.md`
- **Cleanup Plan**: `.claude/artifacts/2025-10-29T00:10_sql-files-cleanup-plan.md`
- **RLS Spec**: `.claude/specifications/permissions-and-use-cases.md`

---

**Created**: 2025-10-29T00:27
**Status**: Planning - Ready for Implementation
**Priority**: High - Blocks migration consolidation
**Estimated Effort**: 3 weeks (15-20 hours per week)
