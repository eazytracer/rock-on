#!/usr/bin/env tsx
/**
 * Schema Validation Tool
 *
 * Fetches actual schema from Supabase and validates against our code/specification.
 * Run this before making schema-related changes to avoid runtime errors!
 *
 * Usage:
 *   npm run validate-schema              # Check all tables
 *   npm run validate-schema -- songs     # Check specific table
 *   npm run validate-schema -- --fix     # Generate updated types
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env.local
config({ path: '.env.local' })

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
}

const c = colors

// Known schema differences (IndexedDB camelCase vs Supabase snake_case)
const KNOWN_MAPPINGS: Record<string, Record<string, string>> = {
  songs: {
    contextType: 'context_type',
    contextId: 'context_id',
    createdBy: 'created_by',
    createdDate: 'created_date',
    lastModified: 'last_modified',
    updatedDate: 'updated_date',
    guitarTuning: 'guitar_tuning',
    songGroupId: 'song_group_id',
    referenceLinks: 'reference_links',
    confidenceLevel: 'confidence_level',
  },
  bands: {
    createdBy: 'created_by',
    createdDate: 'created_date',
    updatedDate: 'updated_date',
    isActive: 'is_active',
  },
  setlists: {
    bandId: 'band_id',
    showId: 'show_id',
    createdDate: 'created_date',
    lastModified: 'last_modified',
    createdBy: 'created_by',
  },
  practice_sessions: {
    bandId: 'band_id',
    scheduledDate: 'scheduled_date',
    createdDate: 'created_date',
    completedObjectives: 'completed_objectives',
  },
  band_memberships: {
    userId: 'user_id',
    bandId: 'band_id',
    joinedDate: 'joined_date',
  },
}

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface TableSchema {
  tableName: string
  columns: ColumnInfo[]
}

async function getSupabaseSchema(tableName?: string): Promise<TableSchema[]> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Check .env.local')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Query information_schema to get actual table structure
  let query = supabase
    .from('information_schema.columns')
    .select('table_name, column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .order('table_name')
    .order('ordinal_position')

  if (tableName) {
    query = query.eq('table_name', tableName)
  }

  const { data, error } = await query as any

  if (error) {
    throw new Error(`Failed to fetch schema: ${error.message}`)
  }

  // Group by table name
  const tableMap = new Map<string, ColumnInfo[]>()

  for (const row of data || []) {
    if (!tableMap.has(row.table_name)) {
      tableMap.set(row.table_name, [])
    }
    tableMap.get(row.table_name)!.push({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
      column_default: row.column_default,
    })
  }

  return Array.from(tableMap.entries()).map(([tableName, columns]) => ({
    tableName,
    columns,
  }))
}

function checkCodeReferences(tableName: string, actualColumns: string[]): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Get the mapping for this table
  const mapping = KNOWN_MAPPINGS[tableName] || {}
  const expectedCamelCase = Object.keys(mapping)
  const expectedSnakeCase = Object.values(mapping)
  const allExpected = [...expectedCamelCase, ...expectedSnakeCase]

  // Check for columns in mapping that don't exist in actual schema
  for (const [camelCase, snakeCase] of Object.entries(mapping)) {
    if (!actualColumns.includes(snakeCase)) {
      errors.push(
        `❌ Column mapping ERROR: ${c.yellow}${camelCase}${c.reset} → ${c.red}${snakeCase}${c.reset} (column doesn't exist in Supabase)`
      )
    }
  }

  // Check for columns in Supabase that aren't in our mapping
  for (const col of actualColumns) {
    // Skip system columns
    if (['id', 'created_at', 'updated_at'].includes(col)) continue

    if (!allExpected.includes(col)) {
      warnings.push(
        `⚠️  Unmapped column: ${c.yellow}${col}${c.reset} (exists in Supabase but not in mapping)`
      )
    }
  }

  return { errors, warnings }
}

async function validateSchema(tableName?: string) {
  console.log(`\n${c.bold}${c.cyan}🔍 Schema Validation Tool${c.reset}\n`)

  try {
    // Fetch actual schema from Supabase
    console.log(`${c.blue}Fetching schema from Supabase...${c.reset}`)
    const schemas = await getSupabaseSchema(tableName)

    if (schemas.length === 0) {
      console.log(`${c.red}No tables found${c.reset}`)
      return
    }

    let totalErrors = 0
    let totalWarnings = 0

    // Validate each table
    for (const schema of schemas) {
      console.log(`\n${c.bold}${c.magenta}📋 Table: ${schema.tableName}${c.reset}`)
      console.log(`${c.cyan}${'─'.repeat(60)}${c.reset}`)

      // Display columns
      console.log(`\n${c.bold}Columns (${schema.columns.length}):${c.reset}`)
      const columnNames = schema.columns.map(c => c.column_name)

      for (const col of schema.columns) {
        const nullable = col.is_nullable === 'YES' ? `${c.yellow}NULL${c.reset}` : `${c.green}NOT NULL${c.reset}`
        const hasDefault = col.column_default ? `${c.cyan}(default)${c.reset}` : ''
        console.log(`  • ${c.bold}${col.column_name}${c.reset} : ${col.data_type} ${nullable} ${hasDefault}`)
      }

      // Check code references
      const { errors, warnings } = checkCodeReferences(schema.tableName, columnNames)

      if (errors.length > 0) {
        console.log(`\n${c.bold}${c.red}Errors:${c.reset}`)
        errors.forEach(e => console.log(`  ${e}`))
        totalErrors += errors.length
      }

      if (warnings.length > 0) {
        console.log(`\n${c.bold}${c.yellow}Warnings:${c.reset}`)
        warnings.forEach(w => console.log(`  ${w}`))
        totalWarnings += warnings.length
      }

      if (errors.length === 0 && warnings.length === 0) {
        console.log(`\n${c.green}✓ Schema looks good!${c.reset}`)
      }
    }

    // Summary
    console.log(`\n${c.cyan}${'═'.repeat(60)}${c.reset}`)
    console.log(`${c.bold}Summary:${c.reset}`)
    console.log(`  Tables checked: ${schemas.length}`)

    if (totalErrors > 0) {
      console.log(`  ${c.red}Errors: ${totalErrors}${c.reset}`)
    }
    if (totalWarnings > 0) {
      console.log(`  ${c.yellow}Warnings: ${totalWarnings}${c.reset}`)
    }
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log(`  ${c.green}✓ No issues found${c.reset}`)
    }

    console.log(`\n`)

    // Exit with error code if there are errors
    if (totalErrors > 0) {
      process.exit(1)
    }

  } catch (error) {
    console.error(`\n${c.red}${c.bold}Error:${c.reset} ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const tableName = args.find(arg => !arg.startsWith('--'))

// Run validation
validateSchema(tableName)
