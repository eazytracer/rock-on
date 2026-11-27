/**
 * Calendar: the agenda, the show page and the show's set copy
 * (design/OPERATIONS.md §10). Reading one show still goes through the
 * repository; these are the operations with server rules.
 */
import { api } from './client'
import { toApiError } from './errors'
import type { AgendaSource } from '../../domain/calendar'
import type { Json } from '../../types/database.types'

/** Shows and practices of a band, soonest first (jams come from events). */
export async function calendarAgenda(bandId: string): Promise<AgendaSource[]> {
  const { data, error } = await api().rpc('calendar_agenda', {
    p_band_id: bandId,
  })
  if (error) throw toApiError(error)
  return (data ?? []).map(r => ({
    type: r.type as 'show' | 'practice',
    id: r.id,
    name: r.name ?? '',
    venue: r.venue,
    at: r.at,
    minutes: r.minutes,
    cancelled: r.cancelled,
    confirmed: r.confirmed,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    songsTotal: r.songs_total ?? 0,
    songsDone: r.songs_done ?? 0,
  }))
}

/** The show page's editable fields (app names; times as "6:30 PM"; pay in cents). */
export interface ShowPatch {
  name?: string
  venue?: string
  location?: string
  scheduledDate?: string
  loadInTime?: string
  soundcheckTime?: string
  duration?: number
  payment?: number | null
  notes?: string
  contacts?: {
    id: string
    name: string
    role: string
    phone?: string
    email?: string
  }[]
}

/** A show from the first field typed on the blank page. Returns its id. */
export async function createShow(
  bandId: string,
  patch: ShowPatch & { scheduledDate: string }
): Promise<string> {
  const { data, error } = await api().rpc('create_show', {
    p_band_id: bandId,
    p_patch: patch as unknown as Json,
  })
  if (error) throw toApiError(error)
  return data as string
}

export async function updateShow(showId: string, patch: ShowPatch) {
  const { error } = await api().rpc('update_show', {
    p_show_id: showId,
    p_patch: patch as unknown as Json,
  })
  if (error) throw toApiError(error)
}

export async function setShowConfirmed(showId: string, confirmed: boolean) {
  const { error } = await api().rpc('set_show_confirmed', {
    p_show_id: showId,
    p_confirmed: confirmed,
  })
  if (error) throw toApiError(error)
}

/** Cancel keeps the show (struck through); undo restores it. */
export async function setShowCancelled(showId: string, cancelled: boolean) {
  const { error } = await api().rpc('set_show_cancelled', {
    p_show_id: showId,
    p_cancelled: cancelled,
  })
  if (error) throw toApiError(error)
}

/** The show and its set copy; never the setlist it was copied from. */
export async function deleteShow(showId: string) {
  const { error } = await api().rpc('delete_show', { p_show_id: showId })
  if (error) throw toApiError(error)
}

/** Copies a setlist into the show (replacing its set). Returns the copy's id. */
export async function attachSetToShow(
  showId: string,
  setlistId: string
): Promise<string> {
  const { data, error } = await api().rpc('attach_set_to_show', {
    p_show_id: showId,
    p_setlist_id: setlistId,
  })
  if (error) throw toApiError(error)
  return data as string
}

/** Replaces the copy from the same source, keeping its id. */
export async function recopyShowSet(showId: string): Promise<string> {
  const { data, error } = await api().rpc('recopy_show_set', {
    p_show_id: showId,
  })
  if (error) throw toApiError(error)
  return data as string
}

/** An empty set of the show's own. Returns its id. */
export async function createShowSet(showId: string): Promise<string> {
  const { data, error } = await api().rpc('create_show_set', {
    p_show_id: showId,
  })
  if (error) throw toApiError(error)
  return data as string
}

/** Same show a week later (not confirmed), with its own copy of the set. */
export async function duplicateShow(showId: string): Promise<string> {
  const { data, error } = await api().rpc('duplicate_show', {
    p_show_id: showId,
  })
  if (error) throw toApiError(error)
  return data as string
}
