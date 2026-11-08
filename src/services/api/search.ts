/**
 * Global search (design/OPERATIONS.md §3 search). Scoped to the current context
 * (bandId, or null for Personal) unless `all` is set.
 */
import { api } from './client'
import { toApiError } from './errors'
import type { Database } from '../../types/database.types'

export type SearchHit =
  Database['public']['Functions']['search']['Returns'][number]

export type SearchKind = 'song' | 'setlist' | 'show' | 'practice' | 'jam'

export async function search(
  query: string,
  bandId: string | null,
  all = false
): Promise<SearchHit[]> {
  const { data, error } = await api().rpc('search', {
    p_query: query,
    p_band_id: bandId ?? undefined,
    p_all: all,
  })
  if (error) throw toApiError(error)
  return data ?? []
}
