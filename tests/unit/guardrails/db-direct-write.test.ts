/**
 * Guardrail: No direct IndexedDB writes outside the repository layer
 *
 * WHY THIS EXISTS
 * ───────────────
 * Direct writes to `db.*` (Dexie) bypass the SyncRepository, which means:
 *   1. The change is never queued for Supabase — data is lost on refresh
 *   2. The sync engine has no record of the change — conflicts go undetected
 *   3. Supabase (source of truth) diverges silently from IndexedDB (cache)
 *
 * THE RULE
 * ────────
 * Only the repository layer and infrastructure files listed in ALWAYS_ALLOWED
 * may write to IndexedDB directly. Everything else must go through:
 *
 *   repository.addSong()      repository.updateSong()
 *   repository.addSetlist()   repository.updateSetlist()
 *   ... etc. (see IDataRepository interface)
 *
 * HOW THE RATCHET WORKS
 * ─────────────────────
 * Files in KNOWN_VIOLATIONS are existing technical debt — they are tracked here
 * so violations don't silently grow. To clean one up:
 *   1. Migrate the write to go through repository.*
 *   2. Remove it from KNOWN_VIOLATIONS
 *   3. The list only ever shrinks — this is the ratchet
 *
 * Any file that is in NEITHER list will FAIL this test.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── Repository layer & infrastructure — ALWAYS legitimate direct db writes ───
//
// These files ARE the storage layer. They are allowed to talk to Dexie directly.
const ALWAYS_ALLOWED = new Set([
  // Repository layer — this is where db writes belong
  'src/services/data/LocalRepository.ts',
  // Sync engine — manages syncQueue, syncMetadata, syncConflicts tables
  'src/services/data/SyncEngine.ts',
  // Realtime — writes incoming Supabase changes into the local cache
  'src/services/data/RealtimeManager.ts',
  // Dev seed data — only runs in development, not production code paths
  'src/database/seedData.ts',
  'src/database/seedMvpData.ts',
  // Legacy pre-repository services — kept for historical compatibility
  'src/database/services.ts',
  // DatabaseService — bulk migration/import utility
  'src/services/DatabaseService.ts',
  // Database utility module — schema/migration helpers
  'src/services/database/index.ts',
])

// ─── Known violations — existing tech debt to migrate, tracked here ───────────
//
// Each entry is a file that currently writes to db directly but shouldn't.
// Fix the file, migrate writes to repository.*, then remove it from this list.
// This list must only ever shrink.
const KNOWN_VIOLATIONS = new Set([
  // Auth services — write user/profile/band data during login setup
  // TODO: route through repository or a dedicated AuthRepository
  'src/services/auth/MockAuthService.ts',
  'src/services/auth/SupabaseAuthService.ts',

  // Setup service — writes band membership on first launch
  // TODO: route through repository.addBandMembership()
  'src/services/setup/InitialSetupService.ts',

  // Casting/capability services — pre-repository feature areas
  // TODO: add castings + capabilities to IDataRepository, route through it
  'src/services/CastingService.ts',
  'src/services/MemberCapabilityService.ts',

  // BandService — legacy service with direct member/band writes
  // TODO: route through repository.addBand(), repository.updateBand()
  'src/services/BandService.ts',

  // SongLinkingService — songGroups + songGroupMemberships not yet in repository
  // (songs.add/update already fixed; remaining writes are group metadata tables)
  // TODO: add songGroups + songGroupMemberships to IDataRepository
  'src/services/SongLinkingService.ts',

  // Hooks — should not write to db; route through useSongs/useBands hooks that
  // delegate to repository, or add dedicated repository methods
  'src/hooks/useBands.ts',
  'src/hooks/useSongs.ts',

  // Pages — should never write to db directly; use hooks/services instead
  'src/pages/AuthPages.tsx',
  'src/pages/BandMembersPage.tsx',

  // Components — same as pages
  'src/components/auth/BandCreationForm.tsx',
])

// ─── Detection ────────────────────────────────────────────────────────────────

/** Dexie write methods that bypass the sync queue when called directly */
const WRITE_PATTERN =
  /\bdb\.\w+\.(add|put|update|delete|bulkAdd|bulkPut|bulkDelete)\s*\(/

function collectTsFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

describe('Repository layer guardrails', () => {
  it('no direct IndexedDB writes outside the allowed set', () => {
    const root = path.resolve(process.cwd())
    const srcDir = path.join(root, 'src')
    const files = collectTsFiles(srcDir)

    const newViolations: { file: string; lines: string[] }[] = []
    const unexpectedlyClean: string[] = []

    for (const absPath of files) {
      const rel = path.relative(root, absPath).replace(/\\/g, '/')
      const content = fs.readFileSync(absPath, 'utf-8')

      // Only consider files that actually import db — avoids false positives
      // from other variables named "db" (e.g. test helpers, SQL clients)
      const importsDb = /\bimport\s+[^;]*\bdb\b[^;]*from\b/.test(content)
      if (!importsDb) continue

      const hasWrite = WRITE_PATTERN.test(content)

      if (hasWrite) {
        if (ALWAYS_ALLOWED.has(rel) || KNOWN_VIOLATIONS.has(rel)) continue

        // A write was found in a file that is in neither list — NEW violation
        const lines = content
          .split('\n')
          .map((line, i) => ({ line, num: i + 1 }))
          .filter(({ line }) => WRITE_PATTERN.test(line))
          .map(({ line, num }) => `  line ${num}: ${line.trim()}`)

        newViolations.push({ file: rel, lines })
      } else {
        // File is in KNOWN_VIOLATIONS but no longer has write calls —
        // it was cleaned up! Remind the developer to remove it from the list.
        if (KNOWN_VIOLATIONS.has(rel)) {
          unexpectedlyClean.push(rel)
        }
      }
    }

    // Build failure message for new violations
    if (newViolations.length > 0) {
      const msg = [
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ' NEW direct IndexedDB writes detected outside the repository layer',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        ' These writes bypass the sync queue. Supabase will never see them.',
        ' Fix: use repository.addSong(), repository.updateSetlist(), etc.',
        ' See src/services/data/IDataRepository.ts for available methods.',
        '',
        ...newViolations.flatMap(v => [`  📄 ${v.file}`, ...v.lines, '']),
        ' If this file genuinely belongs in the repository layer, add it to',
        ' ALWAYS_ALLOWED in tests/unit/guardrails/db-direct-write.test.ts',
        ' with an explanation. For tech debt, add it to KNOWN_VIOLATIONS.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n')
      expect.fail(msg)
    }

    // Soft reminder for cleaned-up violations (doesn't fail the test)
    if (unexpectedlyClean.length > 0) {
      console.warn(
        '\n✅ These files were in KNOWN_VIOLATIONS but no longer have direct' +
          ' db writes.\n   Please remove them from the list in' +
          ' tests/unit/guardrails/db-direct-write.test.ts:\n' +
          unexpectedlyClean.map(f => `   - ${f}`).join('\n') +
          '\n'
      )
    }

    expect(newViolations).toHaveLength(0)
  })
})
