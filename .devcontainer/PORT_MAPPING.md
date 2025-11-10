# Devcontainer Port Mapping Guide

## Overview
When running Rock-On in a devcontainer with Docker-in-Docker, Supabase runs inside nested Docker containers. This document explains the port mapping setup.

## Architecture

```
Host Machine (Your Computer)
  └─> VS Code Devcontainer (Ubuntu)
       └─> Docker-in-Docker (Moby)
            └─> Supabase Containers (11+ services)
```

## Port Forwarding Configuration

Ports are automatically forwarded from the devcontainer to your host machine via `.devcontainer/devcontainer.json`:

### Application Ports
- **5173** → Vite dev server (React app)
- **9222** → Chrome remote debugging

### Supabase Ports
- **54321** → Supabase API Gateway (Kong) - Main API endpoint
- **54322** → PostgreSQL database - Direct database access
- **54323** → Supabase Studio UI - Database management interface
- **54324** → Mailpit UI - Email testing interface

## Accessing Services

### From Inside Devcontainer
All Supabase services are accessible at `127.0.0.1` or `localhost`:
```bash
# API Gateway
curl http://127.0.0.1:54321

# Database (using psql)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Studio UI
http://127.0.0.1:54323
```

### From Host Machine (Your Browser)
After devcontainer starts, VS Code automatically forwards ports. Access via:
- App: http://localhost:5173
- Supabase Studio: http://localhost:54323
- Mailpit: http://localhost:54324
- API: http://localhost:54321

**Note:** First time accessing may require accepting the port forward prompt in VS Code.

## Supabase Container Architecture

### Core Services (Always Running)
1. **supabase_db_rock-on** (PostgreSQL)
   - Port: 54322
   - Purpose: Main database
   - Memory: ~200MB

2. **supabase_kong_rock-on** (API Gateway)
   - Port: 54321
   - Purpose: Routes API requests to services
   - Memory: ~50MB

3. **supabase_auth_rock-on** (GoTrue)
   - Internal port: 9999
   - Purpose: Authentication & user management
   - Memory: ~30MB

4. **supabase_rest_rock-on** (PostgREST)
   - Internal port: 3000
   - Purpose: Automatic REST API from database schema
   - Memory: ~20MB

5. **supabase_realtime_rock-on** (Phoenix)
   - Internal port: 4000
   - Purpose: WebSocket connections for live updates
   - Memory: ~100MB

6. **supabase_storage_rock-on**
   - Internal port: 5000
   - Purpose: File storage service
   - Memory: ~30MB

7. **supabase_pg_meta_rock-on**
   - Internal port: 8080
   - Purpose: PostgreSQL metadata API (used by Studio)
   - Memory: ~20MB

8. **supabase_studio_rock-on** (Next.js)
   - Port: 54323
   - Purpose: Web-based database management UI
   - Memory: ~150MB

9. **supabase_inbucket_rock-on** (Mailpit)
   - Port: 54324
   - Purpose: Captures emails for testing
   - Memory: ~20MB

10. **supabase_vector_rock-on** (pg_vector)
    - Purpose: Vector/embeddings support for PostgreSQL
    - Memory: ~50MB

11. **supabase_analytics_rock-on**
    - Port: 54327 (optional)
    - Purpose: Usage analytics
    - Memory: ~30MB

### Optional Services (Not Started by Default)
- **supabase_edge_runtime_rock-on** - Edge Functions runtime (Deno)
- **supabase_imgproxy_rock-on** - Image transformation proxy
- **supabase_pooler_rock-on** - PgBouncer connection pooler

## Resource Usage

**Total Memory for Running Services:** ~700-800MB
**Total Containers:** 11 running + 1 stopped (edge runtime)

This is **normal and expected** for a full local Supabase installation. Each service is necessary for different Supabase features.

## Troubleshooting

### "Can't access Supabase Studio from browser"
1. Check VS Code port forwarding status (Ports tab)
2. Verify containers are running: `docker ps | grep supabase`
3. Check Supabase status: `npm run supabase:status`
4. Restart devcontainer to apply port forwarding changes

### "Too many containers running"
This is normal! Supabase is a multi-service platform. Each container is necessary:
- Don't stop individual containers - use `npm run supabase:stop` to stop all
- Services communicate over internal Docker network
- Memory usage is reasonable for local development

### "Ports not accessible from host"
If you updated `.devcontainer/devcontainer.json`, you need to:
1. Rebuild the devcontainer: `Cmd/Ctrl+Shift+P` → "Dev Containers: Rebuild Container"
2. Or restart VS Code and reopen in devcontainer

### "Want to reduce resource usage"
```bash
# Stop Supabase when not needed
npm run supabase:stop

# Start again when needed
npm run supabase:start
```

## Network Architecture

All Supabase containers communicate via a dedicated Docker network:
```bash
$ docker network ls
supabase_network_rock-on   bridge    local
```

This network isolates Supabase services from other Docker containers while allowing:
- Internal container-to-container communication
- Port exposure to the devcontainer host (0.0.0.0)
- Automatic DNS resolution between services

## Startup Sequence

When you run `npm run supabase:start`, Supabase CLI:
1. Creates `supabase_network_rock-on` Docker network
2. Starts PostgreSQL database first
3. Applies migrations from `supabase/migrations/`
4. Starts dependent services (Auth, Storage, etc.)
5. Starts API Gateway (Kong) to route requests
6. Starts Studio UI for database management
7. Reports all service URLs and credentials

Total startup time: ~30-60 seconds depending on system.

## Best Practices

1. **Keep Supabase running during dev session**
   - Start once: `npm run supabase:start`
   - Stop when done: `npm run supabase:stop`

2. **Use npm scripts instead of direct commands**
   - ✅ `npm run supabase:start`
   - ❌ `docker start supabase_db_rock-on` (incomplete)

3. **Don't manually manage individual containers**
   - Supabase CLI handles orchestration
   - Services have dependencies on each other

4. **Monitor resource usage**
   ```bash
   docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
   ```

## References

- Supabase Local Development: https://supabase.com/docs/guides/cli/local-development
- Docker-in-Docker: https://github.com/devcontainers/features/tree/main/src/docker-in-docker
- VS Code Port Forwarding: https://code.visualstudio.com/docs/remote/ssh#_forwarding-a-port-creating-ssh-tunnel
