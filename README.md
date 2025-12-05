# Rock-On

A band management application for musicians to organize songs, setlists, shows, and practice sessions.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Supabase and generate environment files
npm run setup:local

# 3. Start development server
npm run start:dev
```

Your app will be running at http://localhost:5173

See [QUICKSTART.md](./QUICKSTART.md) for more details.

## Features

- **Song Library** - Manage your band's song catalog with lyrics, chords, and metadata
- **Setlists** - Create and organize setlists for performances
- **Shows** - Track upcoming and past performances
- **Practice Sessions** - Log practice sessions and track progress
- **Band Management** - Invite members and collaborate
- **Offline-First** - Works offline with automatic sync when connected

## Tech Stack

- **Frontend**: React 18+, TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Local Storage**: IndexedDB for offline-first architecture
- **Testing**: Vitest (unit), Playwright (E2E), pgTAP (database)

## Development

### Prerequisites

- Node.js 18+
- Docker (for local Supabase)

### Commands

| Command | Description |
|---------|-------------|
| `npm run setup:local` | First time setup (start Supabase + generate env files) |
| `npm run start:dev` | Start development (Supabase + env + dev server) |
| `npm run dev` | Start dev server only |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:db` | Run database tests (pgTAP) |
| `npm run test:all` | Run all tests |

### Environment Management

| Environment | Command | Use Case |
|-------------|---------|----------|
| Development | `npm run start:dev` | Daily development (local Supabase) |
| Staging | `npm run start:staging` | Testing with remote Supabase |
| Test | `npm run start:test` | CI/CD and automated testing |

See [ENVIRONMENTS.md](./ENVIRONMENTS.md) for full environment management guide.

## Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Getting started guide
- [ENVIRONMENTS.md](./ENVIRONMENTS.md) - Environment configuration
- [CLAUDE.md](./CLAUDE.md) - Development guidelines and conventions

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
├── tests/                  # Application tests
│   ├── unit/               # Unit tests
│   ├── e2e/                # E2E tests (Playwright)
│   └── integration/        # Integration tests
└── scripts/                # Helper scripts
```

## License

Private - All rights reserved
