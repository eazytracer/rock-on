/**
 * Songs (design/OPERATIONS.md §6). List, create and update still go through the
 * repository; these are the operations that need the server's rules.
 */
import { api } from './client'
import { toApiError } from './errors'
import type { Database } from '../../types/database.types'

type Fns = Database['public']['Functions']

export type SongUsage = Fns['song_usage']['Returns'][number]
export type SongNextShow = Fns['song_next_shows']['Returns'][number]
export type CatalogGap = Fns['band_songs_not_in_my_catalog']['Returns'][number]

export async function songUsage(songId: string): Promise<SongUsage[]> {
  const { data, error } = await api().rpc('song_usage', { p_song_id: songId })
  if (error) throw toApiError(error)
  return data ?? []
}

export async function songNextShows(bandId: string): Promise<SongNextShow[]> {
  const { data, error } = await api().rpc('song_next_shows', {
    p_band_id: bandId,
  })
  if (error) throw toApiError(error)
  return data ?? []
}

export async function setBandNote(
  songId: string,
  notes: string,
  expectedVersion?: number
): Promise<void> {
  const { error } = await api().rpc('set_band_note', {
    p_song_id: songId,
    p_notes: notes,
    p_expected_version: expectedVersion,
  })
  if (error) throw toApiError(error)
}

export async function duplicateSong(songId: string): Promise<string> {
  const { data, error } = await api().rpc('duplicate_song', {
    p_song_id: songId,
  })
  if (error) throw toApiError(error)
  return (data as { id: string }).id
}

export async function deleteSong(songId: string): Promise<void> {
  const { error } = await api().rpc('delete_song', { p_song_id: songId })
  if (error) throw toApiError(error)
}

export async function bandSongsNotInMyCatalog(): Promise<CatalogGap[]> {
  const { data, error } = await api().rpc('band_songs_not_in_my_catalog')
  if (error) throw toApiError(error)
  return data ?? []
}

/** Copies band songs into My Songs; `null` copies all of them. */
export async function copyBandSongsToPersonal(
  songIds: string[] | null
): Promise<number> {
  const { data, error } = await api().rpc('copy_band_songs_to_personal', {
    p_song_ids: songIds ?? undefined,
  })
  if (error) throw toApiError(error)
  return data?.length ?? 0
}
