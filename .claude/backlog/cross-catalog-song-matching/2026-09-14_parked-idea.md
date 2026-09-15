---
feature: Cross-catalog song matching (song variants / personal-band linking)
created: 2026-09-14
status: idea / parked
kind: research-seed
author: Eric (dictated), captured during Phase 2 data-layer simplification
---

# Cross-catalog song matching — parked idea

## Context

During the Phase 2 data-layer simplification (removing the IndexedDB mirror), we
found `SongLinkingService` + the `song_groups` / `song_group_memberships` tables
were an **incomplete feature**: ~95% of the methods were never wired to a
reachable UI surface, and the one live path (`copyBandSongToPersonal`, called
from `SongsPage`) only ever persisted its group records to IndexedDB, never to
Supabase — so the linkage silently vanished on refresh/other devices.

**Decision (Eric, 2026-09-14):** trim now (option 2), revisit later. Phase 2:

- KEEP `copyBandSongToPersonal`'s song-copy behavior (copies the band song into
  the user's personal catalog with `linkedFromSongId` set — this drives the
  "linked/mirrored" badges on SongsPage, which read `linkedFromSongId`, not
  song groups).
- REMOVE the unreachable song-group machinery: `createSongGroup`, `linkSongs`,
  `linkSongToGroup`, `getSongsInGroup`, `getSongGroup`, `findLinkingSuggestions`
  (Levenshtein title matcher), `contributePersonalSongToBand`,
  `unlinkSongFromGroup`, `deleteSongGroup`, and the `song_groups` /
  `song_group_memberships` web write path.
- The `song_groups` / `song_group_memberships` Supabase tables + RLS stay in the
  baseline schema (frozen; harmless), just unused by the web client.

## The actual long-term goal (Eric's intent, verbatim intent)

The original purpose was **open jam sessions**: when two musicians who each
maintain their OWN song catalogs jam together, the app should find the songs
they BOTH know so it can suggest a shared setlist — matching on songs each person
entered independently, NOT on a shared master catalog.

Hard constraints / product principles Eric stated:

1. **No app-maintained master song catalog** unless it can be made copyright-safe
   and legally defensible. Matching must work off users' own entries, not a
   central library the app curates/distributes.
2. **Match on independently-entered songs** — two people type in "Wonderwall"
   separately; the system should recognize them as the same song for
   jam-matching purposes (canonical title/artist normalization, fuzzy match —
   the Levenshtein matcher being removed is a seed of this).
3. **Portability on leaving a band** — when a member leaves a band, they should
   RETAIN their own copy of songs and their personal notes. (Personal catalog +
   `linkedFromSongId` are the substrate for this.)

## Where this connects in the current code

- Jam matching today (`JamSessionService.recomputeMatches` →
  `repository.getJamSongMatches` / `matched_songs`) already computes
  cross-participant matches with canonical title/artist — that is the natural
  home for "songs we both know," and is the piece to build ON, not song groups.
- Personal catalog + `linkedFromSongId` already give per-user song ownership
  (the band-leave portability substrate).

## If revisited, design questions to grill

- Is "song variant linking" even needed, or does canonical title/artist
  normalization in jam-match cover the real use case directly?
- Copyright posture: matching on user-entered metadata (title/artist) vs. storing
  lyrics/chords centrally — where's the legally defensible line?
- Band-leave data retention: what exactly transfers (song rows, personal notes,
  confidence) and what stays with the band? Needs its own spec.
