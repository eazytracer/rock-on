# Rock On - Supabase Offline Sync Implementation Overview

## Project Context

This is a band management application currently using:
- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Local Storage**: Dexie (IndexedDB wrapper) - Version 5
- **Auth**: Mock auth service for development
- **Routing**: React Router v6

## Implementation Goal

Transform the application from local-only to a **local-first architecture** with cloud sync:

### Current Architecture (Local Only)
```
React Components → Service Layer → Dexie (IndexedDB)
```

### Target Architecture (Local-First with Sync)
```
React Components → Service Layer → Repository Layer → {
  - LocalRepository (Dexie) - instant reads/writes
  - RemoteRepository (Supabase) - cloud backup
  - SyncEngine - background synchronization
}
```

## Key Principles

1. **Local-First**: All operations work offline, sync happens in background
2. **Two Modes**:
   - Local Dev: Mock auth + Dexie only (no Supabase)
   - Production: Real auth + Dexie + Supabase sync
3. **Preserve Existing Work**: Keep all Dexie code, add sync layer
4. **Test-Driven Development**: Write tests BEFORE implementation
5. **Graceful Degradation**: App works even if Supabase is down

## Success Criteria

- [ ] App works offline with full functionality
- [ ] Changes sync to cloud when online
- [ ] Multiple devices can sync the same band data
- [ ] Local development works without Supabase credentials
- [ ] Production deployment to Vercel with Supabase integration
- [ ] Google OAuth authentication in production
- [ ] All tests passing (unit + integration)

## Timeline Estimate

- **Weeks 1-2**: Infrastructure (Supabase, auth, config)
- **Weeks 2-3**: Repository pattern implementation
- **Week 3-4**: Sync engine with conflict resolution
- **Week 4-5**: Service migration and UI updates
- **Week 5**: Testing, deployment, refinement

Total: **4-5 weeks** of focused development

## Task Organization

Tasks are numbered sequentially and grouped by phase:

- **00-09**: Setup and prerequisites
- **10-19**: Supabase infrastructure
- **20-29**: Authentication system
- **30-39**: Repository pattern
- **40-49**: Sync engine
- **50-59**: Service migration
- **60-69**: UI/UX updates
- **70-79**: Testing
- **80-89**: Deployment
- **90-99**: Documentation and polish

## How to Use These Instructions

Each task file contains:
1. **Context**: Background and dependencies
2. **Objective**: Clear goal statement
3. **Test Requirements**: Tests to write FIRST (TDD)
4. **Implementation Steps**: Detailed instructions
5. **Acceptance Criteria**: Definition of done
6. **Validation**: How to verify success

## Prerequisites

Before starting, ensure you have:
- [ ] Node.js 18+ installed
- [ ] npm/yarn package manager
- [ ] Git for version control
- [ ] Supabase account (for production setup)
- [ ] Google Cloud Console access (for OAuth)
- [ ] Vercel account (for deployment)

## Getting Started

1. Review the deployment plan: `.claude/artifacts/2025-10-24T00:43_deployment-plan-local-first-sync.md`
2. Start with task `01-environment-setup.md`
3. Follow tasks sequentially
4. Write tests BEFORE implementation
5. Validate each task before moving to next

## References

- Deployment Plan: `.claude/artifacts/2025-10-24T00:43_deployment-plan-local-first-sync.md`
- Current DB Schema: `src/services/database/index.ts`
- Current Auth: `src/contexts/AuthContext.tsx`
- Example Service: `src/services/PracticeSessionService.ts`
