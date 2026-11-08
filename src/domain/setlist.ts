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
  id: string
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
  /** The show's length in minutes (the "of 45 min" slot). */
  showMinutes: number | null
  /** The show's set time as entered ("8:30 PM"), if any. */
  showSetTime: string | null
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

/** The delete confirm's body: what stays, and the show that loses its set. */
export function deleteSetlistMessage(show: string | null): string {
  return show
    ? `Songs stay in your catalog. ${show} will have no set. This can't be undone.`
    : "Songs stay in your catalog. This can't be undone."
}

// ── The editor ────────────────────────────────────────────────────────────

/** What a song row needs to draw (from the catalog). */
export interface RowSong {
  title: string
  artist?: string | null
  tuning?: string | null
  key?: string | null
  seconds: number
}

export interface EditorItem {
  id: string
  type: 'song' | 'break' | 'section'
  songId?: string
  notes?: string
  breakDuration?: number
  breakNotes?: string
  sectionTitle?: string
}

export type EditorRow<I extends EditorItem = EditorItem> =
  | {
      kind: 'song'
      item: I
      song: RowSong | null
      /** 1-based; breaks and sections don't take a number. */
      number: number
      /** The tuning to change from, when the previous song's differs. */
      retuneFrom: string | null
    }
  | { kind: 'break'; item: I }
  | { kind: 'section'; item: I }

/**
 * Rows in order. A retune sits on the song that needs it: across a break or a
 * section, the previous song is still the one before.
 */
export function editorRows<I extends EditorItem>(
  items: I[],
  songOf: (songId: string) => RowSong | undefined
): EditorRow<I>[] {
  let n = 0
  let prev: string | null | undefined
  return items.map(item => {
    if (item.type !== 'song') return { kind: item.type, item }
    const song = (item.songId && songOf(item.songId)) || null
    const tuning = song?.tuning ?? null
    const retuneFrom =
      n > 0 && canonicalTuningId(prev) !== canonicalTuningId(tuning)
        ? (prev ?? 'Standard')
        : null
    n++
    prev = tuning
    return { kind: 'song', item, song, number: n, retuneFrom }
  })
}

/** "Monkey Wrench", "Break · 15 min", "Set 2": how a row is named in menus. */
export function rowLabel(r: EditorRow): string {
  if (r.kind === 'song') return r.song?.title ?? 'Song'
  if (r.kind === 'break') return `Break · ${r.item.breakDuration ?? 15} min`
  return r.item.sectionTitle || 'Section'
}

export interface EditorTotals {
  songs: number
  minutes: number
  retunes: number
  /** The show's slot in minutes, when a show uses the set. */
  slot: number | null
  /** Over the slot: "47 of 45 min" turns warn. */
  over: boolean
}

export function editorTotals(
  rows: EditorRow[],
  slot: number | null | undefined
): EditorTotals {
  let seconds = 0
  let songs = 0
  let retunes = 0
  for (const r of rows) {
    if (r.kind === 'song') {
      songs++
      seconds += r.song?.seconds ?? 0
      if (r.retuneFrom !== null) retunes++
    } else if (r.kind === 'break') {
      seconds += (r.item.breakDuration ?? 0) * 60
    }
  }
  const minutes = Math.round(seconds / 60)
  const s = slot && slot > 0 ? slot : null
  return { songs, minutes, retunes, slot: s, over: s !== null && minutes > s }
}

/** Break lengths offered as one tap (5–60 is allowed). */
export const BREAK_MINUTES = [5, 10, 15, 20, 30] as const

/** The next default section label: "Set 1", "Set 2", … */
export function nextSectionLabel(items: EditorItem[]): string {
  return `Set ${items.filter(i => i.type === 'section').length + 1}`
}

/** Where an item lands for Up / Down / To top (0-based, as move_setlist_item takes). */
export function moveTarget(
  items: EditorItem[],
  itemId: string,
  where: 'up' | 'down' | 'top'
): number | null {
  const i = items.findIndex(x => x.id === itemId)
  if (i < 0) return null
  const to = where === 'top' ? 0 : where === 'up' ? i - 1 : i + 1
  return to < 0 || to >= items.length || to === i ? null : to
}

/** Optimistic local move (same result as move_setlist_item). */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const out = [...items]
  const [x] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(to, out.length)), 0, x)
  return out
}

// ── Timeline rail ───────────────────────────────────────────────────────────

/** Each row's start, in seconds from the top of the set. */
export function startOffsets(rows: EditorRow[]): number[] {
  let t = 0
  return rows.map(r => {
    const at = t
    if (r.kind === 'song') t += r.song?.seconds ?? 0
    else if (r.kind === 'break') t += (r.item.breakDuration ?? 0) * 60
    return at
  })
}

/**
 * The show's start as minutes after midnight: its set time ("8:30 PM" or
 * "20:30") if entered, else the time on its date. Null without a show.
 */
export function showStartMinutes(
  showAt: string | null | undefined,
  setTime: string | null | undefined
): number | null {
  const m = setTime?.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  if (m) {
    let h = Number(m[1]) % 12
    if (!m[3]) h = Number(m[1])
    else if (m[3].toLowerCase() === 'pm') h += 12
    return h * 60 + Number(m[2])
  }
  if (!showAt) return null
  const d = new Date(showAt)
  return isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes()
}

/** Set time "0:00", "1:03:14" (from the top), or clock time "8:30" / "10:05". */
export function railLabel(
  offsetSeconds: number,
  startMinutes: number | null
): string {
  if (startMinutes === null) {
    const s = Math.round(offsetSeconds)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = String(s % 60).padStart(2, '0')
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
  }
  const total = startMinutes + Math.floor(offsetSeconds / 60)
  const h = Math.floor(total / 60) % 24
  return `${h % 12 || 12}:${String(total % 60).padStart(2, '0')}`
}

/** "3:14" from seconds; "" for none. */
export function songLength(seconds: number | null | undefined): string {
  if (!seconds) return ''
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
