#!/usr/bin/env tsx
/**
 * Generate SQL seed files from TypeScript song catalog
 *
 * Usage:
 *   npm run generate-seed       # Generate full catalog
 *   npm run generate-seed:min   # Generate minimal (3 songs)
 *   npm run generate-seed:med   # Generate medium (8 songs)
 */

import {
  getAllSongs,
  getMinimalSongSet,
  getMediumSongSet,
  generateSongInsertSQL,
  getTotalSongCount
} from '../src/database/seedCatalog'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

type SeedType = 'full' | 'minimal' | 'medium'

function generateSeedFile(type: SeedType = 'full') {
  const bandId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
  const userId = '7e75840e-9d91-422e-a949-849f0b8e2ea4'

  let songSQL: string
  let songCount: number
  let filename: string
  let description: string

  switch (type) {
    case 'minimal':
      const minSongs = getMinimalSongSet()
      songCount = minSongs.length
      filename = 'seed-local-dev.sql'
      description = 'minimal test set (3 songs)'
      songSQL = generateMinimalSQL(bandId, userId)
      break

    case 'medium':
      const medSongs = getMediumSongSet()
      songCount = medSongs.length
      filename = 'seed-medium-catalog.sql'
      description = 'medium test set (8 songs)'
      songSQL = generateMediumSQL(bandId, userId)
      break

    case 'full':
    default:
      songCount = getTotalSongCount()
      filename = 'seed-full-catalog.sql'
      description = `full catalog (${songCount} songs)`
      songSQL = generateSongInsertSQL(bandId, userId)
      break
  }

  const template = `-- =====================================================
-- Rock On - ${description.toUpperCase()}
-- =====================================================
-- Auto-generated from src/database/seedCatalog.ts
-- Generated: ${new Date().toISOString()}
-- =====================================================

DO $$
DECLARE
  v_band_id UUID := '${bandId}'::uuid;
  v_eric_id UUID := '${userId}'::uuid;
BEGIN

  -- Delete existing songs for clean slate
  DELETE FROM public.songs WHERE context_id = v_band_id::text;

  -- Insert songs from catalog
${songSQL}

  RAISE NOTICE '✅ Seeded % songs to Supabase', (SELECT COUNT(*) FROM public.songs WHERE context_id = v_band_id::text);

END $$;

-- Verify
SELECT COUNT(*) as total_songs FROM public.songs WHERE context_id = '${bandId}';
`

  const outputPath = join(__dirname, '..', 'supabase', filename)
  writeFileSync(outputPath, template, 'utf-8')

  console.log(`✅ Generated ${filename} with ${songCount} songs`)
  console.log(`   Location: supabase/${filename}`)

  return outputPath
}

function generateMinimalSQL(bandId: string, userId: string): string {
  const songs = getMinimalSongSet()
  const values = songs.map(song => {
    const title = song.title.replace(/'/g, "''")
    const artist = song.artist.replace(/'/g, "''")

    return `    ('${song.id}', '${title}', '${artist}', ${song.duration}, '${song.key}', ${song.tempo}, NOW(), NOW(), '${userId}', 'band', '${bandId}')`
  }).join(',\n')

  return `  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo,
    created_date, updated_date, created_by,
    context_type, context_id
  ) VALUES
${values};`
}

function generateMediumSQL(bandId: string, userId: string): string {
  const songs = getMediumSongSet()
  const values = songs.map(song => {
    const title = song.title.replace(/'/g, "''")
    const artist = song.artist.replace(/'/g, "''")

    return `    ('${song.id}', '${title}', '${artist}', ${song.duration}, '${song.key}', ${song.tempo}, NOW(), NOW(), '${userId}', 'band', '${bandId}')`
  }).join(',\n')

  return `  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo,
    created_date, updated_date, created_by,
    context_type, context_id
  ) VALUES
${values};`
}

// Main execution
const args = process.argv.slice(2)
const seedType: SeedType = args[0] as SeedType || 'full'

if (!['full', 'minimal', 'medium'].includes(seedType)) {
  console.error('Invalid seed type. Use: full, minimal, or medium')
  process.exit(1)
}

generateSeedFile(seedType)
