#!/usr/bin/env tsx
/**
 * Show Supabase Schema
 *
 * Displays the actual schema from Supabase in a readable format.
 * Use this to quickly check what columns actually exist before writing code!
 *
 * Usage:
 *   npm run schema:show              # Show all tables
 *   npm run schema:show setlists     # Show specific table
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: '.env.local' })

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

const c = colors

interface ColumnInfo {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

async function showSchema(tableName?: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error(`${c.red}${c.bold}Error:${c.reset} Missing Supabase credentials`)
    console.error(`${c.dim}Make sure .env.local contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY${c.reset}\n`)
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log(`\n${c.bold}${c.cyan}📊 Supabase Schema${c.reset}`)
  console.log(`${c.dim}${supabaseUrl}${c.reset}\n`)

  try {
    // Query information_schema
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
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      console.log(`${c.yellow}No tables found${c.reset}${tableName ? ` matching '${tableName}'` : ''}\n`)
      return
    }

    // Group by table
    const tables = new Map<string, ColumnInfo[]>()
    for (const row of data) {
      if (!tables.has(row.table_name)) {
        tables.set(row.table_name, [])
      }
      tables.get(row.table_name)!.push(row)
    }

    // Display each table
    for (const [table, columns] of tables) {
      console.log(`${c.bold}${c.magenta}${table}${c.reset} ${c.dim}(${columns.length} columns)${c.reset}`)
      console.log(`${c.cyan}${'─'.repeat(80)}${c.reset}`)

      // Find max column name length for alignment
      const maxLength = Math.max(...columns.map(c => c.column_name.length))

      for (const col of columns) {
        const name = col.column_name.padEnd(maxLength)
        const type = col.data_type.padEnd(20)
        const nullable = col.is_nullable === 'YES'
          ? `${c.yellow}NULL${c.reset}`
          : `${c.green}NOT NULL${c.reset}`
        const hasDefault = col.column_default
          ? `${c.dim}= ${col.column_default}${c.reset}`
          : ''

        console.log(`  ${c.bold}${name}${c.reset}  ${c.blue}${type}${c.reset}  ${nullable}  ${hasDefault}`)
      }

      console.log() // Empty line between tables
    }

    console.log(`${c.green}✓ Showing ${tables.size} table(s)${c.reset}\n`)

  } catch (error) {
    console.error(`\n${c.red}${c.bold}Error:${c.reset} ${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
}

// Parse args
const args = process.argv.slice(2)
const tableName = args[0]

showSchema(tableName)
