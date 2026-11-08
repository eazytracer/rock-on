import { QueryClient } from '@tanstack/react-query'

/**
 * App-wide QueryClient — the ephemeral in-memory cache that replaced the
 * durable IndexedDB mirror (Phase 2 data-layer simplification).
 *
 * Design:
 * - No persistence. This cache lives only for the tab's lifetime; a reload
 *   refetches from Supabase (the single source of truth). Web is a naive
 *   online client — true offline is the future Flutter apps' job.
 * - Realtime drives freshness: RealtimeManager emits change events and hooks
 *   call queryClient.invalidateQueries(...), so we don't lean on aggressive
 *   polling. staleTime is generous to avoid redundant refetches between an
 *   explicit invalidation and the next window focus.
 * - retry is modest: a failed read surfaces quickly rather than hanging the UI.
 */
/**
 * Stable fallback for `query.data ?? EMPTY_ARRAY`. A literal `[]` is a new
 * reference every render, so a consumer effect keyed on it that sets state
 * loops forever while the query has no data yet.
 */
export const EMPTY_ARRAY: never[] = []

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — realtime invalidation is the real freshness signal
      gcTime: 5 * 60_000, // keep unused data 5m before eviction
      retry: 1,
      refetchOnWindowFocus: true, // cheap catch-up when returning to the tab
    },
    mutations: {
      retry: 0, // optimistic mutations roll back + toast on failure; no silent retry
    },
  },
})

/**
 * Centralized query keys so hooks and realtime invalidation agree on the same
 * cache addresses. Keep these stable — a realtime handler and its hook must
 * produce identical keys or invalidation silently misses.
 */
export const queryKeys = {
  songs: {
    band: (bandId: string) => ['songs', 'band', bandId] as const,
    personal: (userId: string) => ['songs', 'personal', userId] as const,
    detail: (songId: string) => ['songs', 'detail', songId] as const,
    usage: (songId: string) => ['songs', 'usage', songId] as const,
    nextShows: (bandId: string) => ['songs', 'nextShows', bandId] as const,
    notInCatalog: (userId: string) =>
      ['songs', 'notInCatalog', userId] as const,
  },
  listViews: (userId: string) => ['listViews', userId] as const,
  setlists: {
    band: (bandId: string) => ['setlists', 'band', bandId] as const,
    personal: (userId: string) => ['setlists', 'personal', userId] as const,
    detail: (setlistId: string) => ['setlists', 'detail', setlistId] as const,
  },
  shows: {
    band: (bandId: string) => ['shows', 'band', bandId] as const,
    detail: (showId: string) => ['shows', 'detail', showId] as const,
  },
  practices: {
    band: (bandId: string) => ['practices', 'band', bandId] as const,
    detail: (practiceId: string) =>
      ['practices', 'detail', practiceId] as const,
  },
  bands: {
    forUser: (userId: string) => ['bands', 'forUser', userId] as const,
    detail: (bandId: string) => ['bands', 'detail', bandId] as const,
  },
  memberships: {
    band: (bandId: string) => ['memberships', 'band', bandId] as const,
    user: (userId: string) => ['memberships', 'user', userId] as const,
  },
  notes: {
    entriesForSong: (songId: string, bandId: string) =>
      ['notes', 'song', songId, bandId] as const,
    personalForUser: (userId: string, bandId: string) =>
      ['notes', 'personal', userId, bandId] as const,
  },
  notifications: {
    feed: (userId: string) => ['notifications', 'feed', userId] as const,
    releases: ['notifications', 'releases'] as const,
  },
  contexts: {
    mine: (userId: string) => ['contexts', userId] as const,
  },
  search: (query: string, bandId: string | null, all: boolean) =>
    ['search', query, bandId, all] as const,
} as const
