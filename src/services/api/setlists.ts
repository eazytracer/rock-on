/**
 * Setlists (design/OPERATIONS.md §9). Read / write of a single setlist still
 * goes through the repository; these are the operations with server rules.
 */
import { api } from './client'
import { toApiError } from './errors'
import type { IndexRow, IndexSong } from '../../domain/setlist'

/** The index's cards for one context (band id, or the user id in Personal). */
export async function setlistIndex(
  contextType: 'band' | 'personal',
  contextId: string
): Promise<IndexRow[]> {
  const { data, error } = await api().rpc('setlist_index', {
    p_context_type: contextType,
    p_context_id: contextId,
  })
  if (error) throw toApiError(error)
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    lastModified: r.last_modified,
    showId: r.show_id,
    showName: r.show_name,
    showVenue: r.show_venue,
    showAt: r.show_at,
    songs: (r.songs as unknown as IndexSong[]) ?? [],
    breakMinutes: r.break_minutes ?? 0,
  }))
}

/** A copy named "‹name› copy", not attached to a show. Returns its id. */
export async function duplicateSetlist(setlistId: string): Promise<string> {
  const { data, error } = await api().rpc('duplicate_setlist', {
    p_setlist_id: setlistId,
  })
  if (error) throw toApiError(error)
  return data as string
}
