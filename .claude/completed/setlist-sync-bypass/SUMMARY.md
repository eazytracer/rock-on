# Setlist Sync Bypass - Summary

**Completed:** 2026-01-15
**PR:** #4

## Overview

Fixed a critical bug where setlist and show operations were bypassing the SyncRepository, causing changes to not sync to Supabase.

## Problem

Setlist and show pages were directly calling `db.setlists.put()` and `db.shows.put()` instead of going through the SyncRepository. This meant:

- Changes only saved to local IndexedDB
- No sync to Supabase
- Other devices never received updates

## Solution

Routed all setlist and show CRUD operations through SyncRepository methods:

- `repo.addSetlist()` / `repo.addShow()`
- `repo.updateSetlist()` / `repo.updateShow()`
- `repo.deleteSetlist()` / `repo.deleteShow()`

## Key Changes

### Modified Files

- `src/pages/SetlistViewPage.tsx` - All setlist operations now use SyncRepository
- `src/pages/ShowViewPage.tsx` - All show operations now use SyncRepository

## Testing

- Manual testing confirmed sync to Supabase
- Cross-device sync verified

## Breaking Changes

None.
