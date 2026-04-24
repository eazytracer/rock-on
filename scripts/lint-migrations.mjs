#!/usr/bin/env node
/**
 * Migration linter — catches missing role grants at the SQL-text level.
 *
 * Why this exists:
 *   Local Supabase has more permissive default privileges than the hosted
 *   service. Every role (anon, authenticated, service_role) gets full
 *   privileges on new tables by default on local, but hosted doesn't.
 *   This means pgTAP `has_table_privilege()` checks can pass against a
 *   local DB while the identical schema fails with 403/404 on production.
 *
 *   The fix that would have caught v0.3.0's cascade: inspect migration
 *   files directly. If a migration creates a new public table, the same
 *   (or a later) migration MUST emit explicit GRANT statements for both
 *   `authenticated` and `service_role`, or a broad grant covering the
 *   table.
 *
 * Run: `node scripts/lint-migrations.mjs` (exit code 1 on violations).
 * Wired into npm as `npm run lint:migrations`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'
const BASELINE_FILE = '20251106000000_baseline_schema.sql'

// Required roles that every new public table must have DML grants for.
const REQUIRED_ROLES = ['authenticated', 'service_role']

/**
 * Return every `.sql` file under `supabase/migrations` in lexical (=apply) order.
 * Skips `archive/` subdirs.
 */
function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({ file: f, path: join(MIGRATIONS_DIR, f) }))
}

/**
 * Strip SQL comments (line + block) so grant/create matches aren't misled.
 */
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
}

/**
 * Return the set of `public.<table>` names created by CREATE TABLE statements
 * in this migration. Handles `CREATE TABLE`, `CREATE TABLE IF NOT EXISTS`,
 * with or without the `public.` qualifier.
 */
function extractCreatedTables(sql) {
  const created = new Set()
  // Match: CREATE TABLE [IF NOT EXISTS] [public.]<name> (
  const re =
    /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi
  let m
  while ((m = re.exec(sql)) !== null) {
    created.add(m[1].toLowerCase())
  }
  return created
}

/**
 * Detect whether a migration explicitly grants DML on a specific table to a
 * specific role. Returns true if any of:
 *   - `GRANT ... ON public.<table> TO <role>` with at least one DML privilege
 *   - `GRANT ... ON ALL TABLES IN SCHEMA public TO <role>` (covers tables
 *     existing when the statement runs — so only counts for grants that come
 *     at or after the CREATE TABLE)
 */
function hasGrantFor(sql, table, role) {
  const t = table.toLowerCase()
  const r = role.toLowerCase()

  // Per-table grant (with optional public. prefix)
  const perTableRe = new RegExp(
    `\\bGRANT\\b[\\s\\S]*?\\bON\\s+(?:public\\.)?${t}\\b[\\s\\S]*?\\bTO\\b[\\s\\S]*?\\b${r}\\b`,
    'i'
  )
  if (perTableRe.test(sql)) return true

  // Broad "ALL TABLES IN SCHEMA public" grant (common baseline pattern)
  const broadRe = new RegExp(
    `\\bGRANT\\b[\\s\\S]*?\\bON\\s+ALL\\s+TABLES\\s+IN\\s+SCHEMA\\s+public\\b[\\s\\S]*?\\bTO\\b[\\s\\S]*?\\b${r}\\b`,
    'i'
  )
  return broadRe.test(sql)
}

/**
 * Check if `sql` sets ALTER DEFAULT PRIVILEGES in the public schema granting
 * to <role>. Tables created AFTER this runs inherit the grant automatically.
 */
function hasDefaultPrivilegeFor(sql, role) {
  const r = role.toLowerCase()
  const re = new RegExp(
    `\\bALTER\\s+DEFAULT\\s+PRIVILEGES\\b[\\s\\S]*?\\bSCHEMA\\s+public\\b[\\s\\S]*?\\bGRANT\\b[\\s\\S]*?\\bON\\s+TABLES\\b[\\s\\S]*?\\bTO\\b[\\s\\S]*?\\b${r}\\b`,
    'i'
  )
  return re.test(sql)
}

function main() {
  const migrations = listMigrations()
  if (migrations.length === 0) {
    console.error(`No migrations found under ${MIGRATIONS_DIR}`)
    process.exit(1)
  }

  // Precompute per-migration cleaned SQL + CREATE TABLE sets + default-priv.
  const parsed = migrations.map(m => {
    const raw = readFileSync(m.path, 'utf8')
    const sql = stripComments(raw)
    return {
      ...m,
      sql,
      rawSize: raw.length,
      createdTables: extractCreatedTables(sql),
      defaultPrivRoles: REQUIRED_ROLES.filter(r =>
        hasDefaultPrivilegeFor(sql, r)
      ),
    }
  })

  // Track which migration first set default privileges for each role.
  const defaultPrivFirstSetAt = {}
  for (const m of parsed) {
    for (const role of m.defaultPrivRoles) {
      if (!(role in defaultPrivFirstSetAt)) {
        defaultPrivFirstSetAt[role] = m.file
      }
    }
  }

  const violations = []

  for (const m of parsed) {
    if (m.createdTables.size === 0) continue

    for (const table of m.createdTables) {
      // Baseline migration has its own internal broad grants; treat as a
      // whole-file self-check.
      for (const role of REQUIRED_ROLES) {
        // Did THIS migration (or any later one) explicitly grant to this role?
        const grantedHere = hasGrantFor(m.sql, table, role)

        // Does a default-privilege rule in an EARLIER migration apply?
        const defaultAt = defaultPrivFirstSetAt[role]
        const defaultCoveredEarlier =
          defaultAt && defaultAt < m.file && hasDefaultPrivilegeFor(
            parsed.find(p => p.file === defaultAt).sql,
            role
          )

        // Did any LATER migration grant to this role/table?
        const grantedLater = parsed
          .filter(p => p.file > m.file)
          .some(p => hasGrantFor(p.sql, table, role))

        if (!grantedHere && !defaultCoveredEarlier && !grantedLater) {
          violations.push({
            migration: m.file,
            table,
            role,
            hint:
              m.file === BASELINE_FILE
                ? 'Baseline migration should emit explicit GRANT ... TO ' +
                  role +
                  ' for this table (or GRANT ON ALL TABLES IN SCHEMA public TO ' +
                  role +
                  ' at the end).'
                : 'Add `GRANT SELECT, INSERT, UPDATE, DELETE ON public.' +
                  table +
                  ' TO ' +
                  role +
                  ';` to this migration, or a later one. See CLAUDE.md "Migration Policy".',
          })
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log(
      `\u2713 ${parsed.length} migration${parsed.length === 1 ? '' : 's'} scanned. All new public tables have explicit grants for ${REQUIRED_ROLES.join(' + ')}.`
    )
    process.exit(0)
  }

  console.error(
    `\u2717 ${violations.length} missing role grant${violations.length === 1 ? '' : 's'} found:\n`
  )
  for (const v of violations) {
    console.error(`  ${v.migration}`)
    console.error(`    table: public.${v.table}`)
    console.error(`    role:  ${v.role}`)
    console.error(`    fix:   ${v.hint}`)
    console.error('')
  }
  console.error(
    'Why this matters: local Supabase has permissive default privileges that mask missing grants.'
  )
  console.error(
    'Without explicit GRANTs in the migration, PostgREST on production returns 403/404 for every query against the affected table, even with valid JWTs.'
  )
  console.error(
    'See CLAUDE.md "Migration Policy" and artifact 2026-04-24_role-grants-gap for full context.\n'
  )
  process.exit(1)
}

main()
