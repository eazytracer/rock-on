# Database Seed Data

## Overview

Seed data is now managed as **TypeScript/JSON** instead of raw SQL files. This makes it:

- ✅ Easier to maintain and update
- ✅ Reusable across SQL seeding and tests
- ✅ Type-safe with TypeScript
- ✅ Versionable and reviewable in Git

## File Structure

```
src/database/
├── seedCatalog.ts      # ⭐ Song catalog as TypeScript/JSON
├── seedMvpData.ts      # MVP seed data (users, bands, etc.)
└── README.md           # This file

scripts/
└── generateSeedSQL.ts  # Script to generate SQL from seedCatalog.ts

supabase/
├── seed-local-dev.sql        # Minimal seed (3 songs) - for dev
├── seed-full-catalog.sql     # Full catalog (19 songs) - auto-generated
└── seed-medium-catalog.sql   # Medium set (8 songs) - auto-generated
```

## Song Catalog (`seedCatalog.ts`)

The `seedCatalog.ts` file contains the complete song catalog organized by era:

```typescript
export const SEED_SONG_CATALOG = {
  '90s_rock': [
    /* 6 songs */
  ],
  '80s_rock': [
    /* 3 songs */
  ],
  '70s_rock': [
    /* 3 songs */
  ],
  '2000s': [
    /* 5 songs */
  ],
  modern: [
    /* 1 song */
  ],
  custom: [
    /* 1 song */
  ],
}
```

**Total: 19 songs**

### Adding Songs

To add new songs, edit `src/database/seedCatalog.ts`:

```typescript
{
  id: '00000000-0000-0000-0000-000000000999',
  title: 'New Song Title',
  artist: 'Artist Name',
  duration: 240,  // seconds
  key: 'C',
  tempo: 120,     // BPM
  tuning: 'Standard'
}
```

Then regenerate the SQL file:

```bash
npm run generate-seed
```

## Usage

### Generate SQL Seed Files

```bash
# Generate full catalog (19 songs)
npm run generate-seed

# Generate minimal set (3 songs) - overwrites seed-local-dev.sql
npm run generate-seed:min

# Generate medium set (8 songs)
npm run generate-seed:med
```

### Seed Database

```bash
# Seed with minimal data (fast, for dev)
psql $DATABASE_URL -f supabase/seed-local-dev.sql

# Seed with full catalog (all 19 songs)
psql $DATABASE_URL -f supabase/seed-full-catalog.sql

# Seed with medium set (8 songs)
psql $DATABASE_URL -f supabase/seed-medium-catalog.sql
```

### Use in Tests

```typescript
import { getAllSongs, getMinimalSongSet } from '../database/seedCatalog'

// Get all songs as TypeScript objects
const songs = getAllSongs() // 19 songs

// Get minimal set for fast tests
const minSongs = getMinimalSongSet() // 3 songs

// Get medium set
const medSongs = getMediumSongSet() // 8 songs

// Get songs by era
const nineties = getSongsByEra('90s_rock') // 6 songs
```

## Benefits

### Before (Raw SQL)

```sql
-- Hard to maintain
-- Duplicate data across files
-- No type safety
-- Manual updates
INSERT INTO songs VALUES ('...', 'Sweet Child O'' Mine', ...);
```

### After (TypeScript → SQL)

```typescript
// Easy to maintain
// Single source of truth
// Type-safe
// Auto-generate SQL
{
  title: 'Sweet Child O\' Mine',
  artist: 'Guns N\' Roses',
  // ...
}
```

## Development Workflow

1. **Edit songs**: Update `src/database/seedCatalog.ts`
2. **Generate SQL**: Run `npm run generate-seed`
3. **Seed database**: Run `psql $DATABASE_URL -f supabase/seed-full-catalog.sql`
4. **Verify**: Check songs appear in app

## Testing Workflow

```typescript
import { getMinimalSongSet } from '../database/seedCatalog'

describe('Song Tests', () => {
  it('should work with seed data', () => {
    const songs = getMinimalSongSet()
    expect(songs).toHaveLength(3)
    expect(songs[0].title).toBe('Wonderwall')
  })
})
```

## Available Song Sets

| Set         | Songs | Use Case          | Command                     |
| ----------- | ----- | ----------------- | --------------------------- |
| **Minimal** | 3     | Fast dev/tests    | `npm run generate-seed:min` |
| **Medium**  | 8     | Integration tests | `npm run generate-seed:med` |
| **Full**    | 19    | Complete catalog  | `npm run generate-seed`     |

## Song Catalog Contents

### 90s Rock (6 songs)

- All Star (Smash Mouth)
- Wonderwall (Oasis)
- Man in the Box (Alice In Chains)
- Smells Like Teen Spirit (Nirvana)
- Black (Pearl Jam)
- Enter Sandman (Metallica)

### 80s Rock (3 songs)

- Sweet Child O' Mine (Guns N' Roses)
- Livin' on a Prayer (Bon Jovi)
- Jump (Van Halen)

### 70s Rock (3 songs)

- Hotel California (Eagles)
- Dream On (Aerosmith)
- Free Bird (Lynyrd Skynyrd)

### 2000s (5 songs)

- Mr. Brightside (The Killers)
- Hey There Delilah (Plain White T's)
- Seven Nation Army (The White Stripes)
- The Remedy (Jason Mraz)
- Ocean Avenue (Yellowcard)

### Modern (1 song)

- Shallow (Lady Gaga & Bradley Cooper)

### Custom (1 song)

- A song (Someone)

## Maintenance

### To add a new song:

1. Edit `src/database/seedCatalog.ts`
2. Add song to appropriate era array
3. Run `npm run generate-seed`
4. Commit both `.ts` and `.sql` files

### To update a song:

1. Edit song in `src/database/seedCatalog.ts`
2. Run `npm run generate-seed`
3. Re-seed database: `supabase db reset && psql $DATABASE_URL -f supabase/seed-full-catalog.sql`

### To remove a song:

1. Remove from `src/database/seedCatalog.ts`
2. Run `npm run generate-seed`
3. Re-seed database

## Migration from Old Approach

Old files (deleted in Phase 1):

- ❌ `supabase/seed-full-catalog.sql` (static)
- ❌ `supabase/seed-full-catalog-random-ids.sql`
- ❌ Multiple duplicate seed files

New approach:

- ✅ `src/database/seedCatalog.ts` (source of truth)
- ✅ Generated SQL files (auto-generated)
- ✅ Single maintenance point

## Future Enhancements

Possible additions to `seedCatalog.ts`:

- [ ] Lyrics/notes field
- [ ] Album information
- [ ] Release year
- [ ] Genre tags
- [ ] Difficulty ratings
- [ ] Capo positions
- [ ] Original artist URLs
