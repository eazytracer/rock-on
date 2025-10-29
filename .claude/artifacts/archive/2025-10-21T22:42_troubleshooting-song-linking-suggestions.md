---
timestamp: 2025-10-21T22:42
issue: Song linking suggestions not appearing
status: IN PROGRESS - Needs Chrome MCP debugging
previous_agent: Phase 2 completion agent
next_steps: Debug with Chrome DevTools MCP server
---

# Troubleshooting: Song Linking Suggestions Not Appearing

## Current State

### ✅ What's Working
- **Authentication**: Users can log in (alice@example.com, bob@example.com, charlie@example.com / password123)
- **Context Switching**: Personal/Band tabs work correctly
- **Adding Songs**: Songs can be added to both Personal and Band contexts
- **Song Display**: Songs appear in the correct context tabs after adding
- **Database**: Songs are being saved with correct `contextType` and `contextId`
- **Build**: TypeScript compilation passes without errors
- **Dev Server**: Running on http://localhost:5173

### ❌ Current Issue
**Songs added to both Personal and Band contexts are NOT showing linking suggestions**

User reported:
> "I added the same song to both my personal and band space and am not seeing any 'Link' suggestions"

Expected behavior:
- After adding same song (e.g., "Wonderwall" by Oasis) to Personal tab
- Then adding same song to Band tab
- User should see a linking suggestion appear at the top of the songs list
- Suggestion should have "Link" button to connect the two variants

## Recent Fixes Applied

### Fix 1: Context-Aware Song Creation (COMPLETED ✅)
**Problem**: Songs were saved to hardcoded `contextId: 'band1'` but page filtered by user's actual band ID

**Solution Applied** (in `/workspaces/rock-on/src/pages/Songs/Songs.tsx:178-199`):
```typescript
const handleAddSong = async (songData) => {
  // Add context information based on active tab
  const contextualSongData = {
    ...songData,
    contextType: activeContext,
    contextId: activeContext === 'personal' ? user.id : activeBandId,
    createdBy: user.id,
    visibility: activeContext === 'personal' ? 'private' : 'band_only'
  }
  await onAddSong(contextualSongData)
}
```

**Result**: Songs now appear in correct tabs ✅

### Fix 2: Infinite Loop in useEffect (COMPLETED ✅)
**Problem**: `Maximum update depth exceeded` error caused by `contextFilteredSongs` creating new array on every render

**Solution Applied** (in `/workspaces/rock-on/src/pages/Songs/Songs.tsx:68-76`):
```typescript
const contextFilteredSongs = useMemo(() => {
  return songs.filter(song => {
    if (activeContext === 'personal') {
      return song.contextType === 'personal' && song.contextId === user?.id
    } else {
      return song.contextType === 'band' && song.contextId === activeBandId
    }
  })
}, [songs, activeContext, activeBandId, user?.id])
```

**Result**: No more infinite loops ✅

## Debugging Plan for Next Agent

### Prerequisites
1. ✅ Chrome DevTools MCP server should be installed
2. ✅ Dev server running on http://localhost:5173
3. ✅ User logged in and has added duplicate songs

### Step 1: Inspect Database Contents
Use Chrome MCP to run this JavaScript in the console:

```javascript
// Check what songs are actually in the database
const request = indexedDB.open('RockOnDB', 3);
request.onsuccess = function(event) {
  const db = event.target.result;
  const transaction = db.transaction(['songs'], 'readonly');
  const objectStore = transaction.objectStore('songs');
  const getAllRequest = objectStore.getAll();

  getAllRequest.onsuccess = function() {
    const songs = getAllRequest.result;
    console.log('=== ALL SONGS ===');
    songs.forEach(song => {
      console.log({
        title: song.title,
        artist: song.artist,
        contextType: song.contextType,
        contextId: song.contextId,
        createdBy: song.createdBy,
        songGroupId: song.songGroupId
      });
    });

    // Check for potential matches
    const titles = {};
    songs.forEach(s => {
      const key = `${s.title}-${s.artist}`;
      if (!titles[key]) titles[key] = [];
      titles[key].push(s);
    });

    console.log('=== DUPLICATE TITLES ===');
    Object.entries(titles).forEach(([key, matches]) => {
      if (matches.length > 1) {
        console.log(`"${key}" appears ${matches.length} times:`, matches);
      }
    });
  };
};
```

**What to check:**
- Do songs with same title/artist exist in both contexts?
- Are `contextType` and `contextId` different for the duplicates?
- Are `title` and `artist` fields exactly the same (case-sensitive)?

### Step 2: Inspect React Component State
Check if suggestions are being generated but not displayed:

```javascript
// Find the Songs component in React DevTools
// Look for state: linkingSuggestions
// Should be an array of suggestion objects

// Or check directly in console:
window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.forEach(renderer => {
  console.log('React renderer:', renderer);
});
```

**What to check:**
- Is `linkingSuggestions` state empty `[]`?
- Is the suggestions array populated but UI not rendering it?

### Step 3: Check Suggestion Loading Logic
Inspect the useEffect that loads suggestions (Songs.tsx:102-123):

```javascript
// Check if the useEffect is even running
// Add console.log to the loadLinkingSuggestions function temporarily
```

**What to verify:**
- Does `contextFilteredSongs.length > 0`?
- Is the user object defined?
- Does the loop run and call `SongLinkingService.findLinkingSuggestions`?

### Step 4: Test SongLinkingService Directly
Test the linking service in isolation:

```javascript
// Import the service in console (if exposed globally)
// Or check the network/database calls it makes

// Manually test the matching algorithm:
const song1 = { title: "Wonderwall", artist: "Oasis", contextType: "personal", contextId: "user1" };
const song2 = { title: "Wonderwall", artist: "Oasis", contextType: "band", contextId: "band1" };

// Check if they would match
console.log('Title match?', song1.title === song2.title);
console.log('Artist match?', song1.artist === song2.artist);
console.log('Different context?', song1.contextType !== song2.contextType);
```

## Potential Root Causes

### Hypothesis 1: Title/Artist Mismatch
**Issue**: User entered slightly different title or artist
- Example: "Wonderwall" vs "wonderwall" (case difference)
- Example: "Oasis" vs "Oasis " (trailing space)

**How to verify**: Check database contents (Step 1)

**Fix if true**: Normalize strings in SongLinkingService.ts:162-168

### Hypothesis 2: Context Filtering Issue
**Issue**: Suggestions only checked for first 10 songs, but target song is beyond that
- Code limit: `contextFilteredSongs.slice(0, 10)` (Songs.tsx:107)

**How to verify**: Check how many songs are in `contextFilteredSongs`

**Fix if true**: Increase limit or check all songs

### Hypothesis 3: useEffect Not Triggering
**Issue**: Dependencies don't trigger re-calculation of suggestions
- Dependencies: `[contextFilteredSongs, user]` (Songs.tsx:123)

**How to verify**: Add console.log in useEffect

**Fix if true**: Review dependency array

### Hypothesis 4: Same Context ID
**Issue**: Both songs ended up in same context due to `activeBandId` being wrong
- Both songs have `contextType: 'band'` and same `contextId`
- Or both have `contextType: 'personal'` and same `contextId`

**How to verify**: Check database (Step 1) - look at contextType/contextId

**Fix if true**: Verify band ID initialization in Songs.tsx:54-65

### Hypothesis 5: Deduplication Logic Error
**Issue**: Suggestions are generated but filtered out by deduplication
- Code: Songs.tsx:113-116

**How to verify**: Add console.log before deduplication

**Fix if true**: Review filter logic

## Code References

### Key Files to Inspect:
1. **`/workspaces/rock-on/src/pages/Songs/Songs.tsx`**
   - Line 68-76: Context filtering (useMemo)
   - Line 102-123: Linking suggestions useEffect
   - Line 333-341: SongLinkingSuggestions component rendering

2. **`/workspaces/rock-on/src/services/SongLinkingService.ts`**
   - Line 131-183: findLinkingSuggestions method
   - Line 162-168: calculateTitleSimilarity method
   - Line 140-182: Main suggestion logic

3. **`/workspaces/rock-on/src/components/songs/SongLinkingSuggestions.tsx`**
   - Line 21-24: Props interface
   - Line 33-35: Empty state handling (returns null if no suggestions)

### Database Schema (v3):
```typescript
songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed,
        confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId'
```

## Quick Test Commands

### Reset Database (if needed):
```javascript
localStorage.clear()
indexedDB.deleteDatabase('RockOnDB')
location.reload()
```

### Check User Info:
```javascript
JSON.parse(localStorage.getItem('rock_on_session'))
```

### Manual Linking Test:
```javascript
// After finding two matching songs in database
// Get their IDs and manually call linking service
// (Would need to expose service globally or use React DevTools)
```

## Environment Info

- **Dev Server**: http://localhost:5173
- **Database**: IndexedDB `RockOnDB` version 3
- **Build Status**: ✅ Passing
- **Test Users**: alice@example.com, bob@example.com, charlie@example.com (password: password123)

## Success Criteria

✅ **Fixed**: User can add songs to both contexts
✅ **Fixed**: Songs appear in correct tabs
❌ **Current**: Linking suggestions appear when duplicate songs exist
⏳ **Next**: User can click "Link" to connect variants
⏳ **Next**: Linked songs show "Linked" badge

## Recommendations for Next Agent

1. **Start with Chrome MCP**: Navigate to http://localhost:5173 and inspect the page
2. **Check database first**: Run Step 1 commands to see actual data
3. **Add debug logging**: Temporarily add console.logs to the useEffect (Songs.tsx:102-123)
4. **Test the service**: Verify SongLinkingService.findLinkingSuggestions works in isolation
5. **Check component rendering**: Verify SongLinkingSuggestions receives props

## Related Artifacts

- Phase 1 Completion: `.claude/artifacts/2025-10-21T21:42_phase-1-auth-completion-summary.md`
- Phase 2 Completion: `.claude/artifacts/2025-10-21T22:10_phase-2-song-context-completion-summary.md`
- Implementation Roadmap: `.claude/instructions/multi-user-implementation-roadmap.md`

---

**Last Updated**: 2025-10-21T22:42
**Status**: Ready for Chrome MCP debugging
**Priority**: HIGH - Core Phase 2 feature not working
