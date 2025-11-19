# Rock-On Quick Start

## First Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Start local Supabase
npm run supabase:start

# 3. Run database migrations (already done via supabase start)
# Migrations are automatically applied

# 4. Start development server (automatically sets dev environment)
npm run start:dev
```

That's it! Your app should be running at http://localhost:5173

## Daily Development

```bash
# Start everything (Supabase + dev server)
npm run start:dev
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run start:dev` | **Start local dev** (Supabase + env + server) |
| `npm run start:staging` | Start with remote Supabase |
| `npm run env:status` | Check active environment |
| `npm run supabase:studio` | Open database UI |
| `npm run test` | Run unit tests |
| `npm run test:all` | Run all tests (unit + database) |
| `npm run build` | Build for production |

## Environment Modes

| Mode | Use When | Supabase | Email Confirmations |
|------|----------|----------|-------------------|
| **Development** | Daily coding | Local | ❌ Disabled |
| **Staging** | Testing before deploy | Remote | ✅ Enabled |
| **Test** | CI/CD, automated tests | Local | ❌ Mock |
| **Production** | Deployed app | Remote | ✅ Enabled |

## Troubleshooting

### Can't connect to Supabase?
```bash
npm run supabase:status  # Check if running
npm run supabase:start   # Start if stopped
```

### "Email not confirmed" error?
```bash
npm run start:dev  # Switch to local Supabase (no confirmations)
```

### Want to reset database?
```bash
npm run supabase:reset
```

### Lost track of environment?
```bash
npm run env:status
```

## Project Structure

```
rock-on/
├── src/                    # Application source
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── services/           # Business logic
│   │   ├── auth/           # Authentication
│   │   ├── data/           # Data sync
│   │   └── supabase/       # Supabase client
│   └── models/             # TypeScript types
├── supabase/               # Supabase configuration
│   ├── migrations/         # Database migrations
│   └── tests/              # Database tests (pgTAP)
├── scripts/                # Helper scripts
├── .env.development        # Local Supabase config
├── .env.staging            # Remote Supabase config
└── .env.local              # Active environment (auto-generated)
```

## Need More Help?

- **Environment details:** See `ENVIRONMENTS.md`
- **Database schema:** See `.claude/specifications/unified-database-schema.md`
- **Development guide:** See `CLAUDE.md`
- **Supabase Studio:** `npm run supabase:studio`

## Links

- **App:** http://localhost:5173
- **Supabase Studio:** http://127.0.0.1:54323
- **Supabase API:** http://127.0.0.1:54321
- **Mailpit (emails):** http://127.0.0.1:54324
