/**
 * Bands, memberships and invites (design/OPERATIONS.md §4, docs/redesign/13 · 3.1).
 * Every write is an RPC; errors arrive as ApiError keys: `forbidden`,
 * `not_found`, `invalid_name`, `invalid_mark`, `invalid_links`, `invite_invalid`,
 * `already_member`, `invalid_role`, `owner_role_fixed`, `cannot_remove_owner`,
 * `owner_must_transfer`, `owner_must_delete`, `confirm_mismatch`.
 */
import { api } from './client'
import { toApiError } from './errors'
import type { Database, Json } from '../../types/database.types'

type Tables = Database['public']['Tables']
export type BandRow = Tables['bands']['Row']
export type MembershipRow = Tables['band_memberships']['Row']
export type InviteCodeRow = Tables['invite_codes']['Row']
export type BandPreview =
  Database['public']['Functions']['band_preview_by_code']['Returns'][number]

/** `bands.mark`. color / lettering / symbol are palette keys the client owns. */
export interface BandMark {
  kind: 'initials' | 'symbol'
  initials?: string | null
  symbol?: string | null
  color?: string | null
  lettering?: string | null
}

export interface BandLink {
  label?: string
  url: string
}

export async function createBand(name: string, mark?: BandMark) {
  const { data, error } = await api().rpc('create_band', {
    p_name: name,
    p_mark: mark as unknown as Json,
  })
  if (error) throw toApiError(error)
  return data as BandRow
}

/** Throws `invite_invalid` for a bad, expired or regenerated code. */
export async function bandPreviewByCode(code: string) {
  const { data, error } = await api().rpc('band_preview_by_code', {
    p_code: code,
  })
  if (error) throw toApiError(error)
  return (data ?? [])[0] as BandPreview
}

export async function joinBand(code: string) {
  const { data, error } = await api().rpc('join_band', { p_code: code })
  if (error) throw toApiError(error)
  return data as MembershipRow
}

export async function regenerateInviteCode(bandId: string) {
  const { data, error } = await api().rpc('regenerate_invite_code', {
    p_band_id: bandId,
  })
  if (error) throw toApiError(error)
  return data as InviteCodeRow
}

export async function setMemberRole(
  bandId: string,
  userId: string,
  role: 'admin' | 'member'
) {
  const { data, error } = await api().rpc('set_member_role', {
    p_band_id: bandId,
    p_user_id: userId,
    p_role: role,
  })
  if (error) throw toApiError(error)
  return data as MembershipRow
}

export async function removeMember(bandId: string, userId: string) {
  const { data, error } = await api().rpc('remove_member', {
    p_band_id: bandId,
    p_user_id: userId,
  })
  if (error) throw toApiError(error)
  return data as MembershipRow
}

/** Atomic: you become an admin, they become the owner. */
export async function transferOwnership(bandId: string, userId: string) {
  const { data, error } = await api().rpc('transfer_ownership', {
    p_band_id: bandId,
    p_user_id: userId,
  })
  if (error) throw toApiError(error)
  return data as MembershipRow
}

export async function leaveBand(bandId: string) {
  const { data, error } = await api().rpc('leave_band', { p_band_id: bandId })
  if (error) throw toApiError(error)
  return data as MembershipRow
}

export async function deleteBand(bandId: string, confirmName: string) {
  const { data, error } = await api().rpc('delete_band', {
    p_band_id: bandId,
    p_confirm_name: confirmName,
  })
  if (error) throw toApiError(error)
  return data as BandRow
}

/** Omitted fields stay as they are; '' clears city / description. */
export async function updateBandProfile(
  bandId: string,
  patch: {
    name?: string
    description?: string
    mark?: BandMark
    city?: string
    genres?: string[]
    links?: BandLink[]
  }
) {
  const { data, error } = await api().rpc('update_band_profile', {
    p_band_id: bandId,
    p_name: patch.name,
    p_description: patch.description,
    p_mark: patch.mark as unknown as Json,
    p_city: patch.city,
    p_genres: patch.genres,
    p_links: patch.links as unknown as Json,
  })
  if (error) throw toApiError(error)
  return data as BandRow
}

/** The band row (members can read it; soft-deleted bands are hidden). */
export async function getBand(bandId: string) {
  const { data, error } = await api()
    .from('bands')
    .select('*')
    .eq('id', bandId)
    .maybeSingle()
  if (error) throw toApiError(error)
  return data as BandRow | null
}

/**
 * The band's live invite code, or null. Only the owner and admins can read
 * codes; for anyone else this is null.
 */
export async function getActiveInviteCode(bandId: string) {
  const { data, error } = await api()
    .from('invite_codes')
    .select('*')
    .eq('band_id', bandId)
    .eq('is_active', true)
    .order('created_date', { ascending: false })
    .limit(1)
  if (error) throw toApiError(error)
  return ((data ?? [])[0] as InviteCodeRow | undefined) ?? null
}
