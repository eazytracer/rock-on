# Environment Management Guide

Rock-On uses different environment configurations for development, staging, and production. This guide explains how to manage and switch between environments.

## Quick Start

```bash
# Development with local Supabase (recommended for day-to-day work)
npm run start:dev

# Staging with remote Supabase (for testing before deploy)
npm run start:staging

# Check current environment
npm run env:status
```

## Available Environments

### 1. Development (Local Supabase)
**Best for:** Daily development, testing features locally

```bash
npm run start:dev
# or manually:
npm run env:dev
npm run dev
```

**Configuration:**
- Supabase URL: `http://127.0.0.1:54321` (local)
- Email confirmations: **Disabled**
- Data: Local only (not shared with other developers)
- Supabase Studio: http://127.0.0.1:54323

**Prerequisites:**
- Local Supabase must be running (`npm run supabase:start`)

---

### 2. Staging (Remote Supabase)
**Best for:** Testing production-like setup, QA, demos

```bash
npm run start:staging
```

**Configuration:**
- Supabase URL: `https://khzeuxxhigqcmrytsfux.supabase.co` (remote)
- Email confirmations: **Enabled** (requires SMTP setup)
- Data: Shared across team
- Mimics production environment

**Use when:**
- Testing features before deploy
- Demoing to stakeholders
- Integration testing with production-like data

---

### 3. Test (CI/CD)
**Best for:** Automated testing, integration tests

```bash
npm run start:test
```

**Configuration:**
- Mock auth enabled (no real Supabase auth)
- Local Supabase for data
- Optimized for automated tests

**Use when:**
- Running CI/CD pipelines
- Integration tests
- E2E test suites

---

### 4. Production
**Best for:** Deployed application

**Configuration:**
- Uses `.env.production`
- Only loaded during build (`npm run build`)
- Never run locally with production env!

---

## Environment Files

```
.env.development    → Local Supabase (no email confirmations)
.env.staging        → Remote Supabase (production-like)
.env.test           → Test/CI configuration
.env.production     → Production config (for builds only)
.env.local          → Active environment (gitignored, auto-generated)
```

**Important:**
- `.env.local` is **gitignored** and **auto-generated** by env scripts
- Never commit `.env.local` - it contains your active environment
- Always use `npm run env:dev` or `start:dev` to set environment

---

## Common Commands

### Environment Management
```bash
# Switch to development environment
npm run env:dev

# Switch to staging environment
npm run env:staging

# Check which environment is active
npm run env:status
```

### Supabase Management
```bash
# Start local Supabase
npm run supabase:start

# Stop local Supabase
npm run supabase:stop

# Check Supabase status
npm run supabase:status

# Reset database (fresh start)
npm run supabase:reset

# Open Supabase Studio
npm run supabase:studio
```

### Development Workflows
```bash
# Full dev setup (Supabase + env + dev server)
npm run start:dev

# Just start dev server (assumes env already set)
npm run dev

# Run tests with test environment
npm run start:test
```

---

## Troubleshooting

### "Email not confirmed" error
**Problem:** You're connected to remote Supabase with email confirmations enabled

**Solution:** Switch to development environment
```bash
npm run start:dev
```

### "Failed to fetch" or connection refused
**Problem:** Local Supabase is not running

**Solution:**
```bash
npm run supabase:start
npm run dev
```

### Not sure which environment is active?
```bash
npm run env:status
```

### Want to see Supabase data?
```bash
npm run supabase:studio
# Opens http://127.0.0.1:54323 in browser
```

---

## Best Practices

### ✅ DO:
- Use `npm run start:dev` for daily development
- Use `npm run start:staging` before deploying
- Check `npm run env:status` when unsure
- Keep local Supabase running during dev (`npm run supabase:start`)

### ❌ DON'T:
- Don't commit `.env.local`
- Don't manually edit `.env.local` (use npm scripts)
- Don't run production environment locally
- Don't share Supabase credentials in commits

---

## Environment Variables Reference

| Variable | Development | Staging | Test | Description |
|----------|------------|---------|------|-------------|
| `VITE_MOCK_AUTH` | false | false | true | Enable mock auth |
| `VITE_SUPABASE_URL` | localhost:54321 | remote | localhost | Supabase endpoint |
| `VITE_SUPABASE_ANON_KEY` | local-key | prod-key | local-key | Public API key |
| `VITE_GOOGLE_CLIENT_ID` | shared | shared | test-id | OAuth client ID |

---

## Docker Compose (Future)

For running integration tests in Docker:

```yaml
# docker-compose.test.yml (planned)
version: '3.8'
services:
  app:
    build: .
    environment:
      - NODE_ENV=test
    depends_on:
      - supabase

  supabase:
    image: supabase/postgres
    # ... configuration
```

```bash
# Run integration tests in Docker
docker-compose -f docker-compose.test.yml up
```

---

## Questions?

- Check current environment: `npm run env:status`
- View Supabase logs: `npm run supabase:status`
- Reset everything: `npm run supabase:reset && npm run start:dev`
