---
title: Pre-Main Merge Project Cleanup Plan
created: 2025-11-19T22:50
type: Cleanup Plan
status: Ready for Review
purpose: Organize project before merging to main
---

# Pre-Main Merge Project Cleanup Plan

## Executive Summary

Before merging `backup/pre-sql-cleanup` into `main`, we need to organize and archive outdated documentation, remove temporary files, and ensure the project is clean and maintainable.

**Total Files to Process**: ~350+ documentation files, ~10 temporary files, test output directories

---

## Test Status Check

**E2E Tests**: Currently running (280 tests)
- ✅ Many tests passing (auth, band creation, login smoke tests)
- ⚠️ Some failures in specific browsers/features (expected - not blocking merge)
- 📊 Will generate final report when complete

---

## 1. .claude/artifacts/ Cleanup (HIGH PRIORITY)

### Current State
- **Total artifacts**: 250+ markdown files
- **Archive directory**: Exists with 242 files
- **Active artifacts**: 12 files (recent work from Nov 19)
- **Future directory**: 2 files (deferred features)

### Actions Required

#### ✅ KEEP (Active Artifacts - Recent Work)
```
.claude/artifacts/2025-11-19T16:52_manual-remote-deployment-guide.md
.claude/artifacts/2025-11-19T21:38_foreign-key-inconsistency-analysis.md
.claude/artifacts/2025-11-19T22:15_signup-createband-flow-analysis.md
.claude/artifacts/2025-11-12T23:48_multi-band-support-investigation.md
.claude/artifacts/2025-11-13T01:13_e2e-test-implementation-progress.md
.claude/artifacts/2025-11-14T01:45_e2e-testing-cors-fix-success.md
.claude/artifacts/2025-11-14T18:30_task-01-delegation-brief.md
.claude/artifacts/2025-11-14T23:55_e2e-test-gap-analysis-and-remediation-plan.md
.claude/artifacts/2025-11-15T15:39_test-failure-analysis.md
.claude/artifacts/2025-11-15T15:50_production-rls-fix-plan.md
.claude/artifacts/2025-11-15T22:55_migration-consolidation-complete.md
```

#### ✅ KEEP (Special Artifacts)
```
.claude/artifacts/band_management_prd.md
.claude/artifacts/context-specific-casting-system.md
.claude/artifacts/DEV-STARTUP-GUIDE.md
.claude/artifacts/IMPLEMENTATION-SUMMARY.md
.claude/artifacts/supabase-advisor-suggestions.md
.claude/artifacts/todos.md
.claude/artifacts/user-journey-flows.md
```

#### ✅ KEEP (Archive Directory - Already Organized)
```
.claude/artifacts/archive/ (242 files)
.claude/artifacts/future/ (2 files)
```

#### ❌ DELETE (Outdated Root Artifacts)
```
.claude/artifacts/2025-11-10T17:17_e2e-testing-implementation-plan.md
.claude/artifacts/2025-11-14T14:13_testability-attributes-for-setlists-shows-practices.md
```

These are superseded by recent Nov 19 work and e2e-test-gap-analysis.

---

## 2. .claude/bug-reports/ Cleanup (LOW PRIORITY)

### Current State
```
2025-11-11_invite-code-join-band-navigation-failure.md
2025-11-13_e2e-test-failures-song-form-issues.md
2025-11-14_chromium-cors-timeout-fix.md
2025-11-14_e2e-test-failures-after-task-implementation.md
```

### Actions Required

#### ✅ ARCHIVE (Resolved Bugs)
Move to `.claude/bug-reports/archive/`:
- `2025-11-11_invite-code-join-band-navigation-failure.md` (Fixed)
- `2025-11-14_chromium-cors-timeout-fix.md` (Fixed)

#### ✅ KEEP (Active Issues)
- `2025-11-13_e2e-test-failures-song-form-issues.md` (Still relevant)
- `2025-11-14_e2e-test-failures-after-task-implementation.md` (Test fixes ongoing)

---

## 3. .claude/plans/ Cleanup (MEDIUM PRIORITY)

### Current State
```
01-add-testability-attributes.md
02-create-e2e-tests.md
03-create-setlists-e2e-tests.md
04-create-shows-e2e-tests.md
05-update-task-tracker-accurate-status.md
task-tracker.md
archive/
  - invite-codes-sync-fix.md
  - join-band-direct-sync-implementation.md
```

### Actions Required

#### ✅ ARCHIVE (Completed Plans)
Move to `.claude/plans/archive/`:
- `01-add-testability-attributes.md` (Completed)
- `02-create-e2e-tests.md` (Completed - tests exist)
- `03-create-setlists-e2e-tests.md` (Completed)
- `04-create-shows-e2e-tests.md` (Completed)
- `05-update-task-tracker-accurate-status.md` (OBE - not using task tracker)

#### ✅ DELETE (Obsolete)
- `task-tracker.md` (Not maintained, using todo system instead)

---

## 4. .claude/instructions/ Cleanup (HIGH PRIORITY)

### Current State
- **Active instructions**: 8 files (00-07)
- **Archive**: 15+ files
- **README.md**: Needs update
- **TASK-INDEX.md**: Likely outdated

### Actions Required

#### ✅ REVIEW & UPDATE (Active Instructions)
Check if still relevant:
```
00-baseline-validation-report.md
00-OVERVIEW.md
01-foundation-completion-report.md
02-visual-indicators-completion-report.md
02-visual-indicators-progress-report.md
03-immediate-sync-progress-report.md
04-remaining-test-fixes-plan.md
05-audit-first-realtime-implementation.md
06-dashboard-table-mapping-fix.md
07-e2e-implementation-tasks.md
95-database-integration-testing-strategy.md
```

**Recommendation**: Archive all completion/progress reports, keep only active plans:
- Keep: `00-OVERVIEW.md`, `95-database-integration-testing-strategy.md`
- Archive: All numbered reports (01-07)
- Update: `README.md` with current state

#### ❌ DELETE (Outdated Index)
- `TASK-INDEX.md` (Replaced by current work)

---

## 5. .claude/specifications/ Cleanup (MEDIUM PRIORITY)

### Current State
- Core specs (keep all):
  - `2025-10-22T14:01_design-style-guide.md`
  - `functional-mvp-spec.md`
  - `unified-database-schema.md` ⭐ (Recently updated)
  - `dev-workflow-and-test-data.md`
  - `permissions-and-use-cases.md`
  - `testing-overview-and-strategy.md`

- User flows:
  - `authentication-flow.md` (Original)
  - `authentication-flow-v2.md` ⭐ (New - just created)
  - `authentication-test-status.md`
  - `README.md`

### Actions Required

#### ✅ ARCHIVE (Superseded Specs)
Create `.claude/specifications/archive/`:
- `2025-10-22T22:28_app-pages-and-workflows.md` (Outdated)
- `2025-10-22T22:59_functional-mvp-spec.md` (Check if superseded by current spec)
- `2025-10-26T17:30_bidirectional-sync-specification.md` (Old version)
- `2025-10-27T18:16_test-data-and-seeding-specification.md` (Dated)
- `2025-10-30T13:25_bidirectional-sync-specification.md` (Check if still needed)
- `proposed-unified-schema-v2.md` (Superseded by unified-database-schema.md)

#### ✅ ARCHIVE (User Flows - Old Versions)
Move to `.claude/specifications/user-flows/archive/`:
- `authentication-flow.md` (Superseded by v2)

---

## 6. Temporary Files Cleanup (HIGH PRIORITY)

### Files to DELETE

#### ❌ Supabase Temporary Files
```
supabase/reset-remote-database.sql  (Created Nov 19 for testing - no longer needed)
```

#### ❌ Environment Files Review
Current .env files:
```
.env.development          ✅ KEEP (Template)
.env.local               ⚠️  KEEP (Auto-generated, gitignored)
.env.local.dev           ❌ DELETE (Duplicate of .env.development?)
.env.local.example       ✅ KEEP (Template)
.env.local.production    ❌ DELETE (Duplicate of .env.production?)
.env.local.production.example ✅ KEEP (Template)
.env.production          ✅ KEEP (Template)
.env.production.example  ✅ KEEP (Template)
.env.staging             ✅ KEEP (Template)
.env.supabase.local      ⚠️  KEEP (Local Supabase config)
.env.test                ✅ KEEP (Template)
.env.vercel              ⚠️  REVIEW (Deployment config)
```

**Action**: Remove duplicate .env files that don't add value

#### ❌ Test Output Directories (Gitignored - Safe to Delete)
```
test-results/       (136 subdirectories - E2E test artifacts)
playwright-report/  (HTML reports)
```

**Note**: These are gitignored but consume disk space. Safe to delete.

---

## 7. Root Directory Cleanup (LOW PRIORITY)

### Actions Required

#### ✅ KEEP (Essential Files)
All package.json, config files, README.md, etc.

#### ⚠️ REVIEW (Config Files)
- `.mcp.json` - Modified but not committed (check if changes needed)

---

## 8. Migration Verification (CRITICAL)

### Files Modified (Not Yet Committed)
```
✅ supabase/migrations/20251106000000_baseline_schema.sql
✅ supabase/tests/000-setup-test-helpers.sql
✅ src/services/database/index.ts (Version 8 schema)
✅ src/hooks/useBands.ts (Server-side creation)
✅ .claude/specifications/unified-database-schema.md
✅ .claude/specifications/user-flows/authentication-flow-v2.md
```

**Action**: Verify all changes are intentional and documented before merge.

---

## Cleanup Execution Plan

### Phase 1: Immediate (Pre-Merge)
1. ✅ Delete temporary SQL file: `supabase/reset-remote-database.sql`
2. ✅ Delete duplicate .env files: `.env.local.dev`, `.env.local.production`
3. ✅ Archive outdated artifacts (2 files to archive)
4. ✅ Create bug-reports/archive/ and move resolved bugs
5. ✅ Archive completed plans (5 files)
6. ✅ Delete task-tracker.md

### Phase 2: Documentation Reorganization (Post-Merge)
1. ✅ Archive old instructions (numbered reports 01-07)
2. ✅ Update instructions/README.md with current state
3. ✅ Create specifications/archive/ and move dated specs
4. ✅ Archive old authentication-flow.md

### Phase 3: Optimization (Optional)
1. ⚠️ Delete test output directories (saves disk space)
2. ⚠️ Run `npm run build` to verify everything works
3. ⚠️ Run `npm run test:db` to verify migrations

---

## Pre-Merge Checklist

Before merging to main:
- [ ] E2E tests complete (verify no critical failures)
- [ ] Phase 1 cleanup complete (temporary files removed)
- [ ] All intended changes committed (database, code, specs)
- [ ] .gitignore is correct (test outputs ignored)
- [ ] CLAUDE.md is up to date
- [ ] README.md reflects current state
- [ ] No untracked files that should be committed
- [ ] TypeScript builds without errors
- [ ] Database tests pass (337/337)

---

## Post-Merge Tasks

After merging to main:
1. Create tag: `v0.9-duplicate-membership-fix`
2. Deploy to staging for dry-run testing
3. Complete Phase 2 documentation cleanup
4. Update project boards/issues

---

## Risk Assessment

### Low Risk
- Deleting test output directories (gitignored, regenerable)
- Archiving old artifacts (already in archive/ subdirectory)
- Removing temporary SQL files (one-time use)

### Medium Risk
- Deleting duplicate .env files (verify not in use)
- Archiving instructions (might reference from other docs)

### High Risk
- None identified - all cleanup is non-destructive archiving

---

**Status**: Ready for user approval
**Priority**: High - Should complete before main merge
**Estimated effort**: 30 minutes for Phase 1
