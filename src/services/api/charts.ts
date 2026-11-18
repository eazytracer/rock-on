/**
 * Charts (design/OPERATIONS.md §7, docs/redesign/12-tools-and-chart.md · 4.3).
 * The server stores ChordPro as given; chords-over-lyrics is converted on the
 * client first (src/domain/chordpro.ts, decision 4).
 */
import { api } from './client'
import { toApiError } from './errors'
import type { Database } from '../../types/database.types'

type ChartRow = Database['public']['Tables']['song_charts']['Row']

export interface SongChart {
  songId: string
  chordpro: string
  /** MIDI 0–127, or null. */
  startingNote: number | null
  /** Send back as `expectedVersion` when saving. */
  version: number
  updatedDate: string
  /** Who last saved the text (null for a note-only row or an unknown user). */
  editorName: string | null
}

const fromRow = (r: ChartRow, editorName: string | null = null): SongChart => ({
  songId: r.song_id,
  chordpro: r.chordpro,
  startingNote: r.starting_note,
  version: r.version,
  updatedDate: r.updated_date,
  editorName,
})

/** The song's own chart, or null when it has none. */
export async function getChart(songId: string): Promise<SongChart | null> {
  const { data, error } = await api().rpc('get_chart', { p_song_id: songId })
  if (error) throw toApiError(error)
  const r = data?.[0]
  if (!r) return null
  return {
    songId: r.song_id,
    chordpro: r.chordpro,
    startingNote: r.starting_note ?? null,
    version: r.version,
    updatedDate: r.updated_date,
    editorName: r.editor_name ?? null,
  }
}

/**
 * Saves the ChordPro text. `expectedVersion` = the version the editor opened
 * (omit when there was no chart). Errors: `stale_version`, `chart_too_long`.
 */
export async function saveChart(
  songId: string,
  chordpro: string,
  expectedVersion?: number
): Promise<SongChart> {
  const { data, error } = await api().rpc('save_chart', {
    p_song_id: songId,
    p_chordpro: chordpro,
    p_expected_version: expectedVersion,
  })
  if (error) throw toApiError(error)
  return fromRow(data as ChartRow)
}

/** Saves as you pick; `null` clears. Doesn't change the chart's version. */
export async function setStartingNote(
  songId: string,
  note: number | null
): Promise<SongChart> {
  const { data, error } = await api().rpc('set_starting_note', {
    p_song_id: songId,
    p_note: note ?? undefined,
  })
  if (error) throw toApiError(error)
  return fromRow(data as ChartRow)
}

/**
 * "Copy ‹band›'s chart" on a My Songs copy whose chart is empty (decision 2).
 * Errors: `forbidden` (not a linked copy, or no access to the band song),
 * `not_found` (the band song has no chart), `chart_exists`.
 */
export async function copyLinkedChart(songId: string): Promise<SongChart> {
  const { data, error } = await api().rpc('copy_linked_chart', {
    p_song_id: songId,
  })
  if (error) throw toApiError(error)
  return fromRow(data as ChartRow)
}
