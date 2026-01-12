/**
 * Schema Diagram Sync Test
 *
 * Validates that the generated ER diagram is up-to-date with the baseline schema.
 * This test ensures the DevDashboard documentation stays in sync with actual schema changes.
 *
 * If this test fails, run: npx ts-node scripts/generate-er-diagram.ts
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const MIGRATION_FILE = 'supabase/migrations/20251106000000_baseline_schema.sql'
const GENERATED_FILE = 'src/pages/DevDashboard/diagrams/generated/erDiagram.ts'

describe('Schema Diagram Sync', () => {
  it('should have generated ER diagram file', () => {
    const filePath = path.join(process.cwd(), GENERATED_FILE)
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('should include all tables from baseline schema', () => {
    const migrationPath = path.join(process.cwd(), MIGRATION_FILE)
    const generatedPath = path.join(process.cwd(), GENERATED_FILE)

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    const generatedContent = fs.readFileSync(generatedPath, 'utf-8')

    // Extract table names from migration
    const tableMatches = migrationSQL.matchAll(
      /CREATE TABLE (?:public\.)?(\w+)\s*\(/g
    )
    const migrationTables = [...tableMatches].map(m => m[1])

    // Check each table is in the generated diagram
    for (const table of migrationTables) {
      expect(generatedContent).toContain(
        `${table} {`,
        `Table "${table}" not found in generated ER diagram. Run: npx ts-node scripts/generate-er-diagram.ts`
      )
    }
  })

  it('should detect when migration is newer than generated diagram', () => {
    const migrationPath = path.join(process.cwd(), MIGRATION_FILE)
    const generatedPath = path.join(process.cwd(), GENERATED_FILE)

    const migrationStat = fs.statSync(migrationPath)
    const generatedStat = fs.statSync(generatedPath)

    // If migration is newer than generated file, the diagram may be stale
    // This is a soft check - the actual content check below is more reliable
    if (migrationStat.mtime > generatedStat.mtime) {
      console.warn(
        '⚠️  Migration file is newer than generated diagram. ' +
          'Consider running: npx ts-node scripts/generate-er-diagram.ts'
      )
    }
  })

  it('should have matching table count', () => {
    const migrationPath = path.join(process.cwd(), MIGRATION_FILE)
    const generatedPath = path.join(process.cwd(), GENERATED_FILE)

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    const generatedContent = fs.readFileSync(generatedPath, 'utf-8')

    // Count tables in migration
    const migrationTableCount = (
      migrationSQL.match(/CREATE TABLE (?:public\.)?(\w+)\s*\(/g) || []
    ).length

    // Count tables in generated diagram (look for "tablename {" pattern)
    const generatedTableCount = (
      generatedContent.match(/^\s{4}\w+ \{$/gm) || []
    ).length

    expect(generatedTableCount).toBe(migrationTableCount)
  })

  describe('Table completeness', () => {
    const expectedTables = [
      'users',
      'user_profiles',
      'bands',
      'band_memberships',
      'invite_codes',
      'songs',
      'song_groups',
      'song_group_memberships',
      'setlists',
      'shows',
      'practice_sessions',
      'song_castings',
      'song_assignments',
      'assignment_roles',
      'casting_templates',
      'member_capabilities',
      'audit_log',
      'song_personal_notes',
      'song_note_entries',
    ]

    it.each(expectedTables)('should include table: %s', tableName => {
      const generatedPath = path.join(process.cwd(), GENERATED_FILE)
      const generatedContent = fs.readFileSync(generatedPath, 'utf-8')

      expect(generatedContent).toContain(`${tableName} {`)
    })
  })
})
