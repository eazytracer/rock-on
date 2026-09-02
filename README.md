# Rock-On

A band management application for musicians to organize songs, setlists, shows,
and practice sessions — plus jam sessions and venue events.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Supabase and generate environment files (first time only)
npm run setup:local

# 3. Start development (Supabase + edge functions + dev server)
npm run start:dev
```

Your app will be running at http://localhost:5173

`setup:local` dynamically extracts API keys from `supabase status`, so the
generated env files work even if Supabase generates different keys per machine.

## Features

- **Song Library** — catalog with lyrics, chords, tuning, and metadata
- **Setlists** — build and order setlists for performances
- **Shows** — track upcoming and past performances
- **Practice Sessions** — schedule/log practices, with a live session mode
- **Jam Sessions** — impromptu jams; join by code, match songs across catalogs
- **Events** — venue-oriented lineups, RSVP, and casting
- **Band Management** — invite members and collaborate
- **Offline-First** — works offline with automatic sync when connected

## Tech Stack

- **Frontend:** React 18+, TypeScript, TailwindCSS, Vite
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Local Storage:** IndexedDB (Dexie) for offline-first architecture
- **Testing:** Vitest (unit), Playwright (E2E), pgTAP (database)

## Development

### Prerequisites

- Node.js 18+
- Docker (for local Supabase)

### Commands

| Command | Description |
|---------|-------------|
| `npm run setup:local` | First-time setup (Supabase + generate env files) |
| `npm run start:dev` | Start local dev (Supabase + edge functions + server) |
| `npm run start:staging` | Start with remote Supabase |
| `npm run env:status` | Check active environment |
| `npm run supabase:studio` | Open the database UI |
| `npm run dev` | Dev server only |
| `npm run build` | Build for production |
| `npm run test` | Unit + integration tests |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run test:all` | All tests (app + database) |

Full test layout: `tests/README.md`. Environment guide: `ENVIRONMENTS.md`.

### Environment Modes

| Mode | Use When | Supabase | Email Confirmations |
|------|----------|----------|---------------------|
| Development | Daily coding | Local | Disabled |
| Staging | Testing before deploy | Remote | Enabled |
| Test | CI/CD, automated tests | Local | Mock |
| Production | Deployed app | Remote | Enabled |

### Local URLs

- App: http://localhost:5173
- Supabase Studio: http://127.0.0.1:54323
- Supabase API: http://127.0.0.1:54321
- Mailpit (emails): http://127.0.0.1:54324

### Troubleshooting

```bash
npm run supabase:status   # Is Supabase running?
npm run supabase:start    # Start it if stopped
npm run start:dev         # "Email not confirmed"? → switch to local Supabase
npm run supabase:reset    # Reset the local database
npm run env:status        # Lost track of which environment is active?
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) — coding rules and project policy
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — how we build (agent workflow)
- [ENVIRONMENTS.md](./ENVIRONMENTS.md) — environment configuration
- Database schema: `.claude/specifications/unified-database-schema.md`

## Project Structure

```
rock-on/
├── src/                    # Application source
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── services/           # Business logic
│   │   ├── auth/           # Authentication
│   │   ├── data/           # Data sync (offline-first)
│   │   └── supabase/       # Supabase client
│   └── models/             # TypeScript types
├── supabase/               # Supabase configuration
│   ├── migrations/         # Database migrations
│   └── tests/              # Database tests (pgTAP)
├── tests/                  # Application tests (unit, e2e, integration)
└── scripts/                # Helper scripts
```

## License

Private - All rights reserved
