/**
 * EventService — host-owned events + the song request → host-approve lineup flow.
 *
 * Supabase-only + RLS. Approving a request flips its status to 'approved'; a
 * SECURITY DEFINER trigger promotes it into event_lineup_items atomically (see the
 * events migration). Reads are RLS-scoped.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'
import { normalizeText } from '../utils/songMatcher'
import type {
  EventSummary,
  LineupItem,
  LineupRequest,
  EventParticipant,
  EventRsvp,
} from '../models/Event'
import { DEFAULT_LINEUP } from '../models/Casting'

const log = createLogger('EventService')

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

interface EventRow {
  id: string
  name: string
  venue: string | null
  scheduled_date: string
  status: EventSummary['status']
  visibility: EventSummary['visibility']
  host_user_id: string
  band_id: string | null
  allow_suggestions: boolean | null
  auto_approve: boolean | null
  short_code: string | null
}
interface ItemRow {
  id: string
  position: number
  source: LineupItem['source']
  owner_id: string | null
  song_id: string | null
  display_title: string
  display_artist: string
}
interface RequestRow {
  id: string
  requester_id: string
  source: LineupRequest['source']
  display_title: string
  display_artist: string
  status: LineupRequest['status']
  created_date: string
}
interface ParticipantRow {
  user_id: string
  access_tier: EventParticipant['accessTier']
  rsvp: EventParticipant['rsvp']
  users: { name: string | null } | null
}

const EVENT_COLS =
  'id, name, venue, scheduled_date, status, visibility, host_user_id, band_id, allow_suggestions, auto_approve, short_code'

function mapEvent(r: EventRow): EventSummary {
  return {
    id: r.id,
    name: r.name,
    venue: r.venue ?? undefined,
    scheduledDate: new Date(r.scheduled_date),
    status: r.status,
    visibility: r.visibility,
    hostUserId: r.host_user_id,
    bandId: r.band_id ?? undefined,
    allowSuggestions: r.allow_suggestions ?? true,
    autoApprove: r.auto_approve ?? false,
    shortCode: r.short_code ?? undefined,
  }
}

export class EventService {
  /** Events the current user hosts or participates in (RLS-scoped). */
  static async getEvents(): Promise<EventSummary[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const me = await currentUserId()
    const { data, error } = await supabase
      .from('events')
      .select(
        `${EVENT_COLS}, event_participants(user_id, rsvp, users(name)), event_lineup_items(count)`
      )
      .order('scheduled_date', { ascending: true })
    if (error) {
      log.error('getEvents failed', error)
      return []
    }
    type ListRow = EventRow & {
      event_participants?: {
        user_id: string
        rsvp: EventRsvp
        users: { name: string | null } | null
      }[]
      event_lineup_items?: { count: number }[]
    }
    const rows = (data as unknown as ListRow[]) ?? []
    // One round-trip for cast progress across every listed event.
    const castByEvent = await EventService.primaryCastCounts(
      rows.map(r => r.id)
    )
    // App-created events are band-less → the 5-part default lineup. (A rare
    // band-linked event may have a different part count; castPct caps at 100.)
    const PARTS = DEFAULT_LINEUP.filter(r => r.isDefaultPart).length
    return rows.map(r => {
      const people = r.event_participants ?? []
      const lineupCount = r.event_lineup_items?.[0]?.count ?? 0
      const totalParts = lineupCount * PARTS
      return {
        ...mapEvent(r),
        participantCount: people.length,
        participantNames: people
          .map(p => p.users?.name?.trim() || 'Guest')
          .slice(0, 5),
        goingCount: people.filter(p => p.rsvp === 'going').length,
        castPct:
          totalParts > 0
            ? Math.min(
                100,
                Math.round(((castByEvent.get(r.id) ?? 0) / totalParts) * 100)
              )
            : undefined,
        myRsvp: me ? people.find(p => p.user_id === me)?.rsvp : undefined,
      }
    })
  }

  /**
   * Filled parts per event id (one query, RLS-scoped): the count of DISTINCT
   * (lineup slot, role) pairs that have a primary assignment — matching the
   * detail page's `castFilled` semantics (a slot+role is "cast" once, even if
   * the seed holds duplicate primaries). Slot-less rows are ignored.
   */
  private static async primaryCastCounts(
    eventIds: string[]
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    const supabase = getSupabaseClient()
    if (!supabase || eventIds.length === 0) return counts
    const { data, error } = await supabase
      .from('casting_assignments')
      .select('context_id, event_lineup_item_id, role_key')
      .eq('context_type', 'event')
      .eq('is_primary', true)
      .in('context_id', eventIds)
    if (error) {
      log.error('primaryCastCounts failed', error)
      return counts
    }
    const seen = new Set<string>()
    for (const row of (data as unknown as {
      context_id: string
      event_lineup_item_id: string | null
      role_key: string
    }[]) ?? []) {
      if (!row.event_lineup_item_id) continue
      const key = `${row.context_id}|${row.event_lineup_item_id}|${row.role_key}`
      if (seen.has(key)) continue
      seen.add(key)
      counts.set(row.context_id, (counts.get(row.context_id) ?? 0) + 1)
    }
    return counts
  }

  /**
   * Create an event hosted by the current user and add them as the host participant.
   * Returns the new event id (or null on failure).
   */
  static async createEvent(input: {
    name: string
    scheduledDate: Date
    venue?: string
  }): Promise<string | null> {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    const me = await currentUserId()
    if (!me) return null
    const { data, error } = await supabase
      .from('events')
      .insert({
        host_user_id: me,
        name: input.name.trim(),
        venue: input.venue?.trim() || null,
        scheduled_date: input.scheduledDate.toISOString(),
        // Unlisted = shareable by code (a short_code is auto-assigned by trigger),
        // but not publicly listed. This is the social/code-joinable default.
        visibility: 'unlisted',
      } as never)
      .select('id')
      .maybeSingle()
    if (error || !data) {
      log.error('createEvent failed', error)
      return null
    }
    const eventId = (data as unknown as { id: string }).id
    // Add the host as a participant so RLS/participant checks see them.
    const { error: pErr } = await supabase.from('event_participants').insert({
      event_id: eventId,
      user_id: me,
      access_tier: 'host',
      rsvp: 'going',
    } as never)
    if (pErr) log.error('createEvent: host participant insert failed', pErr)
    return eventId
  }

  /**
   * Join an event by its short_code. Calls the join_event_by_code SECURITY DEFINER
   * RPC, which resolves the event (bypassing events RLS for the non-participant
   * lookup) and adds the caller as a 'guest' participant. Returns a minimal preview
   * so the caller can navigate to the event.
   */
  static async joinByCode(
    code: string
  ): Promise<{ ok: boolean; eventId?: string; name?: string; error?: string }> {
    const supabase = getSupabaseClient()
    if (!supabase) return { ok: false, error: 'Offline' }
    const me = await currentUserId()
    if (!me) return { ok: false, error: 'Not signed in' }
    // rpc is untyped here (no generated DB types) — cast the call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('join_event_by_code', {
      p_code: code.trim().toUpperCase(),
    })
    if (error) {
      log.error('join_event_by_code failed', error)
      return { ok: false, error: 'Could not join. Try again.' }
    }
    const match = (
      data as unknown as {
        out_event_id: string
        out_name: string
        out_host_name: string | null
        out_scheduled_date: string
      }[]
    )?.[0]
    if (!match) return { ok: false, error: 'No event found for that code' }
    return { ok: true, eventId: match.out_event_id, name: match.out_name }
  }

  static async getEvent(id: string): Promise<EventSummary | null> {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_COLS)
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    return mapEvent(data as unknown as EventRow)
  }

  /**
   * Update the host-only Access settings (visibility + guest permissions).
   * RLS (events_update_manager) enforces host/cohost authority.
   */
  static async updateAccess(
    eventId: string,
    patch: Partial<{
      visibility: EventSummary['visibility']
      allowSuggestions: boolean
      autoApprove: boolean
    }>
  ): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    const row: Record<string, unknown> = {}
    if (patch.visibility !== undefined) row.visibility = patch.visibility
    if (patch.allowSuggestions !== undefined)
      row.allow_suggestions = patch.allowSuggestions
    if (patch.autoApprove !== undefined) row.auto_approve = patch.autoApprove
    if (Object.keys(row).length === 0) return true
    const { error } = await supabase
      .from('events')
      .update(row as never)
      .eq('id', eventId)
    if (error) {
      log.error('updateAccess failed', error)
      return false
    }
    return true
  }

  static async getLineup(eventId: string): Promise<LineupItem[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('event_lineup_items')
      .select(
        'id, position, source, owner_id, song_id, display_title, display_artist'
      )
      .eq('event_id', eventId)
      .order('position', { ascending: true })
    if (error) {
      log.error('getLineup failed', error)
      return []
    }
    return ((data as unknown as ItemRow[]) ?? []).map(r => ({
      id: r.id,
      position: r.position,
      source: r.source,
      ownerId: r.owner_id ?? undefined,
      songId: r.song_id ?? undefined,
      displayTitle: r.display_title,
      displayArtist: r.display_artist,
    }))
  }

  /**
   * The event's participants — the pool a host casts from (guests included, not
   * just band members). Names resolve via the co-participant RLS policy
   * (are_event_coparticipants) added in the social_events migration.
   */
  static async getParticipants(eventId: string): Promise<EventParticipant[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('event_participants')
      .select('user_id, access_tier, rsvp, users(name)')
      .eq('event_id', eventId)
    if (error) {
      log.error('getParticipants failed', error)
      return []
    }
    return ((data as unknown as ParticipantRow[]) ?? []).map(r => ({
      userId: r.user_id,
      name: r.users?.name?.trim() || 'Guest',
      accessTier: r.access_tier,
      rsvp: r.rsvp,
    }))
  }

  /**
   * Invite friends to an event as pending-RSVP guests. The host (event manager)
   * inserting rows for other users is permitted by `event_participants_insert_self`
   * (the `is_event_manager` branch); co-participant name visibility is already
   * granted by `users_select_event_coparticipant`. Idempotent — re-inviting an
   * existing participant is ignored (UNIQUE event_id,user_id).
   */
  static async inviteFriends(
    eventId: string,
    userIds: string[]
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabaseClient()
    if (!supabase) return { ok: false, error: 'Offline' }
    if (userIds.length === 0) return { ok: true }
    const rows = userIds.map(user_id => ({
      event_id: eventId,
      user_id,
      access_tier: 'guest',
      rsvp: 'pending',
    }))
    const { error } = await supabase
      .from('event_participants')
      .upsert(rows as never, {
        onConflict: 'event_id,user_id',
        ignoreDuplicates: true,
      })
    if (error) {
      log.error('inviteFriends failed', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }

  static async getPendingRequests(eventId: string): Promise<LineupRequest[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('event_lineup_requests')
      .select(
        'id, requester_id, source, display_title, display_artist, status, created_date'
      )
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .order('created_date', { ascending: true })
    if (error) {
      log.error('getPendingRequests failed', error)
      return []
    }
    return ((data as unknown as RequestRow[]) ?? []).map(r => ({
      id: r.id,
      requesterId: r.requester_id,
      source: r.source,
      displayTitle: r.display_title,
      displayArtist: r.display_artist,
      status: r.status,
      createdDate: new Date(r.created_date),
    }))
  }

  /** Request a song (as any participant). Stays pending until the host approves. */
  static async addRequest(
    eventId: string,
    title: string,
    artist: string
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabaseClient()
    if (!supabase) return { ok: false, error: 'Offline' }
    const me = await currentUserId()
    if (!me) return { ok: false, error: 'Not signed in' }
    const { error } = await supabase.from('event_lineup_requests').insert({
      event_id: eventId,
      requester_id: me,
      source: 'external',
      owner_id: me,
      display_title: title.trim(),
      display_artist: artist.trim(),
    } as never)
    if (error) {
      log.error('addRequest failed', error)
      return { ok: false, error: 'Could not send request' }
    }
    return { ok: true }
  }

  /**
   * Approve a pending song request. If a `bandId` is supplied (the approving
   * host's current band context) and the request isn't already catalog-linked,
   * try to match its title/artist against that band's catalog; on a hit, set
   * `source='band'` + `song_id` in the SAME status→approved update so the
   * promote trigger carries the link into the lineup item (→ "Band" pill
   * instead of "Not linked"). No match / no band → plain approve, unchanged.
   */
  static async approveRequest(
    id: string,
    bandId?: string | null
  ): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return

    const patch: Record<string, unknown> = { status: 'approved' }

    if (bandId) {
      const { data: req } = await supabase
        .from('event_lineup_requests')
        .select('display_title, display_artist, song_id')
        .eq('id', id)
        .maybeSingle()
      const r = req as {
        display_title?: string
        display_artist?: string
        song_id?: string | null
      } | null
      if (r && !r.song_id) {
        const { data: match } = await supabase
          .from('songs')
          .select('id')
          .eq('context_type', 'band')
          .eq('context_id', bandId)
          .eq('normalized_title', normalizeText(r.display_title ?? ''))
          .eq('normalized_artist', normalizeText(r.display_artist ?? ''))
          .limit(1)
          .maybeSingle()
        const matchId = (match as { id?: string } | null)?.id
        if (matchId) {
          patch.source = 'band'
          patch.song_id = matchId
        }
      }
    }

    const { error } = await supabase
      .from('event_lineup_requests')
      .update(patch as never)
      .eq('id', id)
    if (error) log.error('approveRequest failed', error)
  }
  static async rejectRequest(id: string): Promise<void> {
    await EventService.setRequestStatus(id, 'rejected')
  }

  private static async setRequestStatus(
    id: string,
    status: string
  ): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('event_lineup_requests')
      .update({ status } as never)
      .eq('id', id)
    if (error) log.error(`setRequestStatus(${status}) failed`, error)
  }
}
