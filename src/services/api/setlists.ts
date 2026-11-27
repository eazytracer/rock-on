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
    showMinutes: r.show_minutes ?? null,
    showSetTime: r.show_set_time ?? null,
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

/** Rename: 1–80 characters, trimmed. */
export async function renameSetlist(setlistId: string, name: string) {
  const { error } = await api().rpc('rename_setlist', {
    p_setlist_id: setlistId,
    p_name: name,
  })
  if (error) throw toApiError(error)
}

/** The set's Markdown notes; empty clears them. */
export async function setSetlistNotes(setlistId: string, notes: string) {
  const { error } = await api().rpc('set_setlist_notes', {
    p_setlist_id: setlistId,
    p_notes: notes,
  })
  if (error) throw toApiError(error)
}

/** An `afterItem` meaning "at the top of the set" (null means at the end). */
export const TOP = ''

/**
 * Songs in after `afterItem` (null = at the end, TOP = first). In a band set your own
 * songs are copied into the band first. Returns the new items' ids.
 */
export async function addSongsToSetlist(
  setlistId: string,
  songIds: string[],
  afterItem: string | null
): Promise<string[]> {
  const { data, error } = await api().rpc('add_songs_to_setlist', {
    p_setlist_id: setlistId,
    p_song_ids: songIds,
    ...(afterItem !== null ? { p_after_item: afterItem } : {}),
  })
  if (error) throw toApiError(error)
  return data ?? []
}

export type InsertItem =
  | { type: 'break'; minutes: number; note?: string }
  | { type: 'section'; label: string }

/** A break (5–60 min) or a section label after `afterItem` (as above). Returns its id. */
export async function insertSetlistItem(
  setlistId: string,
  item: InsertItem,
  afterItem: string | null
): Promise<string> {
  const { data, error } = await api().rpc('insert_setlist_item', {
    p_setlist_id: setlistId,
    p_type: item.type,
    ...(afterItem !== null ? { p_after_item: afterItem } : {}),
    ...(item.type === 'break'
      ? { p_minutes: item.minutes, p_note: item.note ?? '' }
      : { p_label: item.label }),
  })
  if (error) throw toApiError(error)
  return data as string
}

export interface ItemPatch {
  breakDuration?: number
  breakNotes?: string
  sectionTitle?: string
  notes?: string
}

export async function updateSetlistItem(
  setlistId: string,
  itemId: string,
  patch: ItemPatch
) {
  const { error } = await api().rpc('update_setlist_item', {
    p_setlist_id: setlistId,
    p_item_id: itemId,
    p_patch: patch as never,
  })
  if (error) throw toApiError(error)
}

/** Moves an item so it ends up at 0-based index `to`. */
export async function moveSetlistItem(
  setlistId: string,
  itemId: string,
  to: number
) {
  const { error } = await api().rpc('move_setlist_item', {
    p_setlist_id: setlistId,
    p_item_id: itemId,
    p_to: to,
  })
  if (error) throw toApiError(error)
}

/** Removes a row; the song stays in the catalog and other sets. */
export async function removeSetlistItem(setlistId: string, itemId: string) {
  const { error } = await api().rpc('remove_setlist_item', {
    p_setlist_id: setlistId,
    p_item_id: itemId,
  })
  if (error) throw toApiError(error)
}
