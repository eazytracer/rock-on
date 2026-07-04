/**
 * EventService — host-owned events + the song request → host-approve lineup flow.
 *
 * Supabase-only + RLS. Approving a request flips its status to 'approved'; a
 * SECURITY DEFINER trigger promotes it into event_lineup_items atomically (see the
 * events migration). Reads are RLS-scoped.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'
import type {
  EventSummary,
  LineupItem,
  LineupRequest,
  EventParticipant,
} from '../models/Event'

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
  }
}

export class EventService {
  /** Events the current user hosts or participates in (RLS-scoped). */
  static async getEvents(): Promise<EventSummary[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('events')
      .select(
        'id, name, venue, scheduled_date, status, visibility, host_user_id, band_id'
      )
      .order('scheduled_date', { ascending: true })
    if (error) {
      log.error('getEvents failed', error)
      return []
    }
    return ((data as unknown as EventRow[]) ?? []).map(mapEvent)
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
      .select(
        'id, name, venue, scheduled_date, status, visibility, host_user_id, band_id'
      )
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    return mapEvent(data as unknown as EventRow)
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

  static async approveRequest(id: string): Promise<void> {
    await EventService.setRequestStatus(id, 'approved')
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
