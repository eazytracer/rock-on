---
title: Song Archiving & Setlist Fork Tracking - Schema Design
created: 2025-10-27T00:37
prompt: User wants songs to be archived (not deleted) when referenced in setlists/shows, and forked setlists to track their source. Design database schema changes and implementation logic.
status: Schema Design
priority: P0 - Critical (Data Integrity)
---

# Song Archiving & Setlist Fork Tracking - Schema Design

## Executive Summary

**Problem**: Current design allows:
- ❌ Hard deletion of songs even when used in setlists/shows
- ❌ Forked setlists lose connection to their source
- ❌ No way to track song usage history
- ❌ Risk of breaking historical data

**Solution**:
1. **Song Archiving**: Soft-delete songs that are referenced (mark as archived)
2. **Fork Tracking**: Link forked setlists to their source
3. **Reference Checking**: Verify song usage before allowing deletion
4. **Historical Integrity**: Preserve all past show/setlist data

**Impact**: Prevents data loss and maintains data integrity for historical records.

---

## Design Principles

### 1. Soft Delete Pattern
- Songs referenced in setlists/shows cannot be hard-deleted
- Instead, mark as `status='archived'`
- Archived songs:
  - ✅ Still visible in historical setlists/shows
  - ✅ Still appear in past performance data
  - ❌ Hidden from "Add Song" dropdowns
  - ❌ Hidden from song library (unless "Show Archived" enabled)

### 2. Fork Provenance
- Forked setlists maintain link to source via `forked_from`
- Track when fork was created
- Enable features like:
  - "Show me all shows using this setlist"
  - "Compare fork to original"
  - "Update fork from source" (future)

### 3. Reference Integrity
- Before deleting a song, check if it's used in:
  - Setlists (in `items` JSONB array)
  - Practice sessions/shows (in `songs` JSONB array)
  - Song castings (in `song_castings` table)
- If referenced, archive instead of delete
- Show user where song is used

### 4. Un-archiving Support
- Archived songs can be restored to active
- Clear "archived by" and "archived date" on restore
- Archived songs remain editable (metadata only)

---

## Database Schema Changes

### Change 1: Add Archive Status to Songs

**Migration**: `20251027000004_add_song_archiving.sql`

```sql
-- Migration: Add archiving support to songs table
-- Created: 2025-10-27
-- Purpose: Enable soft-delete for songs referenced in setlists/shows

BEGIN;

-- Add status column with default 'active'
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT;

-- Add constraint for valid status values
ALTER TABLE public.songs
  ADD CONSTRAINT songs_status_check
    CHECK (status IN ('active', 'archived'));

-- Add index for filtering active songs (common query)
CREATE INDEX IF NOT EXISTS idx_songs_status
  ON public.songs(status);

-- Composite index for active songs by band
CREATE INDEX IF NOT EXISTS idx_songs_active_by_band
  ON public.songs(context_id, status)
  WHERE context_type = 'band' AND status = 'active';

-- Composite index for active personal songs
CREATE INDEX IF NOT EXISTS idx_songs_active_personal
  ON public.songs(created_by, status)
  WHERE context_type = 'personal' AND status = 'active';

-- Add column comments
COMMENT ON COLUMN public.songs.status IS
  'Song status: active (visible in library) or archived (soft-deleted, only visible in history)';
COMMENT ON COLUMN public.songs.archived_date IS
  'When song was archived (NULL if active)';
COMMENT ON COLUMN public.songs.archived_by IS
  'User who archived the song (NULL if active)';
COMMENT ON COLUMN public.songs.archived_reason IS
  'Optional reason for archiving, e.g., "Referenced in 3 setlists"';

COMMIT;
```

**Field Details**:

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `status` | TEXT | No | 'active' | 'active' or 'archived' |
| `archived_date` | TIMESTAMPTZ | Yes | NULL | When archived |
| `archived_by` | UUID (FK) | Yes | NULL | Who archived it |
| `archived_reason` | TEXT | Yes | NULL | Why it was archived |

**Validation**:
```sql
-- Test archiving a song
UPDATE songs
SET
  status = 'archived',
  archived_date = NOW(),
  archived_by = auth.uid(),
  archived_reason = 'Referenced in 3 setlists and 2 shows'
WHERE id = '<test-song-id>'
RETURNING *;

-- Verify active songs query
SELECT * FROM songs
WHERE status = 'active'
AND context_type = 'band'
AND context_id = '<band-id>';

-- Verify archived songs excluded
SELECT COUNT(*) FROM songs WHERE status = 'active'; -- Should exclude archived
SELECT COUNT(*) FROM songs WHERE status = 'archived'; -- Should show only archived
```

---

### Change 2: Add Fork Tracking to Setlists

**Migration**: `20251027000005_add_setlist_fork_tracking.sql`

```sql
-- Migration: Add fork tracking to setlists table
-- Created: 2025-10-27
-- Purpose: Track when setlists are forked for shows and maintain link to source

BEGIN;

-- Add fork tracking columns
ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS forked_from UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fork_created_at TIMESTAMPTZ;

-- Add index for finding all forks of a setlist
CREATE INDEX IF NOT EXISTS idx_setlists_forked_from
  ON public.setlists(forked_from)
  WHERE forked_from IS NOT NULL;

-- Add index for recent forks
CREATE INDEX IF NOT EXISTS idx_setlists_fork_date
  ON public.setlists(fork_created_at DESC)
  WHERE fork_created_at IS NOT NULL;

-- Add column comments
COMMENT ON COLUMN public.setlists.forked_from IS
  'Reference to source setlist if this is a fork (NULL if original). Used when forking setlist for a show.';
COMMENT ON COLUMN public.setlists.fork_created_at IS
  'When this setlist was forked from source (NULL if original)';

COMMIT;
```

**Field Details**:

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `forked_from` | UUID (FK) | Yes | NULL | Source setlist ID |
| `fork_created_at` | TIMESTAMPTZ | Yes | NULL | When fork was created |

**Fork Relationship**:
```
Original Setlist (id: A)
  ├─> Fork 1 (id: B, forked_from: A) → Show 1
  ├─> Fork 2 (id: C, forked_from: A) → Show 2
  └─> Fork 3 (id: D, forked_from: A) → Show 3

Query: "Find all shows using this setlist"
  → Find forks where forked_from = A
  → Join to practice_sessions via show_id
```

**Validation**:
```sql
-- Test fork tracking
INSERT INTO setlists (
  band_id,
  name,
  created_by,
  forked_from,
  fork_created_at
) VALUES (
  '<band-id>',
  'Standard Set (New Year Show)',
  auth.uid(),
  '<source-setlist-id>',
  NOW()
) RETURNING *;

-- Find all forks of a setlist
SELECT
  s.id,
  s.name,
  s.fork_created_at,
  ps.name AS show_name,
  ps.scheduled_date
FROM setlists s
LEFT JOIN practice_sessions ps ON s.show_id = ps.id
WHERE s.forked_from = '<source-setlist-id>'
ORDER BY s.fork_created_at DESC;

-- Find source of a fork
SELECT
  fork.id AS fork_id,
  fork.name AS fork_name,
  source.id AS source_id,
  source.name AS source_name
FROM setlists fork
JOIN setlists source ON fork.forked_from = source.id
WHERE fork.id = '<fork-id>';
```

---

## Application Layer Changes

### Change 3: Song Reference Checking Service

**New Service**: `src/services/SongReferenceService.ts`

```typescript
export interface SongReference {
  type: 'setlist' | 'practice_session' | 'show' | 'casting'
  id: string
  name: string
  date?: Date
  context?: string
}

export class SongReferenceService {
  constructor(private repository: Repository) {}

  /**
   * Find all references to a song across the database
   */
  async findSongReferences(songId: string): Promise<SongReference[]> {
    const references: SongReference[] = []

    // Check setlists
    const setlistRefs = await this.findSetlistReferences(songId)
    references.push(...setlistRefs)

    // Check practice sessions (including shows)
    const sessionRefs = await this.findSessionReferences(songId)
    references.push(...sessionRefs)

    // Check song castings
    const castingRefs = await this.findCastingReferences(songId)
    references.push(...castingRefs)

    return references
  }

  /**
   * Find setlists containing this song
   */
  private async findSetlistReferences(songId: string): Promise<SongReference[]> {
    const setlists = await this.repository.getAllSetlists()
    const references: SongReference[] = []

    for (const setlist of setlists) {
      // Check if song is in setlist items
      const hasSong = setlist.items?.some(item => {
        if (item.type === 'song') {
          return item.songId === songId
        }
        return false
      })

      if (hasSong) {
        references.push({
          type: 'setlist',
          id: setlist.id,
          name: setlist.name,
          context: `Setlist: ${setlist.name}`,
        })
      }
    }

    return references
  }

  /**
   * Find practice sessions/shows containing this song
   */
  private async findSessionReferences(songId: string): Promise<SongReference[]> {
    const sessions = await this.repository.getAllPracticeSessions()
    const references: SongReference[] = []

    for (const session of sessions) {
      const hasSong = session.songs?.some(s => s.songId === songId)

      if (hasSong) {
        const isShow = session.type === 'gig'
        references.push({
          type: isShow ? 'show' : 'practice_session',
          id: session.id,
          name: isShow ? session.name || 'Untitled Show' : 'Practice Session',
          date: session.scheduledDate,
          context: isShow
            ? `Show: ${session.name} (${session.scheduledDate?.toLocaleDateString()})`
            : `Practice: ${session.scheduledDate?.toLocaleDateString()}`,
        })
      }
    }

    return references
  }

  /**
   * Find song castings for this song
   */
  private async findCastingReferences(songId: string): Promise<SongReference[]> {
    // Note: This requires song_castings table query
    // If you haven't implemented castings yet, can skip for now
    return []
  }

  /**
   * Check if song can be safely deleted (no references)
   */
  async canDeleteSong(songId: string): Promise<boolean> {
    const references = await this.findSongReferences(songId)
    return references.length === 0
  }

  /**
   * Get user-friendly message about song references
   */
  async getReferenceSummary(songId: string): Promise<string> {
    const references = await this.findSongReferences(songId)

    if (references.length === 0) {
      return 'This song is not used anywhere and can be safely deleted.'
    }

    const setlistCount = references.filter(r => r.type === 'setlist').length
    const showCount = references.filter(r => r.type === 'show').length
    const practiceCount = references.filter(r => r.type === 'practice_session').length

    const parts = []
    if (setlistCount > 0) parts.push(`${setlistCount} setlist${setlistCount > 1 ? 's' : ''}`)
    if (showCount > 0) parts.push(`${showCount} show${showCount > 1 ? 's' : ''}`)
    if (practiceCount > 0) parts.push(`${practiceCount} practice session${practiceCount > 1 ? 's' : ''}`)

    return `This song is used in ${parts.join(', ')}. It will be archived instead of deleted.`
  }
}
```

---

### Change 4: Song Archiving Service

**New Service**: `src/services/SongArchivingService.ts`

```typescript
export interface ArchiveResult {
  archived: boolean
  deleted: boolean
  reason?: string
  references?: SongReference[]
}

export class SongArchivingService {
  constructor(
    private repository: Repository,
    private referenceService: SongReferenceService
  ) {}

  /**
   * Delete or archive a song based on references
   */
  async deleteSong(songId: string): Promise<ArchiveResult> {
    const song = await this.repository.getSong(songId)
    if (!song) {
      throw new Error(`Song ${songId} not found`)
    }

    // Check if song is referenced
    const references = await this.referenceService.findSongReferences(songId)

    if (references.length > 0) {
      // Archive instead of delete
      const reason = await this.referenceService.getReferenceSummary(songId)
      await this.archiveSong(songId, reason)

      return {
        archived: true,
        deleted: false,
        reason,
        references,
      }
    } else {
      // Safe to hard delete
      await this.repository.deleteSong(songId)

      return {
        archived: false,
        deleted: true,
      }
    }
  }

  /**
   * Archive a song (soft delete)
   */
  async archiveSong(songId: string, reason?: string): Promise<void> {
    const now = new Date()

    await this.repository.updateSong(songId, {
      status: 'archived',
      archivedDate: now,
      archivedBy: this.getCurrentUserId(), // From auth context
      archivedReason: reason,
    })
  }

  /**
   * Restore an archived song
   */
  async restoreSong(songId: string): Promise<void> {
    await this.repository.updateSong(songId, {
      status: 'active',
      archivedDate: undefined,
      archivedBy: undefined,
      archivedReason: undefined,
    })
  }

  /**
   * Get all archived songs
   */
  async getArchivedSongs(bandId?: string): Promise<Song[]> {
    const allSongs = await this.repository.getAllSongs()
    return allSongs.filter(s =>
      s.status === 'archived' &&
      (!bandId || s.contextId === bandId)
    )
  }

  private getCurrentUserId(): string {
    // Get from auth context
    return 'current-user-id' // Placeholder
  }
}
```

---

### Change 5: Setlist Forking Service (Updated)

**Updated Service**: `src/services/SetlistForkingService.ts`

```typescript
export class SetlistForkingService {
  constructor(private repository: Repository) {}

  /**
   * Fork a setlist for a show
   * Creates a copy with link to source
   */
  async forkSetlistForShow(
    sourceSetlistId: string,
    showName: string
  ): Promise<Setlist> {
    // Get source setlist
    const source = await this.repository.getSetlist(sourceSetlistId)
    if (!source) {
      throw new Error(`Setlist ${sourceSetlistId} not found`)
    }

    // Create fork with source tracking
    const forked: Setlist = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (${showName})`,
      showId: undefined, // Will be set after show creation

      // Fork tracking
      forkedFrom: source.id,
      forkCreatedAt: new Date(),

      // Reset metadata
      createdDate: new Date(),
      lastModified: new Date(),
      status: 'draft', // Forked setlist starts as draft
    }

    await this.repository.addSetlist(forked)
    return forked
  }

  /**
   * Create show with forked setlist in single operation
   */
  async createShowWithForkedSetlist(
    showData: Partial<PracticeSession>,
    sourceSetlistId?: string
  ): Promise<{ show: PracticeSession; setlist?: Setlist }> {
    let forkedSetlist: Setlist | undefined

    // Fork setlist if source provided
    if (sourceSetlistId) {
      forkedSetlist = await this.forkSetlistForShow(
        sourceSetlistId,
        showData.name || 'Untitled Show'
      )
      showData.setlistId = forkedSetlist.id
    }

    // Create show
    const show = await this.repository.addPracticeSession({
      ...showData,
      type: 'gig',
    } as PracticeSession)

    // Link forked setlist back to show
    if (forkedSetlist) {
      await this.repository.updateSetlist(forkedSetlist.id, {
        showId: show.id,
      })
    }

    return { show, setlist: forkedSetlist }
  }

  /**
   * Find all forks of a setlist
   */
  async findForksOfSetlist(sourceSetlistId: string): Promise<Setlist[]> {
    const allSetlists = await this.repository.getAllSetlists()
    return allSetlists.filter(s => s.forkedFrom === sourceSetlistId)
  }

  /**
   * Get fork lineage (source and all forks)
   */
  async getForkLineage(setlistId: string): Promise<{
    source?: Setlist
    forks: Setlist[]
    isOriginal: boolean
  }> {
    const setlist = await this.repository.getSetlist(setlistId)
    if (!setlist) {
      throw new Error(`Setlist ${setlistId} not found`)
    }

    let source: Setlist | undefined
    let forks: Setlist[] = []

    if (setlist.forkedFrom) {
      // This is a fork, get its source
      source = await this.repository.getSetlist(setlist.forkedFrom)
      return {
        source,
        forks: [],
        isOriginal: false,
      }
    } else {
      // This is original, get all forks
      forks = await this.findForksOfSetlist(setlistId)
      return {
        source: undefined,
        forks,
        isOriginal: true,
      }
    }
  }
}
```

---

## TypeScript Type Updates

### Update Song Interface

**File**: `src/types/index.ts` or `src/models/Song.ts`

```typescript
export type SongStatus = 'active' | 'archived'

export interface Song {
  id: string
  title: string
  artist?: string
  // ... existing fields ...

  // Archiving fields
  status: SongStatus
  archivedDate?: Date
  archivedBy?: string  // User ID
  archivedReason?: string
}
```

### Update Setlist Interface

**File**: `src/types/index.ts` or `src/models/Setlist.ts`

```typescript
export interface Setlist {
  id: string
  name: string
  // ... existing fields ...

  // Fork tracking fields
  forkedFrom?: string      // Source setlist ID
  forkCreatedAt?: Date     // When fork was created
}
```

---

## RemoteRepository Mapping Updates

### Song Mapping (Add Archive Fields)

```typescript
// In RemoteRepository.ts

private mapSongToSupabase(song: Song): any {
  return {
    // ... existing fields ...

    // Archive fields
    status: song.status || 'active',
    archived_date: song.archivedDate?.toISOString() || null,
    archived_by: song.archivedBy || null,
    archived_reason: song.archivedReason || null,
  }
}

private mapSongFromSupabase(row: any): Song {
  return {
    // ... existing fields ...

    // Archive fields
    status: row.status || 'active',
    archivedDate: row.archived_date ? new Date(row.archived_date) : undefined,
    archivedBy: row.archived_by || undefined,
    archivedReason: row.archived_reason || undefined,
  }
}
```

### Setlist Mapping (Add Fork Fields)

```typescript
// In RemoteRepository.ts

private mapSetlistToSupabase(setlist: Setlist): any {
  return {
    // ... existing fields ...

    // Fork tracking fields
    forked_from: setlist.forkedFrom || null,
    fork_created_at: setlist.forkCreatedAt?.toISOString() || null,
  }
}

private mapSetlistFromSupabase(row: any): Setlist {
  return {
    // ... existing fields ...

    // Fork tracking fields
    forkedFrom: row.forked_from || undefined,
    forkCreatedAt: row.fork_created_at ? new Date(row.fork_created_at) : undefined,
  }
}
```

---

## UI Changes Required

### Song List Page

**Changes**:
1. Filter out archived songs by default
2. Add "Show archived" toggle
3. Show archived badge on archived songs
4. Update delete button behavior

```typescript
// SongsPage.tsx

const [showArchived, setShowArchived] = useState(false)

// Filter songs
const displayedSongs = useMemo(() => {
  let filtered = allSongs

  // Filter by status
  if (!showArchived) {
    filtered = filtered.filter(s => s.status === 'active')
  }

  return filtered
}, [allSongs, showArchived])

// Delete handler
const handleDelete = async (songId: string) => {
  const result = await archivingService.deleteSong(songId)

  if (result.archived) {
    // Show archive confirmation
    toast.info(
      `Song archived (used in ${result.references?.length} places). ` +
      `Enable "Show archived" to view.`
    )
  } else {
    // Show delete confirmation
    toast.success('Song deleted')
  }

  refetch()
}

// UI
<div>
  <label>
    <input
      type="checkbox"
      checked={showArchived}
      onChange={(e) => setShowArchived(e.target.checked)}
    />
    Show archived songs
  </label>
</div>

{displayedSongs.map(song => (
  <div key={song.id}>
    {song.title}
    {song.status === 'archived' && (
      <Badge>Archived</Badge>
    )}
    <button onClick={() => handleDelete(song.id)}>
      Delete
    </button>
  </div>
))}
```

### Delete Confirmation Modal

**New Component**: `SongDeleteConfirmation.tsx`

```typescript
interface Props {
  song: Song
  references: SongReference[]
  onConfirm: () => void
  onCancel: () => void
}

export function SongDeleteConfirmation({ song, references, onConfirm, onCancel }: Props) {
  const canDelete = references.length === 0

  return (
    <Modal>
      <h3>
        {canDelete ? 'Delete Song?' : 'Archive Song?'}
      </h3>

      {canDelete ? (
        <p>
          This song is not used anywhere and will be permanently deleted.
        </p>
      ) : (
        <>
          <p>
            This song cannot be deleted because it's used in:
          </p>
          <ul>
            {references.map(ref => (
              <li key={ref.id}>
                {ref.context}
              </li>
            ))}
          </ul>
          <p>
            The song will be <strong>archived</strong> instead. It will:
          </p>
          <ul>
            <li>✅ Remain visible in past setlists and shows</li>
            <li>❌ Be hidden from the song library</li>
            <li>❌ Not appear in "Add Song" dropdowns</li>
          </ul>
          <p>
            You can restore it later from the archived songs list.
          </p>
        </>
      )}

      <div>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>
          {canDelete ? 'Delete Permanently' : 'Archive Song'}
        </button>
      </div>
    </Modal>
  )
}
```

### Setlist Detail Page

**Changes**:
1. Show fork source if applicable
2. Link to source setlist
3. Show all forks if this is original

```typescript
// SetlistDetailPage.tsx

const { source, forks, isOriginal } = await forkingService.getForkLineage(setlistId)

// UI
{source && (
  <div className="fork-info">
    <span>Forked from:</span>
    <Link to={`/setlists/${source.id}`}>
      {source.name}
    </Link>
    <span className="fork-date">
      {setlist.forkCreatedAt?.toLocaleDateString()}
    </span>
  </div>
)}

{isOriginal && forks.length > 0 && (
  <div className="forks-list">
    <h4>Shows using this setlist:</h4>
    <ul>
      {forks.map(fork => (
        <li key={fork.id}>
          <Link to={`/setlists/${fork.id}`}>
            {fork.name}
          </Link>
          {fork.showId && (
            <Link to={`/shows/${fork.showId}`}>
              (View Show)
            </Link>
          )}
        </li>
      ))}
    </ul>
  </div>
)}
```

### Shows Page - Create Modal

**Changes**:
1. Option to select source setlist
2. Checkbox to fork (enabled by default)
3. Preview of forked name

```typescript
// ShowsPage.tsx - Create modal

const [sourceSetlistId, setSourceSetlistId] = useState<string>()
const [shouldFork, setShouldFork] = useState(true)

// Preview forked name
const forkedName = useMemo(() => {
  if (!sourceSetlistId || !shouldFork) return null

  const source = setlists.find(s => s.id === sourceSetlistId)
  if (!source) return null

  return `${source.name} (${formData.name || 'Untitled Show'})`
}, [sourceSetlistId, shouldFork, formData.name, setlists])

// Submit handler
const handleSubmit = async () => {
  if (shouldFork && sourceSetlistId) {
    const { show, setlist } = await forkingService.createShowWithForkedSetlist(
      formData,
      sourceSetlistId
    )
    toast.success(`Show created with forked setlist: ${setlist?.name}`)
  } else {
    const show = await showsService.createShow(formData)
    toast.success('Show created')
  }
}

// UI
<FormField label="Use Existing Setlist">
  <Select
    value={sourceSetlistId}
    onChange={(e) => setSourceSetlistId(e.target.value)}
  >
    <option value="">None (create setlist later)</option>
    {setlists.filter(s => s.status === 'active').map(sl => (
      <option key={sl.id} value={sl.id}>
        {sl.name}
      </option>
    ))}
  </Select>

  {sourceSetlistId && (
    <div className="fork-option">
      <label>
        <input
          type="checkbox"
          checked={shouldFork}
          onChange={(e) => setShouldFork(e.target.checked)}
        />
        Create a copy for this show
      </label>
      <p className="hint">
        Recommended: Changes to the setlist won't affect the original.
      </p>

      {shouldFork && forkedName && (
        <p className="preview">
          New setlist will be named: <strong>{forkedName}</strong>
        </p>
      )}
    </div>
  )}
</FormField>
```

---

## Query Examples

### Find all archived songs
```sql
SELECT
  id,
  title,
  artist,
  status,
  archived_date,
  archived_reason
FROM songs
WHERE status = 'archived'
ORDER BY archived_date DESC;
```

### Find all forks of a setlist
```sql
SELECT
  s.id,
  s.name,
  s.fork_created_at,
  ps.id AS show_id,
  ps.name AS show_name,
  ps.scheduled_date
FROM setlists s
LEFT JOIN practice_sessions ps ON s.show_id = ps.id
WHERE s.forked_from = '<source-setlist-id>'
ORDER BY s.fork_created_at DESC;
```

### Find song references in setlists (Supabase)
```sql
-- Note: Searching JSONB arrays is complex in SQL
-- Better handled in application layer

-- Example: Find setlists containing a song
SELECT
  id,
  name,
  items
FROM setlists
WHERE items::text LIKE '%"songId":"<song-id>"%'
```

### Active songs only (common query)
```sql
SELECT *
FROM songs
WHERE status = 'active'
AND context_type = 'band'
AND context_id = '<band-id>'
ORDER BY title;
```

---

## Migration Order

Run migrations in this order:

1. **20251027000001**: Add 'gig' type *(from previous plan)*
2. **20251027000002**: Add show fields *(from previous plan)*
3. **20251027000003**: Add show-setlist FK *(from previous plan)*
4. **20251027000004**: Add song archiving *(new)*
5. **20251027000005**: Add setlist fork tracking *(new)*

---

## Testing Requirements

### Unit Tests

```typescript
describe('SongArchivingService', () => {
  it('archives song when referenced', async () => {
    const song = await createSong({ title: 'Test Song' })
    const setlist = await createSetlist({ items: [{ type: 'song', songId: song.id }] })

    const result = await archivingService.deleteSong(song.id)

    expect(result.archived).toBe(true)
    expect(result.deleted).toBe(false)
    expect(result.references).toHaveLength(1)

    const updated = await repository.getSong(song.id)
    expect(updated?.status).toBe('archived')
  })

  it('deletes song when not referenced', async () => {
    const song = await createSong({ title: 'Test Song' })

    const result = await archivingService.deleteSong(song.id)

    expect(result.deleted).toBe(true)
    expect(result.archived).toBe(false)

    const deleted = await repository.getSong(song.id)
    expect(deleted).toBeUndefined()
  })

  it('restores archived song', async () => {
    const song = await createSong({ status: 'archived' })

    await archivingService.restoreSong(song.id)

    const restored = await repository.getSong(song.id)
    expect(restored?.status).toBe('active')
    expect(restored?.archivedDate).toBeUndefined()
  })
})

describe('SetlistForkingService', () => {
  it('tracks fork source', async () => {
    const source = await createSetlist({ name: 'Original' })

    const fork = await forkingService.forkSetlistForShow(source.id, 'Test Show')

    expect(fork.forkedFrom).toBe(source.id)
    expect(fork.forkCreatedAt).toBeDefined()
    expect(fork.name).toContain('Test Show')
  })

  it('finds all forks of setlist', async () => {
    const source = await createSetlist({ name: 'Original' })
    const fork1 = await forkingService.forkSetlistForShow(source.id, 'Show 1')
    const fork2 = await forkingService.forkSetlistForShow(source.id, 'Show 2')

    const forks = await forkingService.findForksOfSetlist(source.id)

    expect(forks).toHaveLength(2)
    expect(forks.map(f => f.id)).toContain(fork1.id)
    expect(forks.map(f => f.id)).toContain(fork2.id)
  })
})
```

---

## RLS Policy Updates

### Songs Table - Filter Archived by Default

```sql
-- Update SELECT policy to exclude archived by default in normal queries
-- But allow viewing archived in specific contexts (e.g., historical setlists)

-- Option 1: Filter archived in application layer (recommended)
-- Keep RLS simple, filter in queries

-- Option 2: Create separate policies for active vs all
CREATE POLICY "songs_select_active" ON songs
  FOR SELECT
  USING (
    status = 'active'
    AND (
      created_by = auth.uid()
      OR (
        context_type = 'band'
        AND EXISTS (
          SELECT 1 FROM band_memberships
          WHERE band_id::text = context_id
          AND user_id = auth.uid()
          AND status = 'active'
        )
      )
    )
  );

-- Separate policy for viewing all songs (including archived) with specific permission
CREATE POLICY "songs_select_all_including_archived" ON songs
  FOR SELECT
  USING (
    -- Can view archived if you created it or are band admin
    created_by = auth.uid()
    OR (
      context_type = 'band'
      AND EXISTS (
        SELECT 1 FROM band_memberships
        WHERE band_id::text = context_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner')
        AND status = 'active'
      )
    )
  );
```

**Recommendation**: Keep RLS simple and filter archived songs in application queries. This is more flexible and easier to maintain.

---

## Summary of Changes

### Database Schema (5 new migrations)

| Migration | Purpose | Tables Affected | New Columns |
|-----------|---------|-----------------|-------------|
| 20251027000001 | Add 'gig' type | practice_sessions | None (constraint update) |
| 20251027000002 | Add show fields | practice_sessions | name, venue, load_in_time, soundcheck_time, payment, contacts |
| 20251027000003 | Add show-setlist FK | setlists | None (FK constraint) |
| **20251027000004** | **Add song archiving** | **songs** | **status, archived_date, archived_by, archived_reason** |
| **20251027000005** | **Add fork tracking** | **setlists** | **forked_from, fork_created_at** |

### Application Code

| Component | Changes | Priority |
|-----------|---------|----------|
| SongReferenceService | New service to find references | P0 |
| SongArchivingService | New service for archiving logic | P0 |
| SetlistForkingService | Updated with fork tracking | P0 |
| RemoteRepository | Add mapping for new fields | P0 |
| SongsPage | Filter archived, show toggle | P1 |
| SetlistDetailPage | Show fork lineage | P1 |
| ShowsPage | Fork option in create modal | P1 |
| Delete modals | Show reference info | P1 |

### TypeScript Types

- Add `SongStatus` type
- Update `Song` interface with archive fields
- Update `Setlist` interface with fork fields
- Add `SongReference` interface
- Add `ArchiveResult` interface

---

## Implementation Timeline

**Phase 1: Database (1 hour)**
- Create 5 migration files
- Test migrations locally
- Verify constraints and indexes

**Phase 2: Core Services (2 hours)**
- Implement SongReferenceService
- Implement SongArchivingService
- Update SetlistForkingService
- Update RemoteRepository mappings

**Phase 3: UI Updates (2-3 hours)**
- Update SongsPage with archive filtering
- Add delete confirmation with references
- Update SetlistDetailPage with fork info
- Update ShowsPage with fork option

**Phase 4: Testing (1 hour)**
- Write unit tests
- Test with Chrome MCP
- Verify sync to Supabase

**Total Time: 6-7 hours**

---

## Questions for User

1. **Un-archiving**: Should users be able to restore archived songs? If so, should it be:
   - Automatic (if references are removed)?
   - Manual (via "Restore" button)?
   - Admin-only?

2. **Archive Visibility**: Where should archived songs be visible?
   - ✅ Historical setlists/shows (always)
   - ❓ Search results (with "include archived" option)?
   - ❓ Song reports/analytics?

3. **Fork Updates**: Should we support updating forks from source?
   - Example: "Update this show's setlist with latest from master"
   - Could be useful if you update the master after forking

4. **Fork Depth**: Should we allow forking a fork?
   - Example: Fork a show's setlist for another show
   - Or enforce "only fork originals"?

5. **Ready to proceed?**: Should I start creating these migrations and services?

---

**Status**: Schema designed, ready for implementation
**Next Action**: User review and answers to questions above
