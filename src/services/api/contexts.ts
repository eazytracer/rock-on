/**
 * Contexts (design/OPERATIONS.md §3 list_my_contexts): the bands the user is an
 * active member of, with a dot for unread bandmate activity. Personal is always
 * available and isn't returned.
 */
import { api } from './client'
import { toApiError } from './errors'
import type { Database } from '../../types/database.types'

export type MyContext =
  Database['public']['Functions']['list_my_contexts']['Returns'][number]

export async function listMyContexts(): Promise<MyContext[]> {
  const { data, error } = await api().rpc('list_my_contexts')
  if (error) throw toApiError(error)
  return data ?? []
}
