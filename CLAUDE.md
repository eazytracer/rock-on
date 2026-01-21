# rock-on Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-27

## Active Technologies

- TypeScript 5.x with React 18+ + React, TailwindCSS, client-side database (TBD) (001-use-this-prd)

## Project Structure

```
src/
  ├── config/          # App configuration (mode detection)
  ├── services/
  │   ├── data/        # Repository pattern & sync engine
  │   ├── auth/        # Authentication services
  │   └── supabase/    # Supabase client
  └── ...
tests/
  ├── unit/            # Unit tests (mirror src/ structure)
  │   ├── config/
  │   └── services/
  ├── integration/     # Integration tests
  ├── e2e/             # End-to-end tests (Playwright)
  └── contract/        # API contract tests
```

## Commands

### Testing Commands (REQUIRED)

**Run tests before AND after all code changes:**

```bash
# Run application tests (unit, integration)
npm test

# Quick tests for fast feedback (components, hooks, contexts ~2s)
npm run test:quick

# Run specific test categories
npm run test:unit        # All unit tests
npm run test:services    # Service layer tests only
npm run test:integration # Integration tests

# Run specific test file
npm test -- tests/unit/services/data/SyncRepository.test.ts

# Run tests in a directory
npm test -- tests/unit/services/

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run database tests (pgTAP schema validation)
npm run test:db

# Run E2E tests (Playwright)
npm run test:e2e              # Run all E2E tests
npm run test:e2e:ui           # Run with interactive UI
npm run test:e2e:debug        # Run in debug mode
npm run test:e2e:report       # View test report

# Run all tests (application + database + E2E)
npm run test:all
```

**E2E Test Prerequisites:**

- ✅ Local Supabase must be running: `supabase start`
- ✅ Development environment must be active: `npm run env:dev`
- ✅ Dev server should be running: `npm run dev` (Playwright starts it automatically)

**Quick E2E Setup:**

```bash
# Ensure local Supabase is running and environment is configured
npm run start:dev  # Starts Supabase + sets dev env + runs dev server

# In another terminal, run E2E tests
npm run test:e2e
```

**See `/workspaces/rock-on/ENVIRONMENTS.md` for full environment management guide**

### Other Commands

```bash
npm run lint       # Lint code
npm run type-check # TypeScript type checking
npm run dev        # Start development server
npm run build      # Build for production
```

### Local Development Setup

```bash
# First time setup (generates .env.development and .env.test from local Supabase)
npm run setup:local

# This command:
# - Starts local Supabase if not running
# - Extracts API keys from supabase status
# - Generates .env.development with local config
# - Generates .env.test with service role key for E2E tests
```

### Supabase Commands

```bash
# See /supabase command for full reference
npx supabase start     # Start local Supabase
npx supabase db reset  # Reset local database
npx supabase db push   # Apply migrations locally

# Remote operations (requires .env.supabase.local with SUPABASE_ACCESS_TOKEN)
source .env.supabase.local && supabase link --project-ref khzeuxxhigqcmrytsfux
source .env.supabase.local && supabase migration list  # Check remote status
source .env.supabase.local && supabase db push --linked  # Apply to remote
```

## Code Style

TypeScript 5.x with React 18+: Follow standard conventions

### Date/Time Handling (CRITICAL)

**🚨 TWO common timezone bugs to avoid:**

**Bug 1: Displaying dates - NEVER use `toISOString().split('T')[0]`**

This causes off-by-one date bugs because `toISOString()` converts to UTC first:

- Example: Dec 15 11pm EST → Dec 16 4am UTC → displays as "Dec 16" (WRONG!)

```typescript
// ❌ WRONG - causes timezone bugs when displaying
const dateStr = new Date(date).toISOString().split('T')[0]

// ✅ CORRECT - uses local timezone
import { formatDateForInput } from '../utils/dateHelpers'
const dateStr = formatDateForInput(date)
```

**Bug 2: Parsing dates - NEVER use `new Date("YYYY-MM-DD")`**

This parses as UTC midnight, which becomes the previous day in timezones west of UTC:

- Example: `new Date("2024-12-20")` → Dec 19 7pm EST (WRONG!)

```typescript
// ❌ WRONG - parses as UTC, causes off-by-one when storing
const baseDate = new Date(formData.date)

// ✅ CORRECT - parses as local timezone
import { parseDateInputAsLocal } from '../utils/dateHelpers'
const baseDate = parseDateInputAsLocal(formData.date)
```

**When to use each helper:**

- `formatDateForInput(date)` - Display date in `<input type="date">` (YYYY-MM-DD)
- `parseDateInputAsLocal(dateStr)` - Parse YYYY-MM-DD string as LOCAL time
- `formatDateTimeForInput(date)` - For `<input type="datetime-local">` value
- `formatShowDate(date)` - For display ("Dec 8, 2025")
- `formatTime12Hour(date)` - For display ("8:00 PM")
- `parseTime12Hour(timeStr, baseDate)` - Parse "8:00 PM" and combine with base date

### Testability Standards (REQUIRED)

**All form inputs and interactive elements must include testability attributes:**

**Form Inputs (`<input>`, `<textarea>`, `<select>`):**

- `name` attribute - For form functionality
- `id` attribute - For label association (`<label htmlFor="id">`)
- `data-testid` attribute - For E2E testing

**Buttons and Interactive Elements:**

- `data-testid` attribute - For E2E testing

**Example:**

```tsx
<InputField
  label="Email"
  name="email"                    // Form functionality
  id="login-email"                // Label association
  data-testid="login-email-input" // E2E testing
  type="email"
  value={email}
  onChange={setEmail}
/>

<Button
  type="submit"
  data-testid="login-submit-button"
>
  Log In
</Button>
```

**Naming Conventions:**

- `id`: kebab-case (`login-email`, `band-name`)
- `name`: camelCase (`email`, `bandName`)
- `data-testid`: `{context}-{field}-{type}` (`login-email-input`, `create-band-button`)

**Benefits:** Stable E2E tests, better accessibility, browser autofill, password manager support

**Full Reference:** `.claude/specifications/2025-10-22T14:01_design-style-guide.md` (Testability Standards section)

### System Dialogs & Scrollbars (PROHIBITED)

**🚨 NEVER use native browser dialogs or scrollbars:**

```typescript
// ❌ WRONG - Never use native dialogs
alert('Something happened')
confirm('Are you sure?')
prompt('Enter name:')

// ✅ CORRECT - Use themed components
import { useToast } from '../contexts/ToastContext'
const { showToast } = useToast()
showToast('Something happened', 'success')

// ✅ CORRECT - Use ConfirmDialog for confirmations
import { useConfirm } from '../hooks/useConfirm'
import { ConfirmDialog } from '../components/common/ConfirmDialog'

const { confirm, dialogProps } = useConfirm()
const confirmed = await confirm({
  title: 'Delete Item',
  message: 'Are you sure?',
  variant: 'danger',
  confirmLabel: 'Delete',
})
// Render <ConfirmDialog {...dialogProps} /> in your component
```

**Scrollbars - Always use custom styling:**

```tsx
// ❌ WRONG - Native scrollbar
<div className="overflow-y-auto">...</div>

// ✅ CORRECT - Themed scrollbar
<div className="overflow-y-auto custom-scrollbar">...</div>
// or for compact areas:
<div className="overflow-y-auto custom-scrollbar-thin">...</div>
```

**Why?**

- Native dialogs cannot be styled to match our dark theme
- They block the entire browser, not just the app
- They cannot be tested reliably in E2E tests
- They provide poor UX on mobile devices
- Native scrollbars break the visual design

### Logging

**Use the environment-aware logger instead of `console.*` calls:**

```typescript
// ❌ WRONG - console.log shows in production
console.log('Debug info')

// ✅ CORRECT - Use namespaced logger
import { createLogger } from '../utils/logger'
const log = createLogger('MyComponent')

log.debug('Detailed info') // Dev only
log.info('User action') // Dev + test
log.warn('Recoverable issue') // Dev + test
log.error('Failure', error) // Always logged
```

**Log levels by environment:**

| Level   | Dev | Test | Prod |
| ------- | --- | ---- | ---- |
| `debug` | ✅  | ❌   | ❌   |
| `info`  | ✅  | ✅   | ❌   |
| `warn`  | ✅  | ✅   | ❌   |
| `error` | ✅  | ✅   | ✅   |

**Full Reference:** `.claude/specifications/logging.md`

## Database Setup & Migration Policy

### Fresh Installation (New Supabase Project)

**Local Development:**

```bash
# 1. Install dependencies
npm install

# 2. Start Supabase and generate environment files
npm run setup:local

# 3. Start development (sets env + starts server)
npm run start:dev

# That's it! The setup:local script handles:
# - Starting local Supabase
# - Generating .env.development with correct API keys
# - Generating .env.test for E2E testing
```

**Manual Setup (if needed):**

```bash
# 1. Start local Supabase
npx supabase start

# 2. Apply baseline migration
npx supabase db push

# 3. Verify
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
# Should see: 17 tables
```

**Remote (Production/Staging):**

```bash
# 1. Ensure .env.supabase.local exists with valid SUPABASE_ACCESS_TOKEN
# Token expires: Check file for expiration date
# Get new token: https://supabase.com/dashboard/account/tokens

# 2. Link to remote project
source .env.supabase.local && supabase link --project-ref khzeuxxhigqcmrytsfux

# 3. Apply baseline migration
source .env.supabase.local && supabase db push --linked

# 4. Verify via Supabase Studio
# Go to: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux/editor
```

**What's included in baseline migration:**

- ✅ All 17 tables (users, bands, songs, setlists, shows, etc.)
- ✅ Version tracking (`version`, `last_modified_by` columns)
- ✅ Audit log system (complete change history)
- ✅ RLS policies (security)
- ✅ Realtime sync (5 tables enabled)
- ✅ All triggers and indexes

**Migration file:** `supabase/migrations/20251106000000_baseline_schema.sql`

### Existing Database (Already Migrated)

**Do nothing!** Old migrations already applied. Continue using incremental migrations for future changes.

### Migration Policy: Pre-1.0 vs Post-1.0

**🚨 CRITICAL: Pre-1.0 Development (Current State)**

**DO NOT create new migration files for schema changes during pre-1.0 development!**

Instead, modify the baseline migration directly:

```bash
# For schema changes during pre-1.0 development:
# 1. Edit the baseline migration file directly
vim supabase/migrations/20251106000000_baseline_schema.sql

# 2. Test locally
supabase db reset  # Applies baseline from scratch

# 3. Run tests
npm run test:db    # Verify schema is correct

# 4. Commit the updated baseline
git add supabase/migrations/20251106000000_baseline_schema.sql
git commit -m "Update baseline schema: [description]"
```

**Why?** During pre-1.0 development:

- No production database exists yet
- Every `supabase db reset` applies migrations from scratch
- Multiple patch migrations slow down development and testing
- Easier to maintain one canonical schema file
- New team members get working schema immediately

**After 1.0 Release:**

Once version 1.0 is released and production databases exist, switch to incremental migrations:

```bash
# For schema changes after 1.0 release:
supabase migration new add_feature_name
# Edit the new migration file
supabase db reset  # Test locally
supabase db push   # Deploy to remote
```

### Migration Archive

**Archived incremental migrations:**

- `archive/` - Original 1-17 migrations (2025-10-25 to 2025-11-05)
- `archive/patches-2025-11-07/` - Patch migrations (5 files) consolidated into baseline

**Archive contents:**

- Kept for historical reference
- Shows schema evolution during development
- Can be referenced to understand why changes were made
- DO NOT apply these - all changes are in the baseline

## Database Schema Reference

**CRITICAL**: When working with database tables and columns, ALWAYS reference the authoritative schema documentation. Never guess table or column names.

### 🚨 SCHEMA VALIDATION RULES 🚨

**BEFORE making any schema changes, you MUST:**

1. **Read the schema spec**: `.claude/specifications/unified-database-schema.md`
2. **Check baseline migration**: `supabase/migrations/20251106000000_baseline_schema.sql`
3. **Check actual Supabase tables**:
   - Use Supabase Studio UI (if local Supabase is running)
   - Look at RemoteRepository field mappings
4. **Test locally first**: `supabase db reset` to verify migration works
5. **Validate field names match**:
   - IndexedDB: `camelCase`
   - Supabase: `snake_case`
   - Example: `lastModified` ↔ `last_modified` (NOT `updated_date`)

**NEVER:**

- ❌ Assume a column exists without checking
- ❌ Use `updated_date` for setlists (use `last_modified`)
- ❌ Copy field mappings from one table to another without verification
- ❌ Create a trigger without checking column names
- ❌ Modify the baseline migration (create new incremental migrations instead)

### Unified Database Schema

**File:** `.claude/specifications/unified-database-schema.md` ⭐ **USE THIS**

**This is the ONLY authoritative source** for database operations. It documents:

- Both IndexedDB (camelCase) and Supabase (snake_case) side-by-side
- Field name mappings between systems
- Repository layer translation logic
- Critical differences (e.g., `bpm` ↔ `tempo`, `practice_sessions` table name)

**Quick Reference:**

- **Application/IndexedDB:** camelCase (`userId`, `createdDate`, `bandMemberships`)
- **Supabase/PostgreSQL:** snake_case (`user_id`, `created_date`, `band_memberships`)
- **Repository Layer:** Automatically converts between conventions

**Critical Table-Specific Fields:**

| Table               | Timestamp Column | Notes                                  |
| ------------------- | ---------------- | -------------------------------------- |
| `songs`             | `updated_date`   | Uses updated_date ✓                    |
| `bands`             | `updated_date`   | Uses updated_date ✓                    |
| `setlists`          | `last_modified`  | Uses last_modified (NOT updated_date!) |
| `practice_sessions` | `created_date`   | No update timestamp                    |
| `band_memberships`  | `joined_date`    | No update timestamp                    |

**Critical Table Names:**

- ✅ Supabase: `practice_sessions` (with underscore)
- ❌ NOT: `practices`

**Critical Field Differences:**

- IndexedDB `bpm` ↔ Supabase `tempo`
- IndexedDB camelCase ↔ Supabase snake_case
- Songs use `context_id` (TEXT in Supabase), not `band_id`
- Setlists use `last_modified` (NOT `updated_date`)
- Setlists have `items` JSONB column for songs/breaks/sections

## Testing Policy

**CRITICAL**: Always run tests before and after making changes:

1. **Before starting work**: Run `npm run start:test` to ensure all tests pass
2. **After making changes**: Run tests for affected areas
3. **Before committing**: Run full test suite (`npm run start:test`)

**Current Test Status** (as of 2025-11-20):

- 491 passing tests across 25 test files
- 64 failing tests across 8 test files (under investigation)
- Primary issue: Journey tests require Supabase environment setup

**Test Organization**:

- All tests in `tests/` directory (NOT in `src/__tests__/`)
- Unit tests: `tests/unit/` (mirror `src/` structure) - 23 files
- Integration tests: `tests/integration/` - 1 file
- Journey tests: `tests/journeys/` - 4 files (require Supabase)
- Contract tests: `tests/contract/` - 3 files (require Supabase)
- E2E tests: `tests/e2e/` - 11 files (Playwright)
- Database tests: `supabase/tests/` - 11 files (pgTAP)

**Test Execution Guide**: See `.claude/setup/TESTING-ENVIRONMENT-SETUP.md` for detailed test type requirements and execution instructions.

### Database Testing (pgTAP)

Rock-On uses pgTAP for comprehensive database schema validation. Tests validate:

- ✅ Schema integrity (tables, columns, indexes, constraints)
- ✅ RLS policies (row-level security)
- ✅ Triggers & functions (version tracking, audit logging)
- ✅ Data integrity (foreign keys, check constraints)
- ✅ Realtime configuration

**Running Database Tests:**

```bash
npm run test:db           # Run database tests only
npm run test:all          # Run all tests (app + database)
supabase test db          # Direct command
```

**Test Files:** `supabase/tests/*.test.sql`

- `000-setup-test-helpers.sql` - Helper functions for testing
- `001-schema-tables.test.sql` - Table existence (17 tests)
- `002-schema-columns.test.sql` - Column validation (81 tests)
- `003-schema-indexes.test.sql` - Index validation (29 tests)
- `004-schema-constraints.test.sql` - Constraint validation (42 tests)
- `005-functions-triggers.test.sql` - Function/trigger validation (29 tests)
- `006-rls-policies.test.sql` - RLS policy existence (71 tests)
- `007-011` - RLS behavior, audit logging, realtime, data integrity

**Test Status:** Schema validation tests (001-005) passing. RLS and integration tests (006-011) have known issues due to:

- Seed data contamination (existing test data interfering with tests)
- Schema design issues (audit_log FK constraints, trigger on columns that don't exist)
- Personal songs + audit_log FK incompatibility

**When to Run Database Tests:**

- ✅ After modifying migrations
- ✅ After schema changes
- ✅ Before deploying to production
- ✅ When RLS policies change
- ✅ When adding/modifying triggers

## Authentication Flow

### Session Validation

The app uses a multi-layer authentication check with persistent layout:

1. **useAuthCheck hook** (`src/hooks/useAuthCheck.ts`)
   - Validates localStorage keys (`currentUserId`, `currentBandId`)
   - Checks session from `SessionManager.loadSession()`
   - Applies **1.5-hour grace period** for expired sessions
   - Cleans up stale localStorage on invalid sessions
   - Re-runs on every route change to catch expired sessions
   - Only shows loading spinner on initial mount (prevents flicker during navigation)

2. **ProtectedLayoutRoute** (`src/components/layout/ProtectedLayoutRoute.tsx`)
   - Combines authentication check with persistent layout
   - Shows full-screen loading spinner only on initial auth check
   - Wraps all protected routes in `ModernLayout` with `<Outlet />`
   - Redirects BEFORE rendering layout if unauthenticated:
     - `no-user` → `/auth`
     - `no-band` → `/auth?view=get-started`
     - `session-expired` → `/auth?reason=session-expired`
     - `session-invalid` → `/auth?reason=session-invalid`

3. **ContentLoadingSpinner** (`src/components/common/ContentLoadingSpinner.tsx`)
   - Used by individual pages for content-area-only loading states
   - Keeps sidebar/navbar visible while page content loads
   - Provides dark theme background matching the app

4. **SessionExpiredModal** (`src/components/auth/SessionExpiredModal.tsx`)
   - Handles session expiry detected by AuthContext
   - Shows toast notification and redirects to `/auth`
   - Does NOT show a modal overlay (redirect-only)

### Persistent Layout Architecture

The layout uses React Router's nested routes pattern:

```tsx
// In App.tsx
<Route element={<ProtectedLayoutRoute />}>
  <Route path="/songs" element={<SongsPage />} />
  <Route path="/setlists" element={<SetlistsPage />} />
  {/* ... other protected routes */}
</Route>
```

**Benefits:**

- Sidebar and navbar persist during navigation (no remount)
- No white screen flicker when changing pages
- Content loading happens in the main content area only
- True SPA feel with smooth transitions

**Individual pages should:**

- NOT import or wrap with `ModernLayout` (it's in ProtectedLayoutRoute)
- Use `ContentLoadingSpinner` for loading states
- Have `data-testid="<page-name>-page"` on root div

### Grace Period

Sessions have a **1.5-hour grace period** after expiry to allow:

- Brief offline periods during gigs/practices
- Token refresh delays
- Network connectivity issues

After the grace period, users must re-authenticate.

### Key Files

| File                                              | Purpose                          |
| ------------------------------------------------- | -------------------------------- |
| `src/hooks/useAuthCheck.ts`                       | Unified auth validation hook     |
| `src/components/layout/ProtectedLayoutRoute.tsx`  | Auth + persistent layout wrapper |
| `src/components/common/ContentLoadingSpinner.tsx` | Content-area loading spinner     |
| `src/components/auth/SessionExpiredModal.tsx`     | Session expiry redirect handler  |
| `src/contexts/AuthContext.tsx`                    | Auth state management            |
| `src/services/auth/SessionManager.ts`             | Session storage and validation   |

## Recent Changes

- 2026-01-19: Persistent layout - ProtectedLayoutRoute wraps all protected routes with ModernLayout, eliminating white screen flicker during navigation
- 2026-01-19: ContentLoadingSpinner component for content-area-only loading states
- 2026-01-19: Removed old ProtectedRoute component (replaced by ProtectedLayoutRoute)
- 2026-01-17: Improved auth flow - useAuthCheck hook with grace period, simplified SessionExpiredModal (redirect-only)
- 2026-01-17: Test performance optimization - parallel threads, split test scripts (test:quick, test:unit, etc.)
- 2026-01-17: Added E2E tests for session expiry scenarios (53 tests across all browsers)
- 2025-11-07: Implemented pgTAP database test suite (269 tests covering schema, RLS, triggers, audit logging)
- 2025-11-06: Consolidated 17 migrations into single baseline (supabase/migrations/20251106000000_baseline_schema.sql)
- 2025-10-25: Phase 1 Supabase sync complete (73 tests passing)
- 2025-10-25: All remaining tasks planned with detailed implementation guides
- 001-use-this-prd: Added TypeScript 5.x with React 18+ + React, TailwindCSS, client-side database

<!-- MANUAL ADDITIONS START -->

## Artifact Creation

**Artifacts are documentation files only - NOT code, scripts, or configuration files.**

### What Gets Timestamped (Artifacts)

Artifacts are stored in `.claude/artifacts/` and include:

- Design documents
- Architecture specifications
- Implementation summaries
- Planning documents
- PRDs and feature specs
- Status reports and summaries

**Naming convention:** `YYYY-MM-DDTHH:mm_{filename}.md`

**Creation process:**

1. Run `date +%Y-%m-%dT%H:%M` to get current timestamp
2. Create file with timestamp prefix (e.g., `2025-11-07T21:30_migration-consolidation-summary.md`)
3. Include frontmatter with timestamp and prompt summary
4. When updating, add new timestamp to frontmatter as "appended time"

### What DOES NOT Get Timestamped (Code/Scripts)

The following should use standard naming conventions WITHOUT datetime prefixes:

- ✅ Source code files (`.ts`, `.tsx`, `.js`, etc.)
- ✅ Test files (`.test.ts`, `.test.sql`, etc.)
- ✅ Configuration files (`.json`, `.yml`, `.toml`, etc.)
- ✅ Scripts (`.sh`, `.sql`, utility scripts)
- ✅ SQL seed files (`seed-mvp-data.sql`)

**Note on Migration Files:**
Migration files DO use timestamps, but in Supabase's special format (`YYYYMMDDHHmmss_description.sql`) for ordering purposes. This is a Supabase convention, not the artifact datetime prefix pattern. During pre-1.0 development, modify the baseline directly rather than creating new migrations.

**Example:**

```
✅ Correct (artifact):     .claude/artifacts/2025-11-07T21:30_consolidation-summary.md
✅ Correct (test):         supabase/tests/007-rls-band-isolation.test.sql
✅ Correct (code):         src/services/data/SyncEngine.ts
✅ Correct (script):       scripts/setup-dev.sh
✅ Correct (seed):         supabase/seed-mvp-data.sql
❌ Wrong (code):           src/services/data/2025-11-07T21:30_SyncEngine.ts
❌ Wrong (test):           supabase/tests/2025-11-07T21:30_rls-test.test.sql
```

## Agent File Creation (CRITICAL)

**Sub-agents (Task tool) cannot persist files to the filesystem directly.**

When a sub-agent attempts to create files (especially in `.claude/` directories), the file operations shown in the agent's output are **internal to that agent's context** and do NOT actually create files on disk.

**After any agent attempts to create a file, you MUST:**

1. Verify the file exists: `ls -la <path>` or check with the Read tool
2. If the file doesn't exist, create the directory and write the file yourself
3. Use the content from the agent's output to populate the file

**Example workflow:**

```bash
# Agent reports creating: .claude/active-work/issues/my-issue/diagnosis.md

# Step 1: Verify (will likely fail)
ls -la .claude/active-work/issues/my-issue/

# Step 2: Create directory if missing
mkdir -p .claude/active-work/issues/my-issue/

# Step 3: Write the file using the agent's content
# Use the Write tool with content from agent output
```

**Why this happens:**

- Sub-agents run in isolated contexts
- Their file operations are simulated within their execution
- Only the parent conversation can persist files to the actual filesystem
- This is by design for security and isolation

**Directories commonly affected:**

- `.claude/active-work/` - Diagnosis reports, research docs
- `.claude/artifacts/` - Design documents, summaries
- `.claude/features/` - Feature plans and specs

<!-- MANUAL ADDITIONS END -->

- please do not suggest skipping tests or addressing them later. If it was important enough to make the test case then it should pass. If they are truly frivolous we should delete them. When asked to address test findings you should always work to fix the source code after validating the test is correct and necessary.
- We need to be using unique and logical identifiers for our viewport elements to assist in e2e testing and observability. If you are working on e2e tests and find an element that you need to check for that does not have an id, do not use alternative methods to find it, instead add an id to the element. If this causes significant changes, draft an artifact explaining what needs to be changed and prompt the user to have another agent apply the fixes
