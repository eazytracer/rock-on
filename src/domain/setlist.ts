/**
 * Setlist display maths (no I/O; ports to Dart line for line).
 */
import { canonicalTuningId } from '../utils/tunings'

interface ItemLike {
  type: 'song' | 'break' | 'section'
  songId?: string
  breakDuration?: number // minutes
}

/** Song count and total length in seconds (songs + breaks). */
export function setlistStats(
  items: ItemLike[],
  songSeconds: (songId: string) => number | undefined
): { songCount: number; seconds: number } {
  let songCount = 0
  let seconds = 0
  for (const it of items) {
    if (it.type === 'song') {
      songCount++
      seconds += (it.songId && songSeconds(it.songId)) || 0
    } else if (it.type === 'break') {
      seconds += (it.breakDuration ?? 0) * 60
    }
  }
  return { songCount, seconds }
}

/** One song in the index's setlist_index row. */
export interface IndexSong {
  title: string
  tuning: string | null
  seconds: number
}

/** A setlist as the index shows it (setlist_index, camelCased). */
export interface IndexRow {
  id: string
  name: string
  lastModified: string
  showId: string | null
  showName: string | null
  showVenue: string | null
  showAt: string | null
  songs: IndexSong[]
  breakMinutes: number
}

export type SetlistSort = 'nextShow' | 'name' | 'updated'

export const SETLIST_SORT_LABELS: Record<SetlistSort, string> = {
  nextShow: 'Next show',
  name: 'Name',
  updated: 'Updated',
}

/** Retunes: adjacent songs whose tunings differ ("Drop D" ≡ "drop-d"). */
export function retuneCount(tunings: (string | null | undefined)[]): number {
  let n = 0
  for (let i = 1; i < tunings.length; i++)
    if (canonicalTuningId(tunings[i]) !== canonicalTuningId(tunings[i - 1])) n++
  return n
}

/** "8 songs · 47 min · 5 retunes": the card's counts. */
export function indexTotals(row: IndexRow): {
  songs: number
  minutes: number
  retunes: number
} {
  const seconds =
    row.songs.reduce((t, s) => t + (s.seconds || 0), 0) + row.breakMinutes * 60
  return {
    songs: row.songs.length,
    minutes: Math.round(seconds / 60),
    retunes: retuneCount(row.songs.map(s => s.tuning)),
  }
}

/** The first `n` titles, "A · B · C". */
export function previewTitles(row: IndexRow, n = 5): string {
  return row.songs
    .slice(0, n)
    .map(s => s.title)
    .join(' · ')
}

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Is the set's show today or later? */
export function hasUpcomingShow(row: IndexRow, now: Date): boolean {
  return !!row.showAt && new Date(row.showAt).getTime() >= startOfDay(now)
}

/**
 * Next show: sets with an upcoming show, soonest first, then the rest by
 * name. Name: A → Z. Updated: most recent first.
 */
export function sortSetlistIndex(
  rows: IndexRow[],
  sort: SetlistSort,
  now: Date
): IndexRow[] {
  const byName = (a: IndexRow, b: IndexRow) => a.name.localeCompare(b.name)
  const out = [...rows]
  if (sort === 'name') return out.sort(byName)
  if (sort === 'updated')
    return out.sort((a, b) => b.lastModified.localeCompare(a.lastModified))
  return out.sort((a, b) => {
    const ua = hasUpcomingShow(a, now)
    const ub = hasUpcomingShow(b, now)
    if (ua && ub) return a.showAt!.localeCompare(b.showAt!) || byName(a, b)
    if (ua !== ub) return ua ? -1 : 1
    return byName(a, b)
  })
}

/** The set of the soonest upcoming show (outlined in the index), if any. */
export function nextShowSetId(rows: IndexRow[], now: Date): string | null {
  return (
    sortSetlistIndex(rows, 'nextShow', now).find(r => hasUpcomingShow(r, now))
      ?.id ?? null
  )
}

/** "The Crocodile · Sat, Nov 7", or null when no show uses the set. */
export function showLine(row: IndexRow): string | null {
  if (!row.showAt) return null
  const date = new Date(row.showAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const where = row.showVenue || row.showName
  return where ? `${where} · ${date}` : date
}
