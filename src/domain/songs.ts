/**
 * Song list maths (Song Row · View options, Sort, Filter). Pure, so web and
 * the Flutter apps can share the rules: list a song once, order it, filter it.
 */
import type { Song } from '../models/Song'
import type { ReferenceLink } from '../types'

export type Density = 'comfortable' | 'compact'
export type SortField = 'title' | 'artist' | 'newest' | 'oldest' | 'nextShow'
export type SortDir = 'asc' | 'desc'

export interface ListView {
  density: Density
  artist: boolean
  key: boolean
  bpm: boolean
  links: boolean
  nextShow: boolean
  showHidden: boolean
  sort: SortField
  dir: SortDir
}

export const DEFAULT_LIST_VIEW: ListView = {
  density: 'comfortable',
  artist: true,
  key: true,
  bpm: true,
  links: true,
  nextShow: false,
  showHidden: false,
  sort: 'title',
  dir: 'asc',
}

/** Fills missing or malformed fields from the default (stored views can be stale). */
export function readListView(stored: unknown): ListView {
  const v = (stored && typeof stored === 'object' ? stored : {}) as Partial<
    Record<keyof ListView, unknown>
  >
  const out = { ...DEFAULT_LIST_VIEW }
  for (const k of Object.keys(out) as (keyof ListView)[]) {
    if (typeof v[k] === typeof out[k])
      (out as Record<string, unknown>)[k] = v[k]
  }
  return out
}

export const SORT_LABELS: Record<SortField, string> = {
  title: 'Title',
  artist: 'Artist',
  newest: 'Newest',
  oldest: 'Oldest',
  nextShow: 'Next show',
}

const byText = (a = '', b = '') =>
  a.localeCompare(b, undefined, { sensitivity: 'base' })

/**
 * Orders songs. Newest/Oldest have a fixed direction; for Next show, songs not
 * in an upcoming show go last either way.
 */
export function sortSongs(
  songs: Song[],
  field: SortField,
  dir: SortDir,
  nextShowAt: Map<string, number> = new Map()
): Song[] {
  const flip = dir === 'desc' ? -1 : 1
  const time = (s: Song) => new Date(s.createdDate).getTime() || 0
  return [...songs].sort((a, b) => {
    switch (field) {
      case 'artist':
        return flip * byText(a.artist, b.artist) || byText(a.title, b.title)
      case 'newest':
        return time(b) - time(a)
      case 'oldest':
        return time(a) - time(b)
      case 'nextShow': {
        const x = nextShowAt.get(a.id)
        const y = nextShowAt.get(b.id)
        if (x === undefined && y === undefined) return byText(a.title, b.title)
        if (x === undefined) return 1
        if (y === undefined) return -1
        return flip * (x - y) || byText(a.title, b.title)
      }
      default:
        return flip * byText(a.title, b.title)
    }
  })
}

/** Search matches title, artist or album; `tuning` narrows to one tuning. */
export function filterSongs(
  songs: Song[],
  query: string,
  tuning: string | null
): Song[] {
  const q = query.trim().toLowerCase()
  return songs.filter(
    s =>
      (!tuning || (s.guitarTuning || 'Standard') === tuning) &&
      (!q ||
        [s.title, s.artist, s.album].some(f => f?.toLowerCase().includes(q)))
  )
}

export type LinkCategory =
  | 'audio'
  | 'tabs'
  | 'video'
  | 'lyrics'
  | 'cloud'
  | 'link'

/** Song Row link tiles: six categories over the stored link icons. */
export function linkCategory(link: Pick<ReferenceLink, 'icon'>): LinkCategory {
  switch (link.icon) {
    case 'spotify':
    case 'soundcloud':
      return 'audio'
    case 'youtube':
      return 'video'
    case 'tabs':
      return 'tabs'
    case 'lyrics':
      return 'lyrics'
    case 'drive':
    case 'dropbox':
      return 'cloud'
    default:
      return 'link'
  }
}

export type NoteMark = 'none' | 'band' | 'mine' | 'both'

export function noteMark(hasBand: boolean, hasMine: boolean): NoteMark {
  if (hasBand && hasMine) return 'both'
  if (hasBand) return 'band'
  return hasMine ? 'mine' : 'none'
}

/** Tunings in use, in the order the list shows them as filter chips. */
export function tuningsInUse(songs: Song[]): string[] {
  const counts = new Map<string, number>()
  for (const s of songs) {
    const t = s.guitarTuning || 'Standard'
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || byText(a[0], b[0]))
    .map(([t]) => t)
}

/** "Used in Fall Set and 1 show" (delete confirm, song menu). */
export function usageSummary(
  usage: { kind: string | null; name: string | null }[]
): string {
  const sets = usage.filter(u => u.kind === 'setlist')
  const shows = usage.filter(u => u.kind === 'show').length
  const parts: string[] = []
  if (sets.length === 1) parts.push(sets[0].name ?? 'a setlist')
  else if (sets.length > 1) parts.push(`${sets.length} setlists`)
  if (shows) parts.push(`${shows} show${shows === 1 ? '' : 's'}`)
  return parts.length ? `Used in ${parts.join(' and ')}` : ''
}
