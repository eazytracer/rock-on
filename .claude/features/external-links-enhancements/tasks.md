# External Links Enhancements - Task Breakdown

**Feature:** external-links-enhancements
**Created:** 2026-01-20
**Status:** Ready for implementation

## Phase 1: Database & Repository Setup

- [ ] T001: Add reference_links JSONB column to songs table
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Changes: Add `reference_links JSONB DEFAULT '[]'::jsonb` to songs table
  - Acceptance: `supabase db reset` succeeds, column exists in schema

- [ ] T002: Update RemoteRepository field mappings for reference_links
  - Files: `src/services/data/RemoteRepository.ts`
  - Changes: Add mapping in `mapSongToSupabase` and `mapSongFromSupabase`
  - Depends: T001
  - Acceptance: Songs with referenceLinks sync to/from Supabase correctly

- [ ] T003: Write integration test for reference_links sync
  - Files: `tests/integration/RemoteRepository.links.test.ts`
  - Acceptance: Test verifies links persist through sync cycle

## Phase 2: Link Detection Utility [TDD]

- [ ] T004: Write unit tests for linkDetection utility
  - Files: `tests/unit/utils/linkDetection.test.ts`
  - Acceptance: Tests cover all URL patterns (Spotify, YouTube, tabs, lyrics, other)

- [ ] T005: Implement linkDetection utility
  - Files: `src/utils/linkDetection.ts`
  - Depends: T004
  - Acceptance: All unit tests pass

- [ ] T006: [P] Write unit tests for LinkIcons component
  - Files: `tests/unit/components/songs/LinkIcons.test.tsx`
  - Acceptance: Tests cover icon rendering, click handling, empty state

- [ ] T007: [P] Implement LinkIcons component
  - Files: `src/components/songs/LinkIcons.tsx`
  - Depends: T005, T006
  - Acceptance: All unit tests pass, icons render correctly

## Phase 3: UI Integration

- [ ] T008: Add URL auto-detection to EditSongModal
  - Files: `src/components/songs/EditSongModal.tsx`
  - Changes: Detect link type on URL paste/input, auto-select dropdown
  - Depends: T005
  - Acceptance: Pasting a Spotify URL auto-selects "spotify" type

- [ ] T009: Add link icons to SongsPage song rows
  - Files: `src/pages/SongsPage.tsx`
  - Changes: Import LinkIcons, render in each song row
  - Depends: T007
  - Acceptance: Link icons visible in song list, clickable to open URL

- [ ] T010: Add link icons to SongListItem component
  - Files: `src/components/common/SongListItem.tsx`
  - Changes: Optional showLinks prop, render LinkIcons
  - Depends: T007
  - Acceptance: Link icons work in setlist/practice views

## Phase 4: Spotify Integration [TDD]

- [ ] T011: Create Spotify Edge Function
  - Files: `supabase/functions/spotify-search/index.ts`
  - Changes: New Edge Function for Spotify API proxy
  - Acceptance: Function deployed, returns search results locally

- [ ] T012: [P] Write unit tests for SpotifyService
  - Files: `tests/unit/services/spotify/SpotifyService.test.ts`
  - Acceptance: Tests mock Edge Function calls, handle errors

- [ ] T013: Implement SpotifyService
  - Files: `src/services/spotify/SpotifyService.ts`
  - Depends: T011, T012
  - Acceptance: All unit tests pass

- [ ] T014: [P] Write unit tests for useSpotifySearch hook
  - Files: `tests/unit/hooks/useSpotifySearch.test.ts`
  - Acceptance: Tests cover debouncing, loading state, error handling

- [ ] T015: Implement useSpotifySearch hook
  - Files: `src/hooks/useSpotifySearch.ts`
  - Depends: T013, T014
  - Acceptance: All unit tests pass

- [ ] T016: [P] Write unit tests for SpotifySearch component
  - Files: `tests/unit/components/songs/SpotifySearch.test.tsx`
  - Acceptance: Tests cover search input, results display, selection

- [ ] T017: Implement SpotifySearch component
  - Files: `src/components/songs/SpotifySearch.tsx`
  - Depends: T015, T016
  - Acceptance: All unit tests pass, component renders correctly

- [ ] T018: Integrate SpotifySearch into EditSongModal
  - Files: `src/components/songs/EditSongModal.tsx`
  - Changes: Add SpotifySearch button/section, auto-fill on select
  - Depends: T017
  - Acceptance: Selecting Spotify result fills title, artist, duration, adds link

## Phase 5: E2E Tests & Polish

- [ ] T019: Write E2E tests for link management
  - Files: `tests/e2e/song-links.spec.ts`
  - Acceptance: Tests cover add/view/edit links, auto-detection

- [ ] T020: Write E2E tests for Spotify search
  - Files: `tests/e2e/spotify-search.spec.ts`
  - Acceptance: Tests cover search, selection, auto-fill

- [ ] T021: Add database test for reference_links column
  - Files: `supabase/tests/012-reference-links.test.sql`
  - Acceptance: pgTAP tests verify column exists, JSONB operations work

- [ ] T022: Final integration testing and cleanup
  - Acceptance: All tests pass, no TypeScript errors, lint clean

## Task Dependencies Graph

```
T001 ─────► T002 ─────► T003
                │
                ▼
T004 ─────► T005 ─────► T008
                │
T006 ─────► T007 ─────► T009
                │         │
                │         ▼
                └───────► T010

T011 ─────► T013 ─────► T015 ─────► T017 ─────► T018
      ▲           ▲           ▲           ▲
T012 ─┘     T014 ─┘     T016 ─┘           │
                                          │
T019, T020, T021 ◄────────────────────────┘
                          │
                          ▼
                        T022
```

## Parallel Execution Notes

Tasks marked with [P] can run in parallel with other [P] tasks in the same phase:

- **Phase 2:** T006 and T004 can run in parallel
- **Phase 4:** T012, T014, T016 can run in parallel after their dependencies

## Acceptance Criteria Summary

### Must Pass

- [ ] Songs with referenceLinks sync between devices
- [ ] URL auto-detection works for Spotify, YouTube, tabs, lyrics
- [ ] Link icons visible in song lists (SongsPage, SongListItem)
- [ ] Clicking link icon opens URL in new tab
- [ ] Spotify search returns results and auto-fills form
- [ ] All existing tests continue to pass
- [ ] No TypeScript errors
- [ ] Lint clean

### Nice to Have

- [ ] Album art displays in Spotify search results
- [ ] Link description auto-populated from metadata
- [ ] Graceful degradation when Spotify API unavailable
