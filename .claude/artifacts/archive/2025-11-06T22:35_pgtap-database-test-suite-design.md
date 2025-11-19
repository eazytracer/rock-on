---
title: pgTAP Database Test Suite Design
created: 2025-11-06T22:35
summary: Comprehensive design for implementing pgTAP database tests to validate Rock-On schema, RLS policies, triggers, and data integrity
status: Design Complete - Ready for Implementation
---

# pgTAP Database Test Suite Design for Rock-On

## Executive Summary

This document outlines a comprehensive database testing strategy using pgTAP (PostgreSQL Test Anything Protocol) for the Rock-On band management application. These tests will validate:

1. **Schema integrity** - Tables, columns, indexes, constraints
2. **RLS policies** - Row-level security rules for band isolation
3. **Triggers & functions** - Version tracking, audit logging, timestamps
4. **Data integrity** - Foreign keys, check constraints, unique constraints
5. **Realtime configuration** - Publication and replica identity settings

**Estimated implementation time:** 4-6 hours
**Test execution time:** ~5-10 seconds (full suite)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Test Organization](#test-organization)
3. [Test Categories](#test-categories)
4. [Implementation Guide](#implementation-guide)
5. [Running Tests](#running-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Maintenance Strategy](#maintenance-strategy)

---

## Architecture Overview

### pgTAP Framework

**pgTAP** is a unit testing extension for PostgreSQL that implements the Test Anything Protocol (TAP). It provides:
- Declarative test assertions
- Transaction-based test isolation (automatic rollback)
- Comprehensive schema validation functions
- RLS policy testing capabilities

### Directory Structure

```
supabase/
├── migrations/
│   └── 20251106000000_baseline_schema.sql
├── tests/
│   ├── 000-setup-test-helpers.sql        # Setup (runs first alphabetically)
│   ├── 001-schema-tables.test.sql        # Table existence & structure
│   ├── 002-schema-columns.test.sql       # Column validation
│   ├── 003-schema-indexes.test.sql       # Index validation
│   ├── 004-schema-constraints.test.sql   # Constraints & foreign keys
│   ├── 005-functions-triggers.test.sql   # Functions & triggers
│   ├── 006-rls-policies.test.sql         # RLS policy existence
│   ├── 007-rls-band-isolation.test.sql   # Band data isolation
│   ├── 008-rls-personal-data.test.sql    # Personal data access
│   ├── 009-audit-logging.test.sql        # Audit trail validation
│   ├── 010-realtime-config.test.sql      # Realtime setup
│   └── 011-data-integrity.test.sql       # Data constraints
└── seed-mvp-data.sql
```

### Test Execution Flow

```
1. Enable pgTAP extension
2. Run tests alphabetically
   ├── Setup helpers & utilities (000-setup)
   ├── Schema validation (001-004)
   ├── Functions & triggers (005)
   ├── RLS policies (006-008)
   ├── Audit logging (009)
   ├── Realtime config (010)
   └── Data integrity (011)
3. Each test:
   ├── BEGIN transaction
   ├── SELECT plan(N)          -- Declare test count
   ├── Run test assertions
   ├── SELECT * FROM finish()
   └── ROLLBACK                -- Cleanup
```

---

## Test Organization

### Naming Convention

**Format:** `NNN-category-description.test.sql`

- **NNN:** Three-digit prefix for alphabetical ordering (000-999)
- **category:** Logical grouping (schema, rls, audit, etc.)
- **description:** Specific test focus
- **Extension:** `.test.sql` or `.sql`

### Test Structure Template

```sql
-- Test: <Test Name>
-- Purpose: <What this test validates>
-- Category: <Schema/RLS/Audit/etc.>
-- Created: <Date>

begin;

-- Declare how many tests will run
select plan(<number>);

-- Test assertions
select has_table('<table_name>');
select has_column('<table_name>', '<column_name>');
-- ... more tests

-- Finalize
select * from finish();

-- Rollback to cleanup
rollback;
```

---

## Test Categories

### 1. Schema Validation Tests

#### 001-schema-tables.test.sql

**Purpose:** Validate all 17 tables exist

**Tests (17):**
```sql
select has_table('users');
select has_table('user_profiles');
select has_table('bands');
select has_table('band_memberships');
select has_table('invite_codes');
select has_table('songs');
select has_table('song_groups');
select has_table('song_group_memberships');
select has_table('setlists');
select has_table('shows');
select has_table('practice_sessions');
select has_table('song_castings');
select has_table('song_assignments');
select has_table('assignment_roles');
select has_table('casting_templates');
select has_table('member_capabilities');
select has_table('audit_log');
```

**Expected result:** All 17 tables present

---

#### 002-schema-columns.test.sql

**Purpose:** Validate critical columns exist with correct types

**Tests (~80 tests for critical columns):**

**Users table (6 tests):**
```sql
select has_column('users', 'id');
select col_is_pk('users', 'id');
select has_column('users', 'email');
select col_type_is('users', 'email', 'text');
select has_column('users', 'name');
select has_column('users', 'created_date');
```

**Songs table (12 tests - critical fields):**
```sql
select has_column('songs', 'id');
select col_is_pk('songs', 'id');
select has_column('songs', 'tempo');           -- NOT 'bpm'
select col_type_is('songs', 'tempo', 'integer');
select has_column('songs', 'context_id');
select col_type_is('songs', 'context_id', 'text');  -- TEXT not UUID
select has_column('songs', 'version');
select col_default_is('songs', 'version', '1');
select has_column('songs', 'last_modified_by');
select col_type_is('songs', 'last_modified_by', 'uuid');
select col_is_null('songs', 'last_modified_by');  -- Nullable
```

**Setlists table (10 tests - critical fields):**
```sql
select has_column('setlists', 'id');
select col_is_pk('setlists', 'id');
select has_column('setlists', 'items');
select col_type_is('setlists', 'items', 'jsonb');
select has_column('setlists', 'last_modified');  -- NOT 'updated_date'
select col_type_is('setlists', 'last_modified', 'timestamp with time zone');
select has_column('setlists', 'version');
select has_column('setlists', 'last_modified_by');
select has_column('setlists', 'forked_from');
select has_column('setlists', 'fork_count');
```

**Shows table (8 tests):**
```sql
select has_column('shows', 'id');
select has_column('shows', 'gig_type');
select has_column('shows', 'venue');
select has_column('shows', 'load_in_time');
select has_column('shows', 'soundcheck_time');
select has_column('shows', 'set_time');
select has_column('shows', 'version');
select has_column('shows', 'last_modified_by');
```

**Practice Sessions table (6 tests):**
```sql
select has_column('practice_sessions', 'id');
select col_is_pk('practice_sessions', 'id');
select has_column('practice_sessions', 'type');
select has_column('practice_sessions', 'version');
select has_column('practice_sessions', 'last_modified_by');
-- Verify NO gig type (gigs moved to shows table)
select col_not_null('practice_sessions', 'type');
```

**Audit Log table (10 tests):**
```sql
select has_column('audit_log', 'id');
select col_is_pk('audit_log', 'id');
select has_column('audit_log', 'table_name');
select has_column('audit_log', 'record_id');
select has_column('audit_log', 'action');
select has_column('audit_log', 'user_id');
select has_column('audit_log', 'user_name');
select has_column('audit_log', 'old_values');
select col_type_is('audit_log', 'old_values', 'jsonb');
select has_column('audit_log', 'new_values');
select col_type_is('audit_log', 'new_values', 'jsonb');
```

---

#### 003-schema-indexes.test.sql

**Purpose:** Validate performance indexes exist

**Tests (~30 tests):**

```sql
-- User indexes
select has_index('users', 'idx_users_email', 'email');

-- Band membership indexes
select has_index('band_memberships', 'idx_band_memberships_user_id', 'user_id');
select has_index('band_memberships', 'idx_band_memberships_band_id', 'band_id');
select has_index('band_memberships', 'idx_band_memberships_status', 'status');

-- Song indexes
select has_index('songs', 'idx_songs_context', ARRAY['context_type', 'context_id']);
select has_index('songs', 'idx_songs_version', 'version');
select has_index('songs', 'idx_songs_version_modified', ARRAY['version', 'updated_date']);

-- Setlist indexes
select has_index('setlists', 'idx_setlists_band_id', 'band_id');
select has_index('setlists', 'idx_setlists_show_id', 'show_id');
select has_index('setlists', 'idx_setlists_version', 'version');

-- Show indexes
select has_index('shows', 'idx_shows_band_id', 'band_id');
select has_index('shows', 'idx_shows_scheduled_date', ARRAY['band_id', 'scheduled_date']);

-- Audit log indexes
select has_index('audit_log', 'idx_audit_log_table_record', ARRAY['table_name', 'record_id', 'changed_at']);
select has_index('audit_log', 'idx_audit_log_band_date', ARRAY['band_id', 'changed_at']);
```

---

#### 004-schema-constraints.test.sql

**Purpose:** Validate foreign keys, check constraints, unique constraints

**Tests (~40 tests):**

**Foreign Keys:**
```sql
-- Band memberships
select has_fk('band_memberships', 'band_memberships_user_id_fkey', 'user_id references users(id)');
select has_fk('band_memberships', 'band_memberships_band_id_fkey', 'band_id references bands(id)');

-- Songs
select has_fk('songs', 'songs_created_by_fkey', 'created_by references users(id)');
select has_fk('songs', 'songs_last_modified_by_fkey', 'last_modified_by references auth.users(id)');

-- Setlists
select has_fk('setlists', 'setlists_band_id_fkey', 'band_id references bands(id)');
select has_fk('setlists', 'setlists_created_by_fkey', 'created_by references users(id)');
select has_fk('setlists', 'setlists_forked_from_fkey', 'forked_from references setlists(id)');

-- Shows
select has_fk('shows', 'shows_band_id_fkey', 'band_id references bands(id)');
select has_fk('shows', 'shows_created_by_fkey', 'created_by references auth.users(id)');

-- Audit log
select has_fk('audit_log', 'audit_log_band_id_fkey', 'band_id references bands(id)');
```

**Check Constraints:**
```sql
-- Band memberships
select has_check('band_memberships', 'membership_role_check');
select has_check('band_memberships', 'membership_status_check');

-- Songs
select has_check('songs', 'song_difficulty_check');
select has_check('songs', 'song_confidence_check');
select has_check('songs', 'song_context_check');

-- Setlists
select has_check('setlists', 'setlist_status_check');

-- Shows
select has_check('shows', 'shows_status_check');
select has_check('shows', 'shows_payment_check');

-- Practice sessions
select has_check('practice_sessions', 'session_type_check');
```

**Unique Constraints:**
```sql
-- Users
select col_is_unique('users', 'email');

-- User profiles
select col_is_unique('user_profiles', 'user_id');

-- Band memberships
select has_unique('band_memberships', 'band_memberships_user_id_band_id_key');
```

---

### 2. Functions & Triggers Tests

#### 005-functions-triggers.test.sql

**Purpose:** Validate trigger functions and triggers exist

**Tests (~30 tests):**

**Function Existence:**
```sql
select has_function('update_updated_date_column');
select has_function('increment_version');
select has_function('set_last_modified_by');
select has_function('set_created_by');
select has_function('log_audit_trail');
```

**Function Return Types:**
```sql
select function_returns('update_updated_date_column', 'trigger');
select function_returns('increment_version', 'trigger');
select function_returns('log_audit_trail', 'trigger');
```

**Trigger Existence:**
```sql
-- Updated_date triggers
select has_trigger('bands', 'update_bands_updated_date');
select has_trigger('songs', 'update_songs_updated_date');
select has_trigger('setlists', 'update_setlists_last_modified');

-- Version increment triggers
select has_trigger('songs', 'songs_version_trigger');
select has_trigger('setlists', 'setlists_version_trigger');
select has_trigger('shows', 'shows_version_trigger');
select has_trigger('practice_sessions', 'practice_sessions_version_trigger');

-- Created_by triggers
select has_trigger('songs', 'songs_set_created_by');
select has_trigger('setlists', 'setlists_set_created_by');
select has_trigger('shows', 'shows_set_created_by');

-- Last_modified_by triggers
select has_trigger('songs', 'songs_set_last_modified_by');
select has_trigger('setlists', 'setlists_set_last_modified_by');

-- Audit log triggers
select has_trigger('songs', 'songs_audit_log');
select has_trigger('setlists', 'setlists_audit_log');
select has_trigger('shows', 'shows_audit_log');
select has_trigger('practice_sessions', 'practice_sessions_audit_log');
```

---

### 3. RLS Policy Tests

#### 006-rls-policies.test.sql

**Purpose:** Validate RLS is enabled and policies exist

**Tests (~50 tests):**

**RLS Enabled:**
```sql
select rls_enabled('users');
select rls_enabled('user_profiles');
select rls_enabled('bands');
select rls_enabled('band_memberships');
select rls_enabled('invite_codes');
select rls_enabled('songs');
select rls_enabled('setlists');
select rls_enabled('shows');
select rls_enabled('practice_sessions');
select rls_enabled('audit_log');
```

**Policy Existence:**
```sql
-- Users policies
select policies_are('users', ARRAY[
  'users_select_authenticated',
  'users_update_own'
]);

-- Bands policies
select policies_are('bands', ARRAY[
  'bands_insert_any_authenticated',
  'bands_select_members',
  'bands_update_admins'
]);

-- Band memberships policies
select policies_are('band_memberships', ARRAY[
  'memberships_select_if_member',
  'memberships_insert_if_admin',
  'memberships_update_if_admin',
  'memberships_delete_if_admin_or_self'
]);

-- Songs policies
select policies_are('songs', ARRAY[
  'songs_select_if_member_or_creator',
  'songs_insert_if_authenticated',
  'songs_update_if_member',
  'songs_delete_if_creator_or_admin'
]);

-- Setlists policies
select policies_are('setlists', ARRAY[
  'setlists_select_if_member',
  'setlists_insert_if_member',
  'setlists_update_if_member',
  'setlists_delete_if_creator_or_admin'
]);

-- Shows policies
select policies_are('shows', ARRAY[
  'shows_select_if_member',
  'shows_insert_if_member',
  'shows_update_if_member',
  'shows_delete_if_creator'
]);

-- Audit log policies (read-only)
select policies_are('audit_log', ARRAY[
  'audit_log_select_if_member',
  'audit_log_no_insert',
  'audit_log_no_update',
  'audit_log_no_delete'
]);
```

---

#### 007-rls-band-isolation.test.sql

**Purpose:** Validate band members can only access their band's data

**Tests (~20 tests using test helpers):**

```sql
-- Create test users and bands
select tests.create_supabase_user('user1@test.com');
select tests.create_supabase_user('user2@test.com');

-- Create two separate bands
insert into bands (id, name) values
  ('band1-uuid', 'Band 1'),
  ('band2-uuid', 'Band 2');

-- Add user1 to band1
insert into band_memberships (user_id, band_id, role, status) values
  (tests.get_supabase_uid('user1@test.com'), 'band1-uuid', 'admin', 'active');

-- Add user2 to band2
insert into band_memberships (user_id, band_id, role, status) values
  (tests.get_supabase_uid('user2@test.com'), 'band2-uuid', 'admin', 'active');

-- Create songs for each band
insert into songs (id, title, artist, context_type, context_id, created_by) values
  ('song1-uuid', 'Band 1 Song', 'Artist 1', 'band', 'band1-uuid', tests.get_supabase_uid('user1@test.com')),
  ('song2-uuid', 'Band 2 Song', 'Artist 2', 'band', 'band2-uuid', tests.get_supabase_uid('user2@test.com'));

-- Test: user1 can see only band1 songs
select tests.authenticate_as('user1@test.com');
select results_eq(
  'select count(*)::int from songs',
  ARRAY[1],
  'User1 should see only 1 song (their band)'
);

-- Test: user2 can see only band2 songs
select tests.authenticate_as('user2@test.com');
select results_eq(
  'select count(*)::int from songs',
  ARRAY[1],
  'User2 should see only 1 song (their band)'
);

-- Test: users cannot see other bands' data
select tests.authenticate_as('user1@test.com');
select results_eq(
  'select count(*)::int from songs where id = ''song2-uuid''',
  ARRAY[0],
  'User1 should NOT see band2 songs'
);
```

---

#### 008-rls-personal-data.test.sql

**Purpose:** Validate personal songs are private to creator

**Tests (~10 tests):**

```sql
-- Create test users
select tests.create_supabase_user('creator@test.com');
select tests.create_supabase_user('other@test.com');

-- Create personal song
insert into songs (id, title, artist, context_type, context_id, created_by) values
  ('personal-song-uuid', 'My Personal Song', 'Me', 'personal',
   tests.get_supabase_uid('creator@test.com'),
   tests.get_supabase_uid('creator@test.com'));

-- Test: Creator can see their personal song
select tests.authenticate_as('creator@test.com');
select results_eq(
  'select count(*)::int from songs where id = ''personal-song-uuid''',
  ARRAY[1],
  'Creator should see their personal song'
);

-- Test: Other users cannot see personal song
select tests.authenticate_as('other@test.com');
select results_eq(
  'select count(*)::int from songs where id = ''personal-song-uuid''',
  ARRAY[0],
  'Other users should NOT see personal songs'
);
```

---

### 4. Audit Logging Tests

#### 009-audit-logging.test.sql

**Purpose:** Validate audit trail triggers log changes correctly

**Tests (~15 tests):**

```sql
-- Create test band and user
insert into bands (id, name) values ('test-band-uuid', 'Test Band');
select tests.create_supabase_user('testuser@test.com');
insert into band_memberships (user_id, band_id, role, status) values
  (tests.get_supabase_uid('testuser@test.com'), 'test-band-uuid', 'admin', 'active');

select tests.authenticate_as('testuser@test.com');

-- Test INSERT creates audit log
insert into songs (id, title, artist, context_type, context_id, created_by) values
  ('test-song-uuid', 'Test Song', 'Test Artist', 'band', 'test-band-uuid',
   tests.get_supabase_uid('testuser@test.com'));

select results_eq(
  'select count(*)::int from audit_log where table_name = ''songs'' and action = ''INSERT''',
  ARRAY[1],
  'INSERT should create audit log entry'
);

-- Test UPDATE creates audit log with old and new values
update songs set title = 'Updated Title' where id = 'test-song-uuid';

select results_eq(
  'select count(*)::int from audit_log where table_name = ''songs'' and action = ''UPDATE''',
  ARRAY[1],
  'UPDATE should create audit log entry'
);

select is_not_empty(
  'select old_values from audit_log where table_name = ''songs'' and action = ''UPDATE''',
  'Audit log should capture old_values on UPDATE'
);

select is_not_empty(
  'select new_values from audit_log where table_name = ''songs'' and action = ''UPDATE''',
  'Audit log should capture new_values on UPDATE'
);

-- Test DELETE creates audit log
delete from songs where id = 'test-song-uuid';

select results_eq(
  'select count(*)::int from audit_log where table_name = ''songs'' and action = ''DELETE''',
  ARRAY[1],
  'DELETE should create audit log entry'
);
```

---

### 5. Realtime Configuration Tests

#### 010-realtime-config.test.sql

**Purpose:** Validate realtime publication and replica identity

**Tests (~10 tests):**

```sql
-- Test: Tables are in realtime publication
select results_eq(
  $$select tablename::text from pg_publication_tables
    where pubname = 'supabase_realtime'
    order by tablename$$,
  ARRAY['audit_log', 'practice_sessions', 'setlists', 'shows', 'songs'],
  'All 5 sync tables should be in realtime publication'
);

-- Test: Replica identity is FULL
select results_eq(
  $$select relname::text from pg_class
    where relname = 'songs' and relreplident = 'f'$$,
  ARRAY['songs'],
  'Songs should have REPLICA IDENTITY FULL'
);

select results_eq(
  $$select relname::text from pg_class
    where relname = 'setlists' and relreplident = 'f'$$,
  ARRAY['setlists'],
  'Setlists should have REPLICA IDENTITY FULL'
);

select results_eq(
  $$select relname::text from pg_class
    where relname = 'shows' and relreplident = 'f'$$,
  ARRAY['shows'],
  'Shows should have REPLICA IDENTITY FULL'
);

select results_eq(
  $$select relname::text from pg_class
    where relname = 'practice_sessions' and relreplident = 'f'$$,
  ARRAY['practice_sessions'],
  'Practice sessions should have REPLICA IDENTITY FULL'
);

select results_eq(
  $$select relname::text from pg_class
    where relname = 'audit_log' and relreplident = 'f'$$,
  ARRAY['audit_log'],
  'Audit log should have REPLICA IDENTITY FULL'
);
```

---

### 6. Data Integrity Tests

#### 011-data-integrity.test.sql

**Purpose:** Validate data constraints work correctly

**Tests (~20 tests):**

```sql
-- Test: Cannot insert duplicate email
insert into users (id, email, name) values ('user1-uuid', 'test@example.com', 'User 1');

select throws_ok(
  $$insert into users (id, email, name) values ('user2-uuid', 'test@example.com', 'User 2')$$,
  '23505', -- unique_violation
  null,
  'Should not allow duplicate emails'
);

-- Test: Cannot insert invalid email format
select throws_ok(
  $$insert into users (id, email, name) values ('user3-uuid', 'invalid-email', 'User 3')$$,
  '23514', -- check_violation
  null,
  'Should not allow invalid email format'
);

-- Test: Song difficulty must be 1-5
select throws_ok(
  $$insert into songs (title, artist, difficulty, context_type, context_id, created_by)
    values ('Test', 'Artist', 6, 'band', 'band-uuid', 'user-uuid')$$,
  '23514',
  null,
  'Song difficulty must be between 1 and 5'
);

-- Test: Band membership status must be valid
select throws_ok(
  $$insert into band_memberships (user_id, band_id, role, status)
    values ('user-uuid', 'band-uuid', 'member', 'invalid_status')$$,
  '23514',
  null,
  'Band membership status must be valid enum value'
);

-- Test: Foreign key cascade deletes
insert into bands (id, name) values ('test-band-uuid', 'Test Band');
insert into songs (id, title, artist, context_type, context_id, created_by)
  values ('test-song-uuid', 'Test', 'Artist', 'band', 'test-band-uuid', 'user-uuid');

delete from bands where id = 'test-band-uuid';

select results_eq(
  'select count(*)::int from songs where id = ''test-song-uuid''',
  ARRAY[0],
  'Deleting band should cascade delete songs'
);
```

---

## Implementation Guide

### Step 1: Enable pgTAP Extension

**Via Supabase Dashboard:**
1. Navigate to Database page
2. Click Extensions in sidebar
3. Search for "pgtap"
4. Enable the extension

**Via SQL:**
```sql
create extension pgtap with schema extensions;
```

### Step 2: Install Test Helpers (Optional but Recommended)

Add basejump test helpers for easier RLS testing:

```bash
# Add to your project
npm install --save-dev @basejump-dev/supabase-test-helpers
```

Or manually create helper functions in `000-setup-test-helpers.sql`:

```sql
-- Create test schema
create schema if not exists tests;

-- Helper: Create test user
create or replace function tests.create_supabase_user(email text)
returns uuid as $$
declare
  user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, email) values (user_id, email);
  insert into public.users (id, email, name) values (user_id, email, split_part(email, '@', 1));
  return user_id;
end;
$$ language plpgsql;

-- Helper: Authenticate as user
create or replace function tests.authenticate_as(email text)
returns void as $$
declare
  user_id uuid;
begin
  select id into user_id from auth.users where auth.users.email = authenticate_as.email;
  execute format('set request.jwt.claim.sub=%L', user_id);
end;
$$ language plpgsql;

-- Helper: Get user ID
create or replace function tests.get_supabase_uid(email text)
returns uuid as $$
begin
  return (select id from auth.users where auth.users.email = get_supabase_uid.email);
end;
$$ language plpgsql;

-- Helper: Check RLS enabled
create or replace function tests.rls_enabled(table_name text)
returns boolean as $$
begin
  return (
    select relrowsecurity
    from pg_class
    where relname = table_name and relnamespace = 'public'::regnamespace
  );
end;
$$ language plpgsql;
```

### Step 3: Create Test Files

Create each test file in `supabase/tests/` following the templates above.

**Example: 001-schema-tables.test.sql**

```sql
-- Test: Validate all tables exist
-- Purpose: Ensure complete schema is deployed
-- Category: Schema
-- Created: 2025-11-06

begin;

select plan(17);

-- Core tables
select has_table('users', 'users table should exist');
select has_table('user_profiles', 'user_profiles table should exist');
select has_table('bands', 'bands table should exist');
select has_table('band_memberships', 'band_memberships table should exist');
select has_table('invite_codes', 'invite_codes table should exist');

-- Content tables
select has_table('songs', 'songs table should exist');
select has_table('song_groups', 'song_groups table should exist');
select has_table('song_group_memberships', 'song_group_memberships table should exist');
select has_table('setlists', 'setlists table should exist');
select has_table('shows', 'shows table should exist');
select has_table('practice_sessions', 'practice_sessions table should exist');

-- Casting tables
select has_table('song_castings', 'song_castings table should exist');
select has_table('song_assignments', 'song_assignments table should exist');
select has_table('assignment_roles', 'assignment_roles table should exist');
select has_table('casting_templates', 'casting_templates table should exist');
select has_table('member_capabilities', 'member_capabilities table should exist');

-- Audit table
select has_table('audit_log', 'audit_log table should exist');

select * from finish();
rollback;
```

### Step 4: Run Tests Locally

```bash
# Run all tests
supabase test db

# Run with verbose output
supabase test db --verbose

# Run specific test file (not directly supported, but you can filter output)
supabase test db 2>&1 | grep "schema-tables"
```

### Step 5: Review Test Output

**Success output:**
```
1..17
ok 1 - users table should exist
ok 2 - user_profiles table should exist
ok 3 - bands table should exist
...
ok 17 - audit_log table should exist
```

**Failure output:**
```
1..17
ok 1 - users table should exist
not ok 2 - user_profiles table should exist
# Failed test 2: "user_profiles table should exist"
```

---

## Running Tests

### Local Development

**Basic command:**
```bash
supabase test db
```

**With specific database:**
```bash
supabase test db --db-url postgresql://postgres:postgres@localhost:54322/postgres
```

### Test Output Format

pgTAP uses TAP (Test Anything Protocol) output:

```
TAP version 13
1..87
ok 1 - users table should exist
ok 2 - user_profiles table should exist
ok 3 - bands table should exist
...
ok 87 - Audit log captures DELETE operations
```

**Summary:**
- First line: TAP version
- Second line: `1..N` where N is total test count
- Each test: `ok N - description` or `not ok N - description`

### Test Execution Order

Tests run **alphabetically** by filename:
1. `000-setup-test-helpers.sql` (runs first)
2. `001-schema-tables.test.sql`
3. `002-schema-columns.test.sql`
4. ... and so on

---

## CI/CD Integration

### GitHub Actions

**File:** `.github/workflows/database-tests.yml`

```yaml
name: Database Tests

on:
  pull_request:
    paths:
      - 'supabase/**'
  push:
    branches:
      - main

jobs:
  test-database:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local
        run: supabase start

      - name: Run database tests
        run: supabase test db

      - name: Stop Supabase
        if: always()
        run: supabase stop
```

### Pre-commit Hook

**File:** `.git/hooks/pre-commit`

```bash
#!/bin/bash

# Run database tests before allowing commit
echo "Running database tests..."
supabase test db

if [ $? -ne 0 ]; then
  echo "❌ Database tests failed. Commit aborted."
  exit 1
fi

echo "✅ Database tests passed"
exit 0
```

### NPM Script

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:db": "supabase test db",
    "test:all": "npm run test && npm run test:db"
  }
}
```

Usage:
```bash
npm run test:db        # Run database tests only
npm run test:all       # Run all tests (unit + db)
```

---

## Maintenance Strategy

### When to Update Tests

**1. Schema Changes**
- Adding/removing tables → Update `001-schema-tables.test.sql`
- Adding/removing columns → Update `002-schema-columns.test.sql`
- Adding indexes → Update `003-schema-indexes.test.sql`
- Adding constraints → Update `004-schema-constraints.test.sql`

**2. Function/Trigger Changes**
- New functions → Update `005-functions-triggers.test.sql`
- New triggers → Update `005-functions-triggers.test.sql`

**3. RLS Policy Changes**
- New policies → Update `006-rls-policies.test.sql`
- Policy logic changes → Update `007-rls-band-isolation.test.sql` or `008-rls-personal-data.test.sql`

**4. Audit System Changes**
- New audit features → Update `009-audit-logging.test.sql`

**5. Realtime Changes**
- New tables in publication → Update `010-realtime-config.test.sql`

### Test Maintenance Workflow

1. **Update migration** → Make schema change
2. **Update tests** → Add/modify corresponding tests
3. **Run tests locally** → `supabase test db`
4. **Fix failures** → Iterate until passing
5. **Commit together** → Migration + tests in same commit

### Version Tracking

Add to test file headers:
```sql
-- Test: <Name>
-- Version: 1.0
-- Last Updated: 2025-11-06
-- Related Migration: 20251106000000_baseline_schema.sql
```

---

## Benefits of pgTAP Testing

### 1. Schema Validation
- ✅ Catch missing tables/columns before deployment
- ✅ Validate critical field types (e.g., `tempo` not `bpm`)
- ✅ Ensure indexes exist for performance

### 2. RLS Policy Testing
- ✅ Verify band data isolation
- ✅ Test personal data privacy
- ✅ Catch security holes before production

### 3. Regression Prevention
- ✅ Detect breaking changes in migrations
- ✅ Ensure triggers still work after refactoring
- ✅ Validate audit logging integrity

### 4. Documentation
- ✅ Tests serve as schema documentation
- ✅ Show expected behavior clearly
- ✅ Help new developers understand system

### 5. CI/CD Integration
- ✅ Automated testing on every PR
- ✅ Prevent bad migrations from merging
- ✅ Fast feedback loop (<10 seconds)

---

## Estimated Test Coverage

| Category | Test Files | Test Count | Coverage |
|----------|-----------|------------|----------|
| Schema | 4 files | ~167 tests | Tables, columns, indexes, constraints |
| Functions/Triggers | 1 file | ~30 tests | All trigger functions |
| RLS Policies | 3 files | ~80 tests | Policy existence + behavior |
| Audit Logging | 1 file | ~15 tests | Insert/update/delete tracking |
| Realtime | 1 file | ~10 tests | Publication + replica identity |
| Data Integrity | 1 file | ~20 tests | Constraints enforcement |
| **TOTAL** | **11 files** | **~322 tests** | **Comprehensive** |

---

## Next Steps

### Implementation Checklist

- [ ] Enable pgTAP extension in Supabase
- [ ] Create `supabase/tests/` directory
- [ ] Implement `000-setup-test-helpers.sql`
- [ ] Implement `001-schema-tables.test.sql`
- [ ] Implement `002-schema-columns.test.sql`
- [ ] Implement `003-schema-indexes.test.sql`
- [ ] Implement `004-schema-constraints.test.sql`
- [ ] Implement `005-functions-triggers.test.sql`
- [ ] Implement `006-rls-policies.test.sql`
- [ ] Implement `007-rls-band-isolation.test.sql`
- [ ] Implement `008-rls-personal-data.test.sql`
- [ ] Implement `009-audit-logging.test.sql`
- [ ] Implement `010-realtime-config.test.sql`
- [ ] Implement `011-data-integrity.test.sql`
- [ ] Run full test suite: `supabase test db`
- [ ] Add to CI/CD pipeline
- [ ] Document in CLAUDE.md

### Phase 1: Core Schema Tests (Priority: HIGH)
- Files: 001-004 (Schema validation)
- Time: 2 hours
- Value: Immediate schema validation

### Phase 2: RLS & Security Tests (Priority: HIGH)
- Files: 006-008 (RLS policies)
- Time: 2 hours
- Value: Security validation

### Phase 3: Advanced Features (Priority: MEDIUM)
- Files: 005, 009-011 (Triggers, audit, realtime)
- Time: 2 hours
- Value: Feature validation

---

## Conclusion

This pgTAP test suite provides **comprehensive database validation** for Rock-On:

1. **322 automated tests** covering all critical database aspects
2. **Fast execution** (~5-10 seconds for full suite)
3. **CI/CD ready** for automated testing on every PR
4. **Documentation** tests serve as living schema documentation
5. **Regression prevention** catch breaking changes early

**Total implementation time:** 4-6 hours
**Long-term benefit:** Prevented production bugs, faster development, higher confidence

---

**Created:** 2025-11-06T22:35
**Status:** Design Complete - Ready for Implementation
**Next Action:** Enable pgTAP extension and begin Phase 1 implementation
