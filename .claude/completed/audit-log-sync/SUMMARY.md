# Audit Log Sync - Summary

**Completed:** 2026-01-21
**Version:** 0.2.1
**Branch:** `fix/audit-log-incremental-sync`
**Type:** Bug Fix

## Overview

Fixed critical sync bug where song updates made on desktop PC were not syncing to mobile Chrome. The root cause was that `pullSongsIncremental()` compared `createdDate` timestamps, which never change after record creation, so updates were never detected.

**Solution:** Refactored incremental sync to use the `audit_log` table which captures all INSERT/UPDATE/DELETE operations with accurate timestamps.

## Key Changes

### New Files

- `src/config/featureFlags.ts` - Feature flag system for toggling experimental features
- `src/services/data/auditMappers.ts` - Shared mappers for converting audit_log JSONB to application models
- `tests/unit/services/data/auditMappers.test.ts` - Unit tests for audit mappers
- `tests/unit/services/data/SyncEngine.audit.test.ts` - Tests for audit log sync
- `tests/unit/services/data/RemoteRepository.audit.test.ts` - Tests for remote audit queries
- `docker/nginx-proxy.conf` - Nginx config for external Supabase access
- `start-docker.sh` - Docker startup script for phone testing

### Modified Files

- `src/services/data/SyncEngine.ts` - Added `pullFromAuditLog()` and related methods behind feature flag
- `src/services/data/RealtimeManager.ts` - Updated to use shared audit mappers
- `src/services/data/RemoteRepository.ts` - Added audit log query methods
- `src/services/data/syncTypes.ts` - Added audit log type definitions
- `Dockerfile` - Updated for development/production builds
- `docker-compose.yml` - Complete dev stack with Supabase CLI init container

## Testing

- Unit tests: 491 passing (all existing + new audit tests)
- Type check: Passing
- Lint: Passing

## Feature Flag

The new sync is controlled by `SYNC_USE_AUDIT_LOG` feature flag:

- **Default: `true` (enabled)** - The bugfix is active by default
- Disable (rollback): `localStorage.setItem('SYNC_USE_AUDIT_LOG', 'false')`
- Environment override: `VITE_SYNC_USE_AUDIT_LOG=false`

The feature flag exists as a safety mechanism for rollback capability without code changes.

## Breaking Changes

None - feature flagged, falls back to existing behavior when disabled.

## Related

- Uses existing `audit_log` table and triggers from baseline schema
- Enables future improvements: conflict detection, sync replay, change history
