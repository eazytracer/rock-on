/**
 * Calendar display maths: the agenda's rows (shows, practices, jams on one
 * list), titles that fall back sensibly, the countdown word, and the show
 * page's small rules (draft, pay, the set copy's line). No I/O.
 */
import type { SessionSong } from '../types'

export type AgendaType = 'show' | 'practice' | 'jam'
export type AgendaFilter = 'all' | AgendaType

/** One row of `calendar_agenda`, as the API maps it. */
export interface AgendaSource {
  type: 'show' | 'practice'
  id: string
  name: string
  venue: string | null
  at: string
  minutes: number | null
  cancelled: boolean
  confirmed: boolean
  startedAt: string | null
  endedAt: string | null
  songsTotal: number
  songsDone: number
}

export interface AgendaJam {
  id: string
  name: string
  venue?: string
  scheduledDate: Date | string
  endTime?: Date | string
  status: string
}

export interface AgendaRow {
  type: AgendaType
  id: string
  title: string
  /** "7:00 PM · Mike's Garage", or for a played practice "1:52 played · 5 of 6 songs". */
  sub: string
  at: Date
  cancelled: boolean
  confirmed: boolean
  /** A jam on right now (the row shows a LIVE mark). */
  live?: boolean
  to: string
}

const time = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** "Fall Kickoff", else the venue, else "New show". */
export function showTitle(name?: string | null, venue?: string | null) {
  return name?.trim() || venue?.trim() || 'New show'
}

/** "Thursday run", else "Thursday practice". */
export function practiceTitle(name: string | null | undefined, at: Date) {
  return (
    name?.trim() ||
    `${at.toLocaleDateString('en-US', { weekday: 'long' })} practice`
  )
}

/** "1:52" from minutes. */
export function hoursMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

function agendaRow(s: AgendaSource): AgendaRow {
  const at = new Date(s.at)
  const place = s.venue?.trim()
  let sub = [time(at), place].filter(Boolean).join(' · ')
  if (s.type === 'practice' && s.startedAt && s.endedAt) {
    const played =
      (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000
    sub = `${hoursMinutes(played)} played · ${s.songsDone} of ${s.songsTotal} songs`
  }
  return {
    type: s.type,
    id: s.id,
    title:
      s.type === 'show'
        ? showTitle(s.name, s.venue)
        : practiceTitle(s.name, at),
    sub,
    at,
    cancelled: s.cancelled,
    confirmed: s.confirmed,
    to: s.type === 'show' ? `/shows/${s.id}` : `/practices/${s.id}`,
  }
}

function jamRow(e: AgendaJam): AgendaRow {
  const at = new Date(e.scheduledDate)
  return {
    type: 'jam',
    id: e.id,
    title: e.name,
    sub: [time(at), e.venue?.trim()].filter(Boolean).join(' · '),
    at,
    cancelled: e.status === 'cancelled',
    confirmed: false,
    live: e.status === 'live',
    to: `/jam/${e.id}`,
  }
}

/** When a row stops being upcoming: a practice at its end, others at start + length. */
function endsAt(s: AgendaSource): number {
  return new Date(s.at).getTime() + (s.minutes ?? 0) * 60000
}

/**
 * The agenda: Upcoming soonest first, then Past latest first. A row is upcoming
 * until it ends (start + length; a jam until its end time, else its start).
 */
export function buildAgenda(
  sources: AgendaSource[],
  jams: AgendaJam[],
  filter: AgendaFilter,
  now: Date
): { upcoming: AgendaRow[]; past: AgendaRow[] } {
  const t = now.getTime()
  const all: { row: AgendaRow; end: number }[] = [
    ...sources.map(s => ({ row: agendaRow(s), end: endsAt(s) })),
    ...jams.map(e => ({
      row: jamRow(e),
      end: new Date(e.endTime ?? e.scheduledDate).getTime(),
    })),
  ].filter(x => filter === 'all' || x.row.type === filter)
  const upcoming = all
    .filter(x => x.end >= t)
    .map(x => x.row)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  const past = all
    .filter(x => x.end < t)
    .map(x => x.row)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
  return { upcoming, past }
}

/** The New button's label on each filter. */
export const NEW_LABEL: Record<AgendaFilter, string> = {
  all: 'New',
  show: 'New show',
  practice: 'New practice',
  jam: 'New jam',
}

/** "TONIGHT", "TOMORROW", "IN 6 DAYS", "YESTERDAY", "3 DAYS AGO" (calendar days). */
export function countdown(at: Date, now: Date): string {
  const a = new Date(at)
  a.setHours(0, 0, 0, 0)
  const b = new Date(now)
  b.setHours(0, 0, 0, 0)
  const days = Math.round((a.getTime() - b.getTime()) / 86400000)
  if (days === 0) return 'Tonight'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return days > 0 ? `In ${days} days` : `${-days} days ago`
}

/** Next Saturday (a week out if today is Saturday) at 8:00 PM, local. */
export function defaultShowDate(now: Date): Date {
  const d = new Date(now)
  d.setHours(20, 0, 0, 0)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return d
}

/** A show with neither a name nor a venue is still a draft (Discard draft). */
export function isDraftShow(show: {
  name?: string | null
  venue?: string | null
}) {
  return !show.name?.trim() && !show.venue?.trim()
}

/** "$300" / "$312.50" from cents; "" when unset. */
export function formatPay(cents: number | null | undefined): string {
  if (cents == null) return ''
  const d = cents / 100
  return `$${d % 1 ? d.toFixed(2) : d.toLocaleString('en-US')}`
}

/** "$300", "300", "312.50" → cents; null for empty; NaN for nonsense. */
export function parsePay(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN
}

/** "Copied from Fall Set · Oct 28" (null when the set wasn't copied). */
export function copiedLine(copy: {
  name: string
  sourceSetlistId?: string | null
  copiedAt?: string | Date | null
}): string | null {
  if (!copy.sourceSetlistId || !copy.copiedAt) return null
  const d = new Date(copy.copiedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return `Copied from ${copy.name} · ${d}`
}

/** Edited since it was copied (Re-copy then asks first). */
export function copyEdited(copy: {
  copiedAt?: string | Date | null
  lastModified?: string | Date | null
}): boolean {
  if (!copy.copiedAt || !copy.lastModified) return false
  // Copying stamps both in one transaction; any later write moves lastModified.
  return (
    new Date(copy.lastModified).getTime() > new Date(copy.copiedAt).getTime()
  )
}

/** The delete confirm: what goes, what stays, and the gentler option. */
export function deleteShowMessage(sourceName: string | null): string {
  const stays = sourceName ? `${sourceName} itself is untouched. ` : ''
  return `The show, its set copy and contacts go. ${stays}If it's just off, mark it Cancelled instead.`
}

// ── Practices ─────────────────────────────────────────────────────────────────

export type PracticeStatus = 'upcoming' | 'now' | 'done'

/** From the time, never a stored field. */
export function practiceStatus(
  at: Date,
  minutes: number | null | undefined,
  now: Date
): PracticeStatus {
  const start = at.getTime()
  const end = start + (minutes ?? 0) * 60000
  const t = now.getTime()
  if (t < start) return 'upcoming'
  return t <= end ? 'now' : 'done'
}

/** "2 hours", "90 min", "2½ hours", "1 hour". */
export function durationWords(minutes: number): string {
  if (minutes < 60 || minutes % 30) return `${minutes} min`
  const h = minutes / 60
  const n = h % 1 ? `${Math.floor(h)}½` : String(h)
  return `${n} ${h === 1 ? 'hour' : 'hours'}`
}

/** "2 hours · until 9:00 PM". */
export function untilLine(at: Date, minutes: number): string {
  const end = new Date(at.getTime() + minutes * 60000)
  return `${durationWords(minutes)} · until ${time(end)}`
}

/** End time choices after a start: every 15 min up to 24 h, each with its length. */
export function endOptions(
  start: Date,
  step = 15
): { minutes: number; label: string }[] {
  const out: { minutes: number; label: string }[] = []
  for (let m = step; m <= 24 * 60; m += step) {
    const end = new Date(start.getTime() + m * 60000)
    const len =
      m < 60 ? `${m} mins` : m === 60 ? '1 hr' : `${+(m / 60).toFixed(2)} hrs`
    out.push({ minutes: m, label: `${time(end)} (${len})` })
  }
  return out
}

/** Next Thursday 7:00 PM (Practice 1 default), a week out if today is Thursday. */
export function defaultPracticeDate(now: Date): Date {
  const d = new Date(now)
  d.setHours(19, 0, 0, 0)
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7))
  return d
}

/** Duplicate: the same time a week later. */
export function weekLater(at: Date): Date {
  const d = new Date(at)
  d.setDate(d.getDate() + 7)
  return d
}

/** A song as it goes into a practice: not started, keeping its practice note. */
export function freshPracticeSong(songId: string, notes?: string): SessionSong {
  return {
    songId,
    timeSpent: 0,
    status: 'not-started',
    notes,
    sectionsWorked: [],
    improvements: [],
    needsWork: [],
    memberRatings: [],
  }
}
