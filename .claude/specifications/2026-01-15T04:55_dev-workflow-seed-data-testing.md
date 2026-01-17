# Development Workflow, Seed Data & Testing

**Created:** 2026-01-15T04:55
**Status:** Active - Source of Truth

---

## Quick Start

```bash
# First time setup
npm install
npm run setup:local    # Starts Supabase, generates .env files

# Daily development
npm run start:dev      # Starts Supabase + dev server

# Reset database (if needed)
supabase db reset      # Reapplies migrations + seed data
```

---

## Seed Data

### Source File

**`supabase/seed-mvp-data.sql`** - Single source of truth for all seed data.

Configured in `supabase/config.toml`:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed-mvp-data.sql"]
```

### Test Users

| Name          | Email                 | Password  | Role   |
| ------------- | --------------------- | --------- | ------ |
| Eric Johnson  | `eric@testband.demo`  | `test123` | Admin  |
| Mike Thompson | `mike@testband.demo`  | `test123` | Member |
| Sarah Chen    | `sarah@testband.demo` | `test123` | Member |

**Fixed UUIDs** (for reproducible testing):

- Eric: `6ee2bc47-0014-4cdc-b063-68646bb5d3ba`
- Mike: `a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d`
- Sarah: `b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e`

### Seeded Data Includes

- 3 users with auth identities (email/password login works)
- 1 band: "Demo Band"
- 3 band memberships
- 1 invite code: `ROCK2025`
- 45 songs (with guitar tunings and detailed notes)
- 4 setlists (with items JSONB - songs, breaks, sections)
- 6 shows (4 upcoming, 2 past)
- 7 practice sessions (5 upcoming, 2 past)

### Song Details

Songs include various guitar tunings:

- **Standard** (E-A-D-G-B-E)
- **Drop D** (D-A-D-G-B-E)
- **Eb Standard** (half step down)
- **D Standard** (whole step down)

Many songs have detailed markdown notes with:

- Song structure breakdown
- Tuning instructions
- Band member-specific notes
- Lyrics excerpts

### Setlists

| Name                   | Items | Description                      |
| ---------------------- | ----- | -------------------------------- |
| Friday Night Rock Show | 18    | Standard 90-minute bar gig set   |
| Acoustic Night         | 8     | Stripped down intimate venue set |
| Party Mix - Short Set  | 7     | 45-minute high energy party set  |
| 90s Night Special      | 15    | Themed 90s hits set              |

### Schedule

**Upcoming Shows (90+ days out):**

- Spring Break Bash (April 18)
- Memorial Day Festival (May 25)
- Summer Solstice Party (June 20)
- 4th of July Celebration (July 4)

**Upcoming Practices:**

- Spring Break Prep sessions (April)
- Festival Prep (May)
- Summer Solstice run-through (June)
- 4th of July special practice (June)

---

## Development Commands

### Environment Management

```bash
npm run setup:local     # First-time setup (generates .env files)
npm run env:dev         # Switch to development environment
npm run env:staging     # Switch to staging environment
npm run env:test        # Switch to test environment
npm run env:status      # Show current environment
```

### Running the App

```bash
npm run start:dev       # Full startup (Supabase + env + server)
npm run dev             # Just the Vite dev server
```

### Database

```bash
supabase start          # Start local Supabase
supabase stop           # Stop local Supabase
supabase status         # Check status
supabase db reset       # Reset DB with migrations + seed
supabase studio         # Open Supabase Studio (http://localhost:54323)
```

---

## Testing

### Test Commands

```bash
npm test                # Unit tests (Vitest)
npm run test:db         # Database tests (pgTAP)
npm run test:e2e        # E2E tests (Playwright)
npm run test:all        # All tests
```

### Test Types

| Type     | Command            | Requires Supabase | Description               |
| -------- | ------------------ | ----------------- | ------------------------- |
| Unit     | `npm test`         | No                | Fast, isolated tests      |
| Database | `npm run test:db`  | Yes               | Schema validation (pgTAP) |
| E2E      | `npm run test:e2e` | Yes               | Browser-based tests       |

### E2E Test Notes

- E2E tests create **fresh users via signup** - they don't use seeded test users
- This ensures tests are isolated and don't depend on seed data state
- Seeded users are for **manual testing** and **quick login buttons** in dev mode

### Quick Login (Dev Mode Only)

In development mode, the login page shows quick login buttons for test users.
These use the seeded users from `seed-mvp-data.sql`.

---

## Local Supabase URLs

| Service          | URL                                                     |
| ---------------- | ------------------------------------------------------- |
| API              | http://127.0.0.1:54321                                  |
| Studio           | http://127.0.0.1:54323                                  |
| Inbucket (Email) | http://127.0.0.1:54324                                  |
| Database         | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

---

## Troubleshooting

### Can't log in with test users

```bash
supabase db reset    # Re-seeds the database including auth.identities
```

### Supabase not starting

```bash
docker ps            # Check if Docker is running
supabase stop        # Stop any stuck containers
supabase start       # Start fresh
```

### Environment issues

```bash
npm run env:status   # Check current environment
npm run setup:local  # Regenerate .env files
```

---

## File Reference

| File                         | Purpose                             |
| ---------------------------- | ----------------------------------- |
| `supabase/config.toml`       | Supabase configuration              |
| `supabase/seed-mvp-data.sql` | Seed data (test users, sample data) |
| `supabase/migrations/*.sql`  | Database migrations                 |
| `.env.development`           | Development environment variables   |
| `.env.test`                  | Test environment variables          |
| `scripts/setup-local-env.sh` | Generates .env files from Supabase  |
| `scripts/env-setup.sh`       | Switches between environments       |
