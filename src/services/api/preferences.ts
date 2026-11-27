/**
 * Preferences (design/OPERATIONS.md §2 get_preferences / set_preferences).
 * One row per user in public.user_preferences; RLS limits it to its owner.
 */
import { api } from './client'
import { toApiError } from './errors'
import type { ClickSound } from '../audio/metronomeEngine'

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

/**
 * Chart reader view state (docs/redesign/12 · 2.7): text size, chords on / off,
 * and transpose per song. Per user, never stored on the song.
 */
export interface ChartPrefs {
  size: number
  chords: boolean
  transpose: Record<string, number>
}

export const CHART_PREF_DEFAULTS: ChartPrefs = {
  size: 22,
  chords: true,
  transpose: {},
}

export async function getChartPrefs(userId: string): Promise<ChartPrefs> {
  const { data, error } = await api()
    .from('user_preferences')
    .select('chart')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toApiError(error)
  const raw = (data?.chart ?? {}) as Partial<ChartPrefs>
  return {
    size: typeof raw.size === 'number' ? raw.size : CHART_PREF_DEFAULTS.size,
    chords:
      typeof raw.chords === 'boolean' ? raw.chords : CHART_PREF_DEFAULTS.chords,
    transpose:
      raw.transpose && typeof raw.transpose === 'object' ? raw.transpose : {},
  }
}

export async function setChartPrefs(
  userId: string,
  prefs: ChartPrefs
): Promise<void> {
  const { error } = await api()
    .from('user_preferences')
    .upsert(
      { user_id: userId, chart: prefs as never },
      { onConflict: 'user_id' }
    )
  if (error) throw toApiError(error)
}

/**
 * Merged write into one JSONB column: read it, merge `changes`, upsert that column
 * only (other columns and other keys in it are left alone).
 */
async function mergeJsonColumn(
  userId: string,
  column: 'metronome' | 'push',
  changes: Record<string, unknown>
): Promise<void> {
  const { data, error } = await api()
    .from('user_preferences')
    .select(column)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toApiError(error)
  const current = ((data as Record<string, unknown> | null)?.[column] ??
    {}) as Record<string, unknown>
  const { error: upsertError } = await api()
    .from('user_preferences')
    .upsert(
      { user_id: userId, [column]: { ...current, ...changes } as never },
      { onConflict: 'user_id' }
    )
  if (upsertError) throw toApiError(upsertError)
}

/**
 * Metronome settings that follow the user (decision 6): only the click sound.
 * Last BPM / signature / subdivision / flash stay on the device (toolsMemory).
 */
export type { ClickSound }
export const CLICK_SOUNDS: readonly ClickSound[] = [
  'beep',
  'woodblock',
  'hihat',
]

export interface MetronomePrefs {
  click: ClickSound
}

export const METRONOME_PREF_DEFAULTS: MetronomePrefs = { click: 'beep' }

export async function getMetronomePrefs(
  userId: string
): Promise<MetronomePrefs> {
  const { data, error } = await api()
    .from('user_preferences')
    .select('metronome')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toApiError(error)
  const raw = (data?.metronome ?? {}) as Partial<MetronomePrefs>
  return {
    click: CLICK_SOUNDS.includes(raw.click as ClickSound)
      ? (raw.click as ClickSound)
      : METRONOME_PREF_DEFAULTS.click,
  }
}

export function setMetronomePrefs(
  userId: string,
  changes: Partial<MetronomePrefs>
): Promise<void> {
  return mergeJsonColumn(userId, 'metronome', changes)
}

/**
 * Push preferences (Account and Settings 8). Stored only; delivery is a later
 * phase. `mutedBands` holds band ids; quiet hours are local "HH:MM" in `tz`.
 */
export type PushType =
  | 'shows'
  | 'practices'
  | 'events'
  | 'planChanged'
  | 'setChanged'
  | 'invites'
  | 'friendRequests'

export interface PushPrefs {
  enabled: boolean
  types: Record<PushType, boolean>
  mutedBands: string[]
  quietHours: { enabled: boolean; start: string; end: string; tz: string }
}

export const PUSH_TYPES: readonly PushType[] = [
  'shows',
  'practices',
  'events',
  'planChanged',
  'setChanged',
  'invites',
  'friendRequests',
]

const deviceTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export const pushPrefDefaults = (): PushPrefs => ({
  enabled: true,
  types: Object.fromEntries(PUSH_TYPES.map(t => [t, true])) as Record<
    PushType,
    boolean
  >,
  mutedBands: [],
  quietHours: { enabled: true, start: '23:00', end: '08:00', tz: deviceTz() },
})

const isHHMM = (v: unknown): v is string =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

export async function getPushPrefs(userId: string): Promise<PushPrefs> {
  const { data, error } = await api()
    .from('user_preferences')
    .select('push')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toApiError(error)
  const raw = (data?.push ?? {}) as Partial<PushPrefs>
  const d = pushPrefDefaults()
  const types = { ...d.types }
  for (const t of PUSH_TYPES) {
    const v = raw.types?.[t]
    if (typeof v === 'boolean') types[t] = v
  }
  const q = raw.quietHours
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
    types,
    mutedBands: Array.isArray(raw.mutedBands)
      ? raw.mutedBands.filter((b): b is string => typeof b === 'string')
      : [],
    quietHours: {
      enabled:
        typeof q?.enabled === 'boolean' ? q.enabled : d.quietHours.enabled,
      start: isHHMM(q?.start) ? q.start : d.quietHours.start,
      end: isHHMM(q?.end) ? q.end : d.quietHours.end,
      tz: typeof q?.tz === 'string' && q.tz ? q.tz : d.quietHours.tz,
    },
  }
}

/** Top-level keys merge; pass whole `types` / `quietHours` objects. */
export function setPushPrefs(
  userId: string,
  changes: Partial<PushPrefs>
): Promise<void> {
  return mergeJsonColumn(userId, 'push', changes)
}
