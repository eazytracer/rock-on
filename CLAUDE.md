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
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/services/data/SyncRepository.test.ts

# Run tests in a directory
npm test -- tests/unit/services/

# Run tests in watch mode (for development)
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Other Commands
```bash
npm run lint       # Lint code
npm run type-check # TypeScript type checking
npm run dev        # Start development server
npm run build      # Build for production
```

## Code Style
TypeScript 5.x with React 18+: Follow standard conventions

## Database Schema Reference

**CRITICAL**: When working with database tables and columns, ALWAYS reference the authoritative schema documentation. Never guess table or column names.

### 🚨 SCHEMA VALIDATION RULES 🚨

**BEFORE making any schema changes, you MUST:**

1. **Read the schema spec**: `.claude/specifications/unified-database-schema.md`
2. **Check actual Supabase tables**:
   - Use Supabase Studio UI (if local Supabase is running)
   - Check existing migrations in `supabase/migrations/`
   - Look at RemoteRepository field mappings
3. **Test locally first** (if Supabase local is set up - see `.claude/setup/SUPABASE-LOCAL-SETUP.md`)
4. **Validate field names match**:
   - IndexedDB: `camelCase`
   - Supabase: `snake_case`
   - Example: `lastModified` ↔ `last_modified` (NOT `updated_date`)

**NEVER:**
- ❌ Assume a column exists without checking
- ❌ Use `updated_date` for setlists (use `last_modified`)
- ❌ Copy field mappings from one table to another without verification
- ❌ Create a trigger without checking column names

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

| Table | Timestamp Column | Notes |
|-------|-----------------|-------|
| `songs` | `updated_date` | Uses updated_date ✓ |
| `bands` | `updated_date` | Uses updated_date ✓ |
| `setlists` | `last_modified` | Uses last_modified (NOT updated_date!) |
| `practice_sessions` | `created_date` | No update timestamp |
| `band_memberships` | `joined_date` | No update timestamp |

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

1. **Before starting work**: Run `npm test` to ensure all tests pass
2. **After making changes**: Run tests for affected areas
3. **Before committing**: Run full test suite (`npm test`)

**Current Test Status**: 73 passing (sync infrastructure), 13 failing (hooks/utils - unrelated to sync)

**Test Organization**:
- All tests in `tests/` directory (NOT in `src/__tests__/`)
- Unit tests mirror `src/` structure
- Integration tests in `tests/integration/`
- E2E tests in `tests/e2e/`

## Recent Changes
- 2025-10-25: Phase 1 Supabase sync complete (73 tests passing)
- 2025-10-25: All remaining tasks planned with detailed implementation guides
- 001-use-this-prd: Added TypeScript 5.x with React 18+ + React, TailwindCSS, client-side database

<!-- MANUAL ADDITIONS START -->
## Artifact creation
Whenever instructed to generate an artifact, assume the file will be stored in @.claude/artifacts unless explicitly stated otherwise. Create every artifact by running the bash command to get the current datetime and prepend the filename with a timestamp in the "YYYY-MM-DDTHH:mm_{filename}.md" format. Include frontmatter in the artifact that also includes the timestamp and a brief summary of the prompt you were given to make the artifact. When modifying an existing artifact, update the timestamp in the filename and add the new timestamp to the frontmatter as an "appended time" and provide secondary context as the nature of what was updated, do not overwrite the original frontmatter
<!-- MANUAL ADDITIONS END -->