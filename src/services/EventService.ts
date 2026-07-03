/**
 * EventService — host-owned events + the song request → host-approve lineup flow.
 *
 * Supabase-only + RLS. Approving a request flips its status to 'approved'; a
 * SECURITY DEFINER trigger promotes it into event_lineup_items atomically (see the
 * events migration). Reads are RLS-scoped.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'
import type { EventSummary, LineupItem, LineupRequest } from '../models/Event'

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
