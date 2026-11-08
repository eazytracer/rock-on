/**
 * Where a song was opened from (docs/redesign/10 · 1.1). Carried as
 * `/songs/:id?from=<origin>` so Back, the breadcrumb and ‹ › survive a reload
 * and can be shared. Unknown or missing origins fall back to Songs.
 */

export type SongOrigin =
  | { kind: 'songs' }
  | { kind: 'setlist'; id: string }
  | { kind: 'show'; id: string }
  | { kind: 'practice'; id: string }
  | { kind: 'search'; q: string }

const SONGS: SongOrigin = { kind: 'songs' }

/** Reads `from` out of a query string (`?from=…`) or a bare origin value. */
export function parseOrigin(search: string | null | undefined): SongOrigin {
  if (!search) return SONGS
  const raw = search.startsWith('?')
    ? new URLSearchParams(search).get('from')
    : search
  if (!raw) return SONGS
  const i = raw.indexOf(':')
  const kind = i < 0 ? raw : raw.slice(0, i)
  const rest = i < 0 ? '' : raw.slice(i + 1)
  if (kind === 'search') return rest.trim() ? { kind, q: rest } : SONGS
  if (kind === 'setlist' || kind === 'show' || kind === 'practice')
    return /^[\w-]+$/.test(rest) ? { kind, id: rest } : SONGS
  return SONGS
}

/** The `from` value for a link (`setlist:<id>`, `search:<q>`, `songs`). */
export function formatOrigin(origin: SongOrigin): string {
  switch (origin.kind) {
    case 'songs':
      return 'songs'
    case 'search':
      return `search:${origin.q}`
    default:
      return `${origin.kind}:${origin.id}`
  }
}

/** `/songs/<id>?from=…`: every link to a song passes where it came from. */
export function songHref(songId: string, origin: SongOrigin): string {
  const params = new URLSearchParams({ from: formatOrigin(origin) })
  return `/songs/${songId}?${params.toString()}`
}

/**
 * The Back button's label. `name` is the setlist / show / practice name once
 * it has loaded; until then (or if it's gone) the kind stands in.
 */
export function originLabel(origin: SongOrigin, name?: string | null): string {
  switch (origin.kind) {
    case 'songs':
      return 'Songs'
    case 'search':
      return `Search "${origin.q}"`
    case 'setlist':
      return name || 'Setlist'
    case 'show':
      return name || 'Show'
    case 'practice':
      return name || 'Practice'
  }
}

/** Where Back goes: a link to the origin, with this song selected there. */
export function originHref(origin: SongOrigin, songId?: string): string {
  const sel = songId ? `?selected=${encodeURIComponent(songId)}` : ''
  switch (origin.kind) {
    case 'songs':
      return `/songs${sel}`
    case 'search':
      return `/?search=${encodeURIComponent(origin.q)}`
    case 'setlist':
      return `/setlists/${origin.id}${sel}`
    case 'show':
      return `/shows/${origin.id}`
    case 'practice':
      return `/practices/${origin.id}`
  }
}

/** ‹ n of N ›: the song's place in the origin's list, if it's still there. */
export function stepIn(
  ids: readonly string[],
  songId: string
): { index: number; total: number; prev?: string; next?: string } | null {
  const index = ids.indexOf(songId)
  if (index < 0) return null
  return {
    index,
    total: ids.length,
    prev: index > 0 ? ids[index - 1] : undefined,
    next: index < ids.length - 1 ? ids[index + 1] : undefined,
  }
}
