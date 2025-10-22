# Database Schema Specification

**Database Name:** RockOnDB
**Technology:** Dexie.js (IndexedDB wrapper)
**Current Version:** 3
**Location:** `/workspaces/rock-on/src/services/database/index.ts`

## Important Notes

⚠️ **CRITICAL:** Always use the database from `/workspaces/rock-on/src/services/database/index.ts`

❌ **DEPRECATED:** `/workspaces/rock-on/src/database/db.ts.DEPRECATED` - DO NOT USE

## Database Versions

### Version 1: Original Schema (Legacy)
Initial implementation with basic band features.

```typescript
{
  bands: '++id, name, createdDate',
  members: '++id, name, email, isActive',
  songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel',
  practiceSessions: '++id, bandId, scheduledDate, type, status',
  setlists: '++id, name, bandId, showDate, status, createdDate, lastModified'
}
```

### Version 2: Multi-User Support
Added user authentication and multi-band support.

```typescript
{
  bands: '++id, name, createdDate',
  members: '++id, name, email, isActive',
  songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId',
  practiceSessions: '++id, bandId, scheduledDate, type, status',
  setlists: '++id, name, bandId, showDate, status, createdDate, lastModified',
  users: '++id, email, name, createdDate, lastLogin, authProvider',
  userProfiles: '++id, userId, displayName, primaryInstrument, *instruments',
  bandMemberships: '++id, userId, bandId, role, joinedDate, status, *permissions',
  inviteCodes: '++id, bandId, code, createdBy, expiresAt, currentUses'
}
```

### Version 3: Song Variant Linking (Current)
Added song group system for linking song variants across contexts.

```typescript
{
  bands: '++id, name, createdDate',
  members: '++id, name, email, isActive',
  songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId',
  practiceSessions: '++id, bandId, scheduledDate, type, status',
  setlists: '++id, name, bandId, showDate, status, createdDate, lastModified',
  users: '++id, email, name, createdDate, lastLogin, authProvider',
  userProfiles: '++id, userId, displayName, primaryInstrument, *instruments',
  bandMemberships: '++id, userId, bandId, role, joinedDate, status, *permissions',
  inviteCodes: '++id, bandId, code, createdBy, expiresAt, currentUses',
  songGroups: '++id, createdBy, name, createdDate',
  songGroupMemberships: '++id, songId, songGroupId, addedBy, addedDate'
}
```

## Table Definitions

### bands
Represents a band/group entity.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| name | string | Band name | Yes | - |
| description | string | Band description | No | - |
| createdDate | Date | Creation timestamp | Yes | auto (hook) |
| memberIds | string[] | Array of member IDs | Yes | [] |
| settings | BandSettings | Band configuration | Yes | default settings |

**Indexes:** `++id, name, createdDate`

### members
Band member records (legacy - being replaced by User system).

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| name | string | Member name | Yes | - |
| email | string | Email address | Yes | - |
| phone | string | Phone number | No | - |
| instruments | string[] | Instruments played | Yes | [] |
| primaryInstrument | string | Main instrument | Yes | - |
| role | 'admin' \| 'member' \| 'viewer' | Member role | Yes | 'member' |
| joinDate | Date | Join date | Yes | auto (hook) |
| isActive | boolean | Active status | Yes | true (hook) |

**Indexes:** `++id, name, email, isActive`

### songs
Song records with context support (personal/band).

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| title | string | Song title | Yes | - |
| artist | string | Artist name | Yes | - |
| album | string | Album name | No | - |
| duration | number | Duration in seconds | Yes | - |
| key | string | Musical key | Yes | - |
| bpm | number | Beats per minute | Yes | 120 |
| difficulty | number | Difficulty (1-5) | Yes | 3 |
| guitarTuning | string | Guitar tuning | No | - |
| lyrics | string | Song lyrics | No | - |
| notes | string | Practice notes | No | - |
| tags | string[] | Tags/categories | No | [] |
| chords | string[] | Chord progression | No | [] |
| structure | SongSection[] | Song structure | No | [] |
| referenceLinks | ReferenceLink[] | External links | No | [] |
| createdDate | Date | Creation date | Yes | auto (hook) |
| lastPracticed | Date | Last practice date | No | - |
| confidenceLevel | number | Confidence (0-5) | Yes | 1 (hook) |
| **contextType** | 'personal' \| 'band' | Song context | Yes | - |
| **contextId** | string | User ID or Band ID | Yes | - |
| **createdBy** | string | User ID who created | Yes | - |
| **visibility** | 'private' \| 'band_only' \| 'public' | Visibility level | Yes | - |
| **songGroupId** | string | Linked song group ID | No | - |
| linkedFromSongId | string | Source song if copied | No | - |

**Indexes:** `++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId`

**Context System:**
- `contextType: 'personal'` → `contextId` is the user's ID
- `contextType: 'band'` → `contextId` is the band's ID

### practiceSessions
Practice session scheduling and tracking.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| bandId | string | Associated band | Yes | - |
| scheduledDate | Date | Scheduled date/time | Yes | - |
| duration | number | Duration in minutes | Yes | - |
| location | string | Practice location | No | - |
| type | 'rehearsal' \| 'recording' \| 'gig' | Session type | Yes | - |
| status | 'scheduled' \| 'in-progress' \| 'completed' \| 'cancelled' | Session status | Yes | - |
| songs | SessionSong[] | Songs to practice | Yes | [] |
| attendees | Attendee[] | Member attendance | Yes | [] |
| notes | string | Session notes | No | - |
| objectives | string[] | Session goals | No | [] |
| completedObjectives | string[] | Completed goals | No | [] |

**Indexes:** `++id, bandId, scheduledDate, type, status`

### setlists
Setlists for performances.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| name | string | Setlist name | Yes | - |
| bandId | string | Associated band | Yes | - |
| showDate | Date | Performance date | No | - |
| venue | string | Venue name | No | - |
| songs | SetlistSong[] | Ordered song list | Yes | [] |
| totalDuration | number | Total duration (seconds) | Yes | calculated |
| notes | string | Setlist notes | No | - |
| status | 'draft' \| 'active' \| 'archived' | Setlist status | Yes | 'draft' |
| createdDate | Date | Creation date | Yes | auto (hook) |
| lastModified | Date | Last update | Yes | auto (hook) |

**Indexes:** `++id, name, bandId, showDate, status, createdDate, lastModified`

### users
User accounts for authentication.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| email | string | Email address | Yes | - |
| name | string | Display name | Yes | - |
| authProvider | 'supabase' \| 'mock' | Auth provider | Yes | - |
| createdDate | Date | Account creation | Yes | auto (hook) |
| lastLogin | Date | Last login timestamp | Yes | auto (hook) |

**Indexes:** `++id, email, name, createdDate, lastLogin, authProvider`

### userProfiles
Extended user profile information.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| userId | string | Associated user ID | Yes | - |
| displayName | string | Display name | No | - |
| bio | string | User biography | No | - |
| instruments | string[] | Instruments played | No | [] |
| primaryInstrument | string | Main instrument | No | - |
| skillLevel | 'beginner' \| 'intermediate' \| 'advanced' \| 'professional' | Skill level | No | - |
| location | string | Geographic location | No | - |
| avatarUrl | string | Profile picture URL | No | - |
| createdDate | Date | Profile creation | Yes | auto (hook) |
| updatedDate | Date | Last update | Yes | auto (hook) |

**Indexes:** `++id, userId, displayName, primaryInstrument, *instruments`

### bandMemberships
Links users to bands with roles.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| userId | string | User ID | Yes | - |
| bandId | string | Band ID | Yes | - |
| role | 'admin' \| 'member' \| 'viewer' | Member role | Yes | 'member' |
| joinedDate | Date | Join date | Yes | auto (hook) |
| status | 'active' \| 'inactive' \| 'pending' | Membership status | Yes | 'active' (hook) |
| permissions | string[] | Permission flags | Yes | ['member'] (hook) |
| nickname | string | Band-specific nickname | No | - |
| customRole | string | Custom role title | No | - |

**Indexes:** `++id, userId, bandId, role, joinedDate, status, *permissions`

### inviteCodes
Band invitation codes.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| bandId | string | Band ID | Yes | - |
| code | string | Invite code | Yes | - |
| createdBy | string | Creator user ID | Yes | - |
| createdDate | Date | Creation date | Yes | auto (hook) |
| expiresAt | Date | Expiration date | No | - |
| maxUses | number | Maximum uses | No | null (unlimited) |
| currentUses | number | Current use count | Yes | 0 (hook) |
| isActive | boolean | Active status | Yes | true |

**Indexes:** `++id, bandId, code, createdBy, expiresAt, currentUses`

### songGroups
Groups of linked song variants.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| name | string | Group name | Yes | - |
| createdBy | string | Creator user ID | Yes | - |
| description | string | Group description | No | - |
| createdDate | string (ISO) | Creation timestamp | Yes | auto (hook) |

**Indexes:** `++id, createdBy, name, createdDate`

### songGroupMemberships
Links songs to song groups.

| Field | Type | Description | Required | Default |
|-------|------|-------------|----------|---------|
| id | string (UUID) | Unique identifier | Yes | auto-generated |
| songId | string | Song ID | Yes | - |
| songGroupId | string | Song group ID | Yes | - |
| addedBy | string | User ID who added | Yes | - |
| addedDate | string (ISO) | Add timestamp | Yes | auto (hook) |
| relationship | 'original' \| 'variant' \| 'arrangement' \| 'cover' | Relationship type | Yes | 'variant' |
| notes | string | Membership notes | No | - |

**Indexes:** `++id, songId, songGroupId, addedBy, addedDate`

## Database Hooks

The database uses Dexie hooks to automatically set default values:

### Creating Hooks

```typescript
// Bands
this.bands.hook('creating', (primKey, obj, trans) => {
  obj.createdDate = new Date()
})

// Songs
this.songs.hook('creating', (primKey, obj, trans) => {
  obj.createdDate = new Date()
  obj.confidenceLevel = obj.confidenceLevel || 1
})

// Setlists
this.setlists.hook('creating', (primKey, obj, trans) => {
  obj.createdDate = new Date()
  obj.lastModified = new Date()
})

// Members
this.members.hook('creating', (primKey, obj, trans) => {
  obj.joinDate = new Date()
  obj.isActive = obj.isActive !== false
})

// Users
this.users.hook('creating', (primKey, obj, trans) => {
  obj.createdDate = new Date()
  obj.lastLogin = new Date()
})

// User Profiles
this.userProfiles.hook('creating', (primKey, obj, trans) => {
  obj.createdDate = new Date()
  obj.updatedDate = new Date()
})

// Band Memberships
this.bandMemberships.hook('creating', (primKey, obj, trans) => {
  obj.joinedDate = new Date()
  obj.status = obj.status || 'active'
  obj.permissions = obj.permissions || ['member']
})

// Invite Codes
this.inviteCodes.hook('creating', (primKey, obj, trans) => {
  obj.createdDate = new Date()
  obj.currentUses = 0
})

// Song Groups
this.songGroups.hook('creating', (primKey, obj, trans) => {
  obj.createdDate = new Date().toISOString()
})

// Song Group Memberships
this.songGroupMemberships.hook('creating', (primKey, obj, trans) => {
  obj.addedDate = new Date().toISOString()
})
```

### Updating Hooks

```typescript
// Setlists
this.setlists.hook('updating', (modifications, primKey, obj, trans) => {
  modifications.lastModified = new Date()
})

// User Profiles
this.userProfiles.hook('updating', (modifications, primKey, obj, trans) => {
  modifications.updatedDate = new Date()
})
```

## Migration Guide

When upgrading database versions:

1. **Never delete Dexie version declarations** - Dexie needs all versions for migration
2. **Always increment version number** when changing schema
3. **Add new version** with `this.version(N).stores({...})`
4. **Include all tables** in new version, not just changed ones
5. **Hooks persist across versions** - they're defined once in constructor

### Example Migration

```typescript
// Old schema - Version 2
this.version(2).stores({
  songs: '++id, title, artist, key'
})

// New schema - Version 3 (add contextType field)
this.version(3).stores({
  songs: '++id, title, artist, key, contextType'
})
```

## Seed Data

Default data is seeded via `/workspaces/rock-on/src/database/seedData.ts`

**Current seed includes:**
- 1 default band ('band1' - "The Rock Legends")
- 3 songs (Wonderwall, Sweet Child O' Mine, Hotel California)
- 2 members
- 1 practice session
- 1 setlist

**Seed runs only once** - checks if songs exist before seeding.

## Services Layer

Database operations should go through service files in `/workspaces/rock-on/src/services/`:

- **SongService.ts** - Song CRUD operations
- **BandService.ts** - Band management
- **BandMembershipService.ts** - User-band relationships
- **SongLinkingService.ts** - Song variant linking
- **PracticeSessionService.ts** - Practice sessions
- **SetlistService.ts** - Setlist management
- **DatabaseService.ts** - General database operations

## Common Patterns

### Creating a Song in Context

```typescript
const song = {
  title: "Wonderwall",
  artist: "Oasis",
  // ... other fields
  contextType: 'personal', // or 'band'
  contextId: user.id,      // or bandId
  createdBy: user.id,
  visibility: 'private'    // or 'band_only' or 'public'
}

await db.songs.add(song)
```

### Querying Songs by Context

```typescript
// Personal songs
const personalSongs = await db.songs
  .where('contextType').equals('personal')
  .and(song => song.contextId === userId)
  .toArray()

// Band songs
const bandSongs = await db.songs
  .where('contextType').equals('band')
  .and(song => song.contextId === bandId)
  .toArray()
```

### Adding User to Band

```typescript
const membership = {
  id: crypto.randomUUID(),
  userId: user.id,
  bandId: 'band1',
  role: 'member',
  status: 'active',
  permissions: ['member']
}

await db.bandMemberships.add(membership)
```

## Troubleshooting

### Database Not Found
- Ensure importing from `'/workspaces/rock-on/src/services/database'`
- NOT from `'./database/db'` (deprecated)

### Songs Not Appearing
- Check `contextType` and `contextId` match current context
- Verify user has band membership if viewing band songs
- Check browser DevTools → Application → IndexedDB → RockOnDB

### Multiple Databases
- Only **RockOnDB** should exist
- If **RockOnDatabase** exists, clear all databases and reload

### Clear Database

```javascript
localStorage.clear()
indexedDB.deleteDatabase('RockOnDB')
indexedDB.deleteDatabase('RockOnDatabase') // if exists
location.reload()
```

## Version History

| Version | Date | Changes | Migration Required |
|---------|------|---------|-------------------|
| 1 | Initial | Basic band features | N/A |
| 2 | 2025-10-21 | Multi-user support | Yes - clear DB |
| 3 | 2025-10-21 | Song variant linking | Yes - clear DB |

---

**Last Updated:** 2025-10-21
**Maintained By:** Claude Code Development Team
**Questions?** See `/workspaces/rock-on/.claude/artifacts/` for implementation details
