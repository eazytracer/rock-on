#!/usr/bin/env npx ts-node
/**
 * Generate Mermaid ER Diagram from Baseline Schema Migration
 *
 * This script parses the baseline SQL migration and generates a Mermaid ER diagram.
 * It extracts:
 * - Table names
 * - Column definitions (name, type, constraints)
 * - Foreign key relationships
 *
 * Usage:
 *   npx ts-node scripts/generate-er-diagram.ts
 *   npx ts-node scripts/generate-er-diagram.ts --check  # Validate current diagram is up-to-date
 *
 * The generated diagram is written to:
 *   src/pages/DevDashboard/diagrams/generated/erDiagram.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const MIGRATION_FILE = 'supabase/migrations/20251106000000_baseline_schema.sql'
const OUTPUT_FILE = 'src/pages/DevDashboard/diagrams/generated/erDiagram.ts'

interface Column {
  name: string
  type: string
  constraints: string[]
  references?: {
    table: string
    column: string
  }
}

interface Table {
  name: string
  columns: Column[]
}

interface Relationship {
  from: string
  to: string
  fromColumn: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-one'
}

function parseSQL(sql: string): {
  tables: Table[]
  relationships: Relationship[]
} {
  const tables: Table[] = []
  const relationships: Relationship[] = []

  // Match CREATE TABLE statements
  const tableRegex = /CREATE TABLE (?:public\.)?(\w+)\s*\(([\s\S]*?)\);/g
  let match

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1]
    const columnsBlock = match[2]

    // Skip auth schema tables
    if (tableName.startsWith('auth_')) continue

    const columns: Column[] = []

    // Split by lines and process each
    const lines = columnsBlock.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip empty lines, constraints, and comments
      if (
        !trimmed ||
        trimmed.startsWith('--') ||
        trimmed.startsWith('CONSTRAINT') ||
        trimmed.startsWith('UNIQUE(') ||
        trimmed.startsWith('PRIMARY KEY') ||
        trimmed.startsWith('CHECK')
      ) {
        continue
      }

      // Parse column definition
      // Format: column_name TYPE [constraints] [REFERENCES table(col)]
      const columnMatch = trimmed.match(/^(\w+)\s+([\w\[\]()]+)(?:\s+(.*))?/)

      if (columnMatch) {
        const [, colName, colType, rest = ''] = columnMatch

        // Skip if this looks like a constraint
        if (
          ['CONSTRAINT', 'UNIQUE', 'PRIMARY', 'CHECK', 'FOREIGN'].includes(
            colName.toUpperCase()
          )
        ) {
          continue
        }

        const constraints: string[] = []

        if (rest.includes('PRIMARY KEY')) constraints.push('PK')
        if (rest.includes('NOT NULL')) constraints.push('NOT NULL')
        if (rest.includes('UNIQUE') && !rest.includes('UNIQUE('))
          constraints.push('UK')
        if (rest.includes('DEFAULT')) constraints.push('DEFAULT')

        // Check for foreign key reference
        const refMatch = rest.match(/REFERENCES\s+(?:public\.)?(\w+)\((\w+)\)/)
        let references: Column['references'] | undefined

        if (refMatch) {
          references = {
            table: refMatch[1],
            column: refMatch[2],
          }
          constraints.push('FK')

          // Add relationship
          relationships.push({
            from: tableName,
            to: refMatch[1],
            fromColumn: colName,
            toColumn: refMatch[2],
            type: 'many-to-one', // FK typically means many-to-one
          })
        }

        columns.push({
          name: colName,
          type: normalizeType(colType),
          constraints,
          references,
        })
      }
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns })
    }
  }

  return { tables, relationships }
}

function normalizeType(type: string): string {
  const typeMap: Record<string, string> = {
    UUID: 'uuid',
    TEXT: 'text',
    'TEXT[]': 'text[]',
    INTEGER: 'int',
    BOOLEAN: 'boolean',
    TIMESTAMPTZ: 'timestamptz',
    TIMESTAMP: 'timestamp',
    JSONB: 'jsonb',
    JSON: 'json',
  }
  return typeMap[type.toUpperCase()] || type.toLowerCase()
}

function generateMermaidER(
  tables: Table[],
  relationships: Relationship[]
): string {
  const lines: string[] = ['erDiagram']

  // Generate relationships first
  const seenRelationships = new Set<string>()

  for (const rel of relationships) {
    const key = `${rel.from}-${rel.to}`
    if (seenRelationships.has(key)) continue
    seenRelationships.add(key)

    // Determine relationship type based on constraints
    // For now, use ||--o{ for most FK relationships (one-to-many)
    const fromTable = tables.find(t => t.name === rel.from)
    const fromCol = fromTable?.columns.find(c => c.name === rel.fromColumn)

    let relSymbol = '||--o{'
    if (fromCol?.constraints.includes('UK')) {
      relSymbol = '||--||' // One-to-one if unique
    }

    lines.push(`    ${rel.to} ${relSymbol} ${rel.from} : "${rel.fromColumn}"`)
  }

  lines.push('')

  // Generate table definitions
  for (const table of tables) {
    lines.push(`    ${table.name} {`)

    for (const col of table.columns) {
      const constraintStr =
        col.constraints.length > 0 ? ` "${col.constraints.join(', ')}"` : ''
      lines.push(`        ${col.type} ${col.name}${constraintStr}`)
    }

    lines.push('    }')
    lines.push('')
  }

  return lines.join('\n')
}

function generateTypeScriptFile(mermaidDiagram: string): string {
  const timestamp = new Date().toISOString()

  return `/**
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 *
 * This file is generated from the baseline schema migration.
 * To regenerate: npx ts-node scripts/generate-er-diagram.ts
 *
 * Generated: ${timestamp}
 * Source: ${MIGRATION_FILE}
 */

export const generatedERDiagram = \`
${mermaidDiagram}
\`

export const generatedAt = '${timestamp}'
export const sourceFile = '${MIGRATION_FILE}'
`
}

async function main() {
  const args = process.argv.slice(2)
  const checkMode = args.includes('--check')

  // Read the migration file
  const migrationPath = path.join(process.cwd(), MIGRATION_FILE)
  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: Migration file not found: ${migrationPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8')

  // Parse and generate
  const { tables, relationships } = parseSQL(sql)
  console.log(
    `Parsed ${tables.length} tables and ${relationships.length} relationships`
  )

  const mermaidDiagram = generateMermaidER(tables, relationships)

  if (checkMode) {
    // Check if current diagram matches
    const outputPath = path.join(process.cwd(), OUTPUT_FILE)
    if (!fs.existsSync(outputPath)) {
      console.error('Error: Generated diagram file does not exist.')
      console.error('Run without --check to generate it.')
      process.exit(1)
    }

    const existing = fs.readFileSync(outputPath, 'utf-8')

    // Extract just the diagram content (ignoring timestamp)
    const existingDiagram = existing.match(
      /export const generatedERDiagram = `\n([\s\S]*?)\n`/
    )?.[1]

    if (existingDiagram?.trim() !== mermaidDiagram.trim()) {
      console.error('Error: ER diagram is out of date!')
      console.error('Run: npx ts-node scripts/generate-er-diagram.ts')
      process.exit(1)
    }

    console.log('✅ ER diagram is up to date')
    process.exit(0)
  }

  // Generate output
  const outputContent = generateTypeScriptFile(mermaidDiagram)
  const outputPath = path.join(process.cwd(), OUTPUT_FILE)

  // Ensure directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, outputContent)
  console.log(`✅ Generated ER diagram: ${OUTPUT_FILE}`)

  // Also output the table summary
  console.log('\nTables:')
  for (const table of tables) {
    console.log(`  - ${table.name} (${table.columns.length} columns)`)
  }
}

main().catch(console.error)
