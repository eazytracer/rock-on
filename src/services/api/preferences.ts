/**
 * Preferences (design/OPERATIONS.md §2 get_preferences / set_preferences).
 * One row per user in public.user_preferences; RLS limits it to its owner.
 */
import { api } from './client'
import { toApiError } from './errors'

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Preferences {
  theme: ThemePreference
}

const DEFAULTS: Preferences = { theme: 'system' }

export async function getPreferences(userId: string): Promise<Preferences> {
  const { data, error } = await api()
    .from('user_preferences')
    .select('theme')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toApiError(error)
  return data ? { theme: data.theme as ThemePreference } : DEFAULTS
}

export async function setPreferences(
  userId: string,
  changes: Partial<Preferences>
): Promise<void> {
  const { error } = await api()
    .from('user_preferences')
    .upsert({ user_id: userId, ...changes }, { onConflict: 'user_id' })
  if (error) throw toApiError(error)
}

/** Per-list view settings (Song Row · View options), keyed `songs:<contextId>`. */
export async function getListViews(
  userId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await api()
    .from('user_preferences')
    .select('list_views')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toApiError(error)
  return (data?.list_views as Record<string, unknown> | null) ?? {}
}

export async function setListView(
  userId: string,
  key: string,
  value: unknown
): Promise<void> {
  const current = await getListViews(userId)
  const { error } = await api()
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        list_views: { ...current, [key]: value } as never,
      },
      { onConflict: 'user_id' }
    )
  if (error) throw toApiError(error)
}
