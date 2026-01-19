/* eslint-disable @typescript-eslint/no-explicit-any */
import { IDataRepository, SongFilter, BandFilter } from './IDataRepository'
import { Song } from '../../models/Song'
import { Band } from '../../models/Band'
import { Setlist } from '../../models/Setlist'
import { PracticeSession } from '../../models/PracticeSession'
import { Show } from '../../models/Show'
import { BandMembership, InviteCode } from '../../models/BandMembership'
import { User } from '../../models/User'
import {
  SongPersonalNote,
  SongPersonalNoteInput,
  SongPersonalNoteUpdate,
} from '../../models/SongPersonalNote'
import {
  SongNoteEntry,
  SongNoteEntryInput,
  SongNoteEntryUpdate,
} from '../../models/SongNoteEntry'
import { supabase } from '../supabase/client'
import {
  IncrementalSyncResult,
  createEmptyIncrementalSyncResult,
} from './syncTypes'

/**
 * Remote repository implementation using Supabase
 */
export class RemoteRepository implements IDataRepository {
  // ========== SONGS ==========

  async getSongs(filter?: SongFilter): Promise<Song[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    let query = supabase.from('songs').select('*')

    if (filter?.contextType) {
      query = query.eq('context_type', filter.contextType)
    }

    if (filter?.contextId) {
      query = query.eq('context_id', filter.contextId)
    }

    if (filter?.createdBy) {
      query = query.eq('created_by', filter.createdBy)
    }

    if (filter?.songGroupId) {
      query = query.eq('song_group_id', filter.songGroupId)
    }

    const { data, error } = await query

    if (error) throw error

    return data.map(row => this.mapSongFromSupabase(row))
  }

  async getSong(id: string): Promise<Song | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return this.mapSongFromSupabase(data)
  }

  async addSong(song: Song): Promise<Song> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const mappedSong = this.mapSongToSupabase(song)

    // Debug logging for RLS issues
    const {
      data: { user },
    } = await supabase.auth.getUser()
    console.log('[RemoteRepository.addSong] Debug info:', {
      songId: song.id,
      createdBy: mappedSong.created_by,
      contextId: mappedSong.context_id,
      contextType: mappedSong.context_type,
      authUid: user?.id,
      authUidMatches: mappedSong.created_by === user?.id,
    })

    const { data, error } = await supabase
      .from('songs')
      .insert(mappedSong as any)
      .select()
      .single()

    if (error) {
      console.error('[RemoteRepository.addSong] Insert failed:', {
        error,
        mappedSong,
        authUser: user?.id,
      })
      throw error
    }

    return this.mapSongFromSupabase(data)
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('songs')
      // @ts-expect-error - Supabase generated types are overly strict, using Record<string, any> for field mapping
      .update(this.mapSongToSupabase(updates))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapSongFromSupabase(data)
  }

  async deleteSong(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase.from('songs').delete().eq('id', id)

    if (error) throw error
  }

  // ========== FIELD MAPPING ==========

  private mapSongToSupabase(song: Partial<Song>): Record<string, any> {
    // Note: Only include fields that exist in Supabase schema
    // Fields like album, guitarTuning, lyrics, chords, tags, structure, referenceLinks
    // are IndexedDB-only and should NOT be sent to Supabase
    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      // album: IndexedDB only - do NOT send to Supabase
      duration: song.duration,
      key: song.key,
      tempo: song.bpm, // bpm (IndexedDB) -> tempo (Supabase)
      difficulty: song.difficulty,
      guitar_tuning: song.guitarTuning, // guitarTuning (IndexedDB) -> guitar_tuning (Supabase)
      notes: song.notes,
      created_date: song.createdDate,
      last_practiced: song.lastPracticed,
      confidence_level: song.confidenceLevel,
      context_type: song.contextType,
      context_id: song.contextId,
      created_by: song.createdBy,
      visibility: song.visibility,
      song_group_id: song.songGroupId,
      last_modified_by: song.lastModifiedBy ?? null,
    }
  }

  private mapSongFromSupabase(row: any): Song {
    // Note: Supabase doesn't store album, guitarTuning, lyrics, chords, tags, structure, referenceLinks
    // These fields are IndexedDB-only and will be empty when reading from Supabase
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: '', // IndexedDB only - not in Supabase
      duration: row.duration ?? 0,
      key: row.key,
      bpm: row.tempo ?? 0, // tempo (Supabase) -> bpm (IndexedDB)
      difficulty: row.difficulty ?? 1,
      guitarTuning: row.guitar_tuning ?? 'Standard', // guitar_tuning (Supabase) -> guitarTuning (IndexedDB)
      structure: [], // IndexedDB only - not in Supabase
      lyrics: '', // IndexedDB only - not in Supabase (Supabase has lyrics_url instead)
      chords: [], // IndexedDB only - not in Supabase (Supabase has chords_url instead)
      referenceLinks: [], // IndexedDB only - not in Supabase
      tags: [], // IndexedDB only - not in Supabase
      notes: row.notes ?? '',
      createdDate: row.created_date ? new Date(row.created_date) : new Date(),
      lastPracticed: row.last_practiced
        ? new Date(row.last_practiced)
        : undefined,
      confidenceLevel: row.confidence_level ?? 1,
      contextType: row.context_type,
      contextId: row.context_id,
      createdBy: row.created_by,
      visibility: row.visibility ?? 'band', // Default to 'band' for MVP
      songGroupId: row.song_group_id,
      lastModifiedBy: row.last_modified_by ?? undefined,
    }
  }

  /**
   * Get songs modified since a given time (for incremental sync)
   * Uses updated_date field in Supabase
   */
  async getSongsSince(
    bandIds: string[],
    since: Date
  ): Promise<{ songs: Song[]; total: number }> {
    if (!supabase) throw new Error('Supabase client not initialized')
    if (bandIds.length === 0) return { songs: [], total: 0 }

    // Query both created_date and updated_date to catch:
    // - New records (updated_date may be NULL, but created_date is set)
    // - Updated records (updated_date is set)
    const sinceIso = since.toISOString()
    const { data, error, count } = await supabase
      .from('songs')
      .select('*', { count: 'exact' })
      .in('context_id', bandIds)
      .eq('context_type', 'band')
      .or(`created_date.gte.${sinceIso},updated_date.gte.${sinceIso}`)
      .order('created_date', { ascending: false })

    if (error) throw error

    return {
      songs: (data || []).map(row => this.mapSongFromSupabase(row)),
      total: count || 0,
    }
  }

  // ========== BANDS ==========

  async getBands(filter?: BandFilter): Promise<Band[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    let query = supabase.from('bands').select('*')

    if (filter?.name) {
      query = query.ilike('name', `%${filter.name}%`)
    }

    if (filter?.userId) {
      // Join with band_memberships to filter by user
      query = supabase
        .from('bands')
        .select('*, band_memberships!inner(user_id)')
        .eq('band_memberships.user_id', filter.userId)
    }

    const { data, error } = await query

    if (error) throw error

    return data.map(row => this.mapBandFromSupabase(row))
  }

  async getBand(id: string): Promise<Band | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('bands')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return this.mapBandFromSupabase(data)
  }

  async getBandsForUser(userId: string): Promise<Band[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('bands')
      .select('*, band_memberships!inner(user_id)')
      .eq('band_memberships.user_id', userId)

    if (error) throw error

    return data.map(row => this.mapBandFromSupabase(row))
  }

  async addBand(band: Band): Promise<Band> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('bands')
      .upsert(this.mapBandToSupabase(band) as any, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error

    return this.mapBandFromSupabase(data)
  }

  async updateBand(id: string, updates: Partial<Band>): Promise<Band> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('bands')
      // @ts-expect-error - Supabase generated types are overly strict, using Record<string, any> for field mapping
      .update(this.mapBandToSupabase(updates))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapBandFromSupabase(data)
  }

  async deleteBand(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase.from('bands').delete().eq('id', id)

    if (error) throw error
  }

  // ========== BAND FIELD MAPPING ==========

  private mapBandToSupabase(band: Partial<Band>): Record<string, any> {
    return {
      id: band.id,
      name: band.name,
      description: band.description,
      created_date: band.createdDate,
      updated_date: new Date(), // Supabase expects this
      settings: band.settings ?? {},
      // Note: memberIds not in Supabase (use band_memberships table)
    }
  }

  private mapBandFromSupabase(row: any): Band {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      createdDate: row.created_date ? new Date(row.created_date) : new Date(),
      settings: row.settings ?? {},
      memberIds: [], // Not in Supabase - use band_memberships table instead
    }
  }

  // ========== SETLISTS ==========

  async getSetlists(bandId: string): Promise<Setlist[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .eq('band_id', bandId)
      .order('created_date', { ascending: false })

    if (error) throw error

    return data.map(row => this.mapSetlistFromSupabase(row))
  }

  async getSetlist(id: string): Promise<Setlist | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return this.mapSetlistFromSupabase(data)
  }

  async addSetlist(setlist: Setlist): Promise<Setlist> {
    if (!supabase) throw new Error('Supabase client not initialized')

    // Get current user ID for created_by field (required in Supabase)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('setlists')
      .insert({
        ...this.mapSetlistToSupabase(setlist),
        created_by: userData.user.id,
      } as any)
      .select()
      .single()

    if (error) throw error

    return this.mapSetlistFromSupabase(data)
  }

  async updateSetlist(id: string, updates: Partial<Setlist>): Promise<Setlist> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('setlists')
      // @ts-expect-error - Supabase generated types are overly strict, using Record<string, any> for field mapping
      .update(this.mapSetlistToSupabase(updates))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapSetlistFromSupabase(data)
  }

  async deleteSetlist(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase.from('setlists').delete().eq('id', id)

    if (error) throw error
  }

  // ========== SETLIST FIELD MAPPING ==========

  private mapSetlistToSupabase(setlist: Partial<Setlist>): Record<string, any> {
    return {
      id: setlist.id,
      name: setlist.name,
      band_id: setlist.bandId,
      show_id: setlist.showId ?? null,
      source_setlist_id: setlist.sourceSetlistId ?? null,
      notes: setlist.notes,
      status: setlist.status,
      created_date: setlist.createdDate,
      last_modified: setlist.lastModified || new Date(),
      items: setlist.items || [], // Store items as JSONB in Supabase
      last_modified_by: setlist.lastModifiedBy ?? null,
    }
  }

  private mapSetlistFromSupabase(row: any): Setlist {
    return {
      id: row.id,
      name: row.name,
      bandId: row.band_id,
      showId: row.show_id ?? undefined,
      sourceSetlistId: row.source_setlist_id ?? undefined,
      showDate: undefined, // Not in Supabase
      venue: '', // Not in Supabase
      songs: row.items || [], // Map from items JSONB for backwards compatibility
      items: row.items || [], // Items stored as JSONB in Supabase
      totalDuration: 0, // Calculated client-side
      notes: row.notes ?? '',
      status: row.status ?? 'draft',
      createdDate: row.created_date ? new Date(row.created_date) : new Date(),
      lastModified: row.last_modified
        ? new Date(row.last_modified)
        : new Date(),
      lastModifiedBy: row.last_modified_by ?? undefined,
    }
  }

  /**
   * Get setlists modified since a given time (for incremental sync)
   * Uses last_modified field in Supabase
   */
  async getSetlistsSince(
    bandIds: string[],
    since: Date
  ): Promise<{ setlists: Setlist[]; total: number }> {
    if (!supabase) throw new Error('Supabase client not initialized')
    if (bandIds.length === 0) return { setlists: [], total: 0 }

    // Query both created_date and last_modified to catch:
    // - New records (last_modified may be NULL, but created_date is set)
    // - Updated records (last_modified is set)
    const sinceIso = since.toISOString()
    const { data, error, count } = await supabase
      .from('setlists')
      .select('*', { count: 'exact' })
      .in('band_id', bandIds)
      .or(`created_date.gte.${sinceIso},last_modified.gte.${sinceIso}`)
      .order('created_date', { ascending: false })

    if (error) throw error

    return {
      setlists: (data || []).map(row => this.mapSetlistFromSupabase(row)),
      total: count || 0,
    }
  }

  // ========== PRACTICE SESSIONS ==========

  async getPracticeSessions(bandId: string): Promise<PracticeSession[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('band_id', bandId)
      .order('scheduled_date', { ascending: false })

    if (error) throw error

    return data.map(row => this.mapPracticeSessionFromSupabase(row))
  }

  async getPracticeSession(id: string): Promise<PracticeSession | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return this.mapPracticeSessionFromSupabase(data)
  }

  async addPracticeSession(session: PracticeSession): Promise<PracticeSession> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('practice_sessions')
      .insert(this.mapPracticeSessionToSupabase(session) as any)
      .select()
      .single()

    if (error) throw error

    return this.mapPracticeSessionFromSupabase(data)
  }

  async updatePracticeSession(
    id: string,
    updates: Partial<PracticeSession>
  ): Promise<PracticeSession> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('practice_sessions')
      // @ts-expect-error - Supabase generated types are overly strict, using Record<string, any> for field mapping
      .update(this.mapPracticeSessionToSupabase(updates))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapPracticeSessionFromSupabase(data)
  }

  async deletePracticeSession(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase
      .from('practice_sessions')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // ========== PRACTICE SESSION FIELD MAPPING ==========

  private mapPracticeSessionToSupabase(
    session: Partial<PracticeSession>
  ): Record<string, any> {
    return {
      id: session.id,
      band_id: session.bandId,
      setlist_id: session.setlistId ?? null,
      scheduled_date: session.scheduledDate,
      duration: session.duration,
      location: session.location,
      type: session.type,
      notes: session.notes,
      wrapup_notes: session.wrapupNotes,
      objectives: session.objectives ?? [],
      completed_objectives: session.completedObjectives ?? [],
      songs: session.songs ?? [],
      attendees: session.attendees ?? [],
      last_modified_by: session.lastModifiedBy ?? null,
      // Note: status exists in IndexedDB only, not in Supabase
      // Note: Supabase has created_date but NOT updated_date
      // Note: Show-specific fields (name, venue, etc.) are now in the Show model
    }
  }

  private mapPracticeSessionFromSupabase(row: any): PracticeSession {
    return {
      id: row.id,
      bandId: row.band_id,
      setlistId: row.setlist_id ?? undefined,
      scheduledDate: row.scheduled_date
        ? new Date(row.scheduled_date)
        : new Date(),
      duration: row.duration ?? 0,
      location: row.location ?? '',
      type: row.type ?? 'rehearsal',
      status: 'scheduled', // Default status for IndexedDB (not in Supabase)
      notes: row.notes ?? '',
      wrapupNotes: row.wrapup_notes ?? '',
      objectives: row.objectives ?? [],
      completedObjectives: row.completed_objectives ?? [],
      songs: row.songs ?? [],
      attendees: row.attendees ?? [],
      createdDate: row.created_date ? new Date(row.created_date) : new Date(),
      lastModifiedBy: row.last_modified_by ?? undefined,
    }
  }

  /**
   * Get practice sessions created since a given time (for incremental sync)
   * Uses created_date field since practice_sessions doesn't have updated_date
   */
  async getPracticeSessionsSince(
    bandIds: string[],
    since: Date
  ): Promise<{ practiceSessions: PracticeSession[]; total: number }> {
    if (!supabase) throw new Error('Supabase client not initialized')
    if (bandIds.length === 0) return { practiceSessions: [], total: 0 }

    const { data, error, count } = await supabase
      .from('practice_sessions')
      .select('*', { count: 'exact' })
      .in('band_id', bandIds)
      .gte('created_date', since.toISOString())
      .order('created_date', { ascending: false })

    if (error) throw error

    return {
      practiceSessions: (data || []).map(row =>
        this.mapPracticeSessionFromSupabase(row)
      ),
      total: count || 0,
    }
  }

  // ========== SHOWS ==========

  async getShows(bandId: string): Promise<Show[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('band_id', bandId)
      .order('scheduled_date', { ascending: false })

    if (error) throw error

    return data.map(row => this.mapShowFromSupabase(row))
  }

  async getShow(id: string): Promise<Show | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return this.mapShowFromSupabase(data)
  }

  async addShow(show: Show): Promise<Show> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('shows')
      .insert(this.mapShowToSupabase(show) as any)
      .select()
      .single()

    if (error) throw error

    return this.mapShowFromSupabase(data)
  }

  async updateShow(id: string, updates: Partial<Show>): Promise<Show> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('shows')
      // @ts-expect-error - Supabase generated types are overly strict, using Record<string, any> for field mapping
      .update(this.mapShowToSupabase(updates))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapShowFromSupabase(data)
  }

  async deleteShow(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase.from('shows').delete().eq('id', id)

    if (error) throw error
  }

  // ========== SHOW FIELD MAPPING ==========

  private mapShowToSupabase(show: Partial<Show>): Record<string, any> {
    return {
      id: show.id,
      band_id: show.bandId,
      setlist_id: show.setlistId ?? null,
      name: show.name,
      scheduled_date: show.scheduledDate,
      duration: show.duration,
      venue: show.venue ?? null,
      location: show.location ?? null,
      load_in_time: show.loadInTime ?? null,
      soundcheck_time: show.soundcheckTime ?? null,
      payment: show.payment ?? null,
      contacts: show.contacts ?? null, // Supabase JSONB handles objects automatically
      status: show.status,
      notes: show.notes ?? null,
      created_date: show.createdDate,
      updated_date: show.updatedDate,
      last_modified_by: show.lastModifiedBy ?? null,
    }
  }

  private mapShowFromSupabase(row: any): Show {
    return {
      id: row.id,
      bandId: row.band_id,
      setlistId: row.setlist_id ?? undefined,
      name: row.name,
      scheduledDate: new Date(row.scheduled_date),
      duration: row.duration,
      venue: row.venue ?? undefined,
      location: row.location ?? undefined,
      loadInTime: row.load_in_time ?? undefined,
      soundcheckTime: row.soundcheck_time ?? undefined,
      payment: row.payment ?? undefined,
      contacts: row.contacts ?? undefined, // Supabase JSONB returns objects automatically
      status: row.status,
      notes: row.notes ?? undefined,
      createdDate: new Date(row.created_date),
      updatedDate: new Date(row.updated_date),
      lastModifiedBy: row.last_modified_by ?? undefined,
    }
  }

  /**
   * Get shows created or modified since a given time (for incremental sync)
   * Uses OR condition to catch both newly created shows (created_date) and
   * updated shows (updated_date) since new records may have NULL updated_date
   */
  async getShowsSince(
    bandIds: string[],
    since: Date
  ): Promise<{ shows: Show[]; total: number }> {
    if (!supabase) throw new Error('Supabase client not initialized')
    if (bandIds.length === 0) return { shows: [], total: 0 }

    const sinceIso = since.toISOString()
    const { data, error, count } = await supabase
      .from('shows')
      .select('*', { count: 'exact' })
      .in('band_id', bandIds)
      .or(`created_date.gte.${sinceIso},updated_date.gte.${sinceIso}`)
      .order('created_date', { ascending: false })

    if (error) throw error

    return {
      shows: (data || []).map(row => this.mapShowFromSupabase(row)),
      total: count || 0,
    }
  }

  // ========== BAND MEMBERSHIPS ==========

  async getBandMemberships(bandId: string): Promise<BandMembership[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('band_memberships')
      .select('*')
      .eq('band_id', bandId)

    if (error) throw error

    return data.map(row => this.mapBandMembershipFromSupabase(row))
  }

  async getUserMemberships(userId: string): Promise<BandMembership[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    console.log(
      '[RemoteRepository.getUserMemberships] Querying for userId:',
      userId
    )
    const { data, error } = await supabase
      .from('band_memberships')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('[RemoteRepository.getUserMemberships] Error:', error)
      throw error
    }

    console.log(
      '[RemoteRepository.getUserMemberships] Found memberships:',
      data?.length || 0
    )
    if (data && data.length > 0) {
      console.log('[RemoteRepository.getUserMemberships] Memberships:', data)
    }

    return data.map(row => this.mapBandMembershipFromSupabase(row))
  }

  async addBandMembership(membership: BandMembership): Promise<BandMembership> {
    if (!supabase) throw new Error('Supabase client not initialized')

    // Removed: console.log with user/band IDs (security)

    const mapped = this.mapBandMembershipToSupabase(membership) as any
    // Removed: console.log with membership data (security)

    const { data, error } = await supabase
      .from('band_memberships')
      .upsert(mapped, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error('[RemoteRepository.addBandMembership] Error:', error)
      throw error
    }

    // Removed: console.log with membership data (security)
    return this.mapBandMembershipFromSupabase(data)
  }

  async updateBandMembership(
    id: string,
    updates: Partial<BandMembership>
  ): Promise<BandMembership> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('band_memberships')
      // @ts-expect-error - Supabase generated types are overly strict, using Record<string, any> for field mapping
      .update(this.mapBandMembershipToSupabase(updates))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapBandMembershipFromSupabase(data)
  }

  async deleteBandMembership(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase
      .from('band_memberships')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // ========== INVITE CODES ==========

  async getInviteCodes(bandId: string): Promise<InviteCode[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('band_id', bandId)
      .eq('is_active', true)

    if (error) throw error

    return data.map(row => this.mapInviteCodeFromSupabase(row))
  }

  async getInviteCode(id: string): Promise<InviteCode | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return this.mapInviteCodeFromSupabase(data)
  }

  async getInviteCodeByCode(code: string): Promise<InviteCode | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const upperCode = code.toUpperCase()
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', upperCode)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return this.mapInviteCodeFromSupabase(data)
  }

  async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const supabaseData = this.mapInviteCodeToSupabase(inviteCode)

    const { data, error } = await supabase
      .from('invite_codes')
      .insert(supabaseData as any)
      .select()
      .single()

    if (error) throw error

    return this.mapInviteCodeFromSupabase(data)
  }

  async updateInviteCode(
    id: string,
    updates: Partial<InviteCode>
  ): Promise<InviteCode> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('invite_codes')
      // @ts-expect-error - invite_codes table exists but not in generated Supabase types yet
      .update(this.mapInviteCodeToSupabase(updates))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapInviteCodeFromSupabase(data)
  }

  async deleteInviteCode(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase.from('invite_codes').delete().eq('id', id)

    if (error) throw error
  }

  /**
   * Increment invite code usage count using Postgres function
   * This bypasses RLS restrictions and allows non-admins to increment usage when joining
   */
  async incrementInviteCodeUsage(id: string): Promise<InviteCode> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase.rpc('increment_invite_code_usage', {
      p_invite_code_id: id,
    } as any)

    if (error) throw error
    if (!data)
      throw new Error(`Failed to increment invite code usage for ${id}`)

    return this.mapInviteCodeFromSupabase(data)
  }

  // ========== USER OPERATIONS ==========

  /**
   * Update the current user's last_active_at timestamp
   * This is used for multi-device sync optimization
   */
  async updateUserActivity(): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase.rpc('update_user_activity')

    if (error) {
      console.error('[RemoteRepository.updateUserActivity] Error:', error)
      throw error
    }
  }

  /**
   * Get the last active timestamp for a user
   * Returns undefined if never active or column doesn't exist
   */
  async getUserLastActiveAt(userId: string): Promise<Date | undefined> {
    if (!supabase) throw new Error('Supabase client not initialized')

    // Select last_active_at column (added via migration, not in generated types)
    const { data, error } = await supabase
      .from('users')
      .select('last_active_at')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return undefined // Not found
      throw error
    }

    // Cast to any since last_active_at isn't in the generated Supabase types
    const row = data as any
    return row?.last_active_at ? new Date(row.last_active_at) : undefined
  }

  async getUser(id: string): Promise<User | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return this.mapUserFromSupabase(data)
  }

  // ========== USER FIELD MAPPING ==========

  private mapUserFromSupabase(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdDate: row.created_date ? new Date(row.created_date) : new Date(),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      authProvider: row.auth_provider ?? 'email',
    }
  }

  // ========== BAND MEMBERSHIP FIELD MAPPING ==========

  private mapBandMembershipToSupabase(
    membership: Partial<BandMembership>
  ): Record<string, any> {
    return {
      id: membership.id,
      user_id: membership.userId,
      band_id: membership.bandId,
      role: membership.role,
      permissions: membership.permissions ?? [],
      joined_date: membership.joinedDate,
      status: membership.status,
      // Note: nickname, customRole exist in IndexedDB only
      // Note: Supabase has NO updated_date field
    }
  }

  private mapBandMembershipFromSupabase(row: any): BandMembership {
    return {
      id: row.id,
      userId: row.user_id,
      bandId: row.band_id,
      role: row.role ?? 'member',
      permissions: row.permissions ?? [],
      joinedDate: row.joined_date ? new Date(row.joined_date) : new Date(),
      status: row.status ?? 'active',
      // Note: nickname, customRole not in Supabase
    }
  }

  // ========== INVITE CODE FIELD MAPPING ==========

  private mapInviteCodeToSupabase(
    inviteCode: Partial<InviteCode>
  ): Record<string, any> {
    const result: Record<string, any> = {}

    if (inviteCode.id !== undefined) result.id = inviteCode.id
    if (inviteCode.bandId !== undefined) result.band_id = inviteCode.bandId
    if (inviteCode.code !== undefined) result.code = inviteCode.code
    if (inviteCode.createdBy !== undefined)
      result.created_by = inviteCode.createdBy
    if (inviteCode.createdDate !== undefined)
      result.created_date = inviteCode.createdDate
    if (inviteCode.expiresAt !== undefined)
      result.expires_at = inviteCode.expiresAt
    if (inviteCode.maxUses !== undefined) result.max_uses = inviteCode.maxUses
    if (inviteCode.currentUses !== undefined)
      result.current_uses = inviteCode.currentUses
    if (inviteCode.isActive !== undefined)
      result.is_active = inviteCode.isActive

    return result
  }

  private mapInviteCodeFromSupabase(row: any): InviteCode {
    return {
      id: row.id,
      bandId: row.band_id,
      code: row.code,
      createdBy: row.created_by,
      createdDate: new Date(row.created_date),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      maxUses: row.max_uses,
      currentUses: row.current_uses,
      isActive: row.is_active,
    }
  }

  // ========== SONG PERSONAL NOTES ==========

  async getPersonalNote(
    songId: string,
    userId: string,
    bandId: string
  ): Promise<SongPersonalNote | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('song_personal_notes')
      .select('*')
      .eq('song_id', songId)
      .eq('user_id', userId)
      .eq('band_id', bandId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return this.mapPersonalNoteFromSupabase(data)
  }

  async getPersonalNotesForUser(
    userId: string,
    bandId: string
  ): Promise<SongPersonalNote[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('song_personal_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('band_id', bandId)

    if (error) throw error

    return data.map(row => this.mapPersonalNoteFromSupabase(row))
  }

  async createPersonalNote(
    input: SongPersonalNoteInput
  ): Promise<SongPersonalNote> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await (supabase.from('song_personal_notes') as any)
      .insert({
        song_id: input.songId,
        user_id: input.userId,
        band_id: input.bandId,
        content: input.content,
      })
      .select()
      .single()

    if (error) throw error

    return this.mapPersonalNoteFromSupabase(data)
  }

  async updatePersonalNote(
    id: string,
    updates: SongPersonalNoteUpdate
  ): Promise<SongPersonalNote> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const updateData: any = {}
    if (updates.content !== undefined) updateData.content = updates.content

    const { data, error } = await (supabase.from('song_personal_notes') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapPersonalNoteFromSupabase(data)
  }

  async deletePersonalNote(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase
      .from('song_personal_notes')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async upsertPersonalNote(
    input: SongPersonalNoteInput
  ): Promise<SongPersonalNote> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await (supabase.from('song_personal_notes') as any)
      .upsert(
        {
          song_id: input.songId,
          user_id: input.userId,
          band_id: input.bandId,
          content: input.content,
        },
        {
          onConflict: 'song_id,user_id,band_id',
        }
      )
      .select()
      .single()

    if (error) throw error

    return this.mapPersonalNoteFromSupabase(data)
  }

  private mapPersonalNoteFromSupabase(row: any): SongPersonalNote {
    return {
      id: row.id,
      songId: row.song_id,
      userId: row.user_id,
      bandId: row.band_id,
      content: row.content,
      createdDate: new Date(row.created_date),
      updatedDate: new Date(row.updated_date),
      version: row.version,
    }
  }

  // ========== SONG NOTE ENTRIES ==========

  async getNoteEntriesForSong(
    songId: string,
    bandId: string
  ): Promise<SongNoteEntry[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('song_note_entries')
      .select('*')
      .eq('song_id', songId)
      .eq('band_id', bandId)
      .order('created_date', { ascending: false })

    if (error) throw error

    return data.map(row => this.mapNoteEntryFromSupabase(row))
  }

  async getNoteEntriesForSession(
    sessionType: 'practice' | 'show',
    sessionId: string
  ): Promise<SongNoteEntry[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('song_note_entries')
      .select('*')
      .eq('session_type', sessionType)
      .eq('session_id', sessionId)

    if (error) throw error

    return data.map(row => this.mapNoteEntryFromSupabase(row))
  }

  async getNoteEntry(id: string): Promise<SongNoteEntry | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('song_note_entries')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return this.mapNoteEntryFromSupabase(data)
  }

  async createNoteEntry(input: SongNoteEntryInput): Promise<SongNoteEntry> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await (supabase.from('song_note_entries') as any)
      .insert({
        song_id: input.songId,
        user_id: input.userId,
        band_id: input.bandId,
        session_type: input.sessionType,
        session_id: input.sessionId,
        content: input.content,
        visibility: input.visibility,
      })
      .select()
      .single()

    if (error) throw error

    return this.mapNoteEntryFromSupabase(data)
  }

  async updateNoteEntry(
    id: string,
    updates: SongNoteEntryUpdate
  ): Promise<SongNoteEntry> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const updateData: any = {}
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.visibility !== undefined)
      updateData.visibility = updates.visibility

    const { data, error } = await (supabase.from('song_note_entries') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapNoteEntryFromSupabase(data)
  }

  async deleteNoteEntry(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase
      .from('song_note_entries')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  private mapNoteEntryFromSupabase(row: any): SongNoteEntry {
    return {
      id: row.id,
      songId: row.song_id,
      userId: row.user_id,
      bandId: row.band_id,
      sessionType: row.session_type,
      sessionId: row.session_id,
      content: row.content,
      visibility: row.visibility,
      createdDate: new Date(row.created_date),
      updatedDate: row.updated_date ? new Date(row.updated_date) : null,
      version: row.version,
    }
  }

  // ========== SYNC OPERATIONS ==========
  // These are no-op implementations since RemoteRepository doesn't handle sync orchestration
  // Sync is handled by SyncRepository/SyncEngine

  setCurrentUser(_userId: string): void {
    // No-op: RemoteRepository doesn't handle sync orchestration
  }

  async isInitialSyncNeeded(): Promise<boolean> {
    // No-op: RemoteRepository doesn't handle sync orchestration
    return false
  }

  async performInitialSync(_userId: string): Promise<void> {
    // No-op: RemoteRepository doesn't handle sync orchestration
  }

  async pullFromRemote(_userId: string): Promise<void> {
    // No-op: RemoteRepository doesn't handle sync orchestration
  }

  async pullIncrementalChanges(
    _userId: string
  ): Promise<IncrementalSyncResult> {
    // No-op: RemoteRepository doesn't handle sync orchestration
    return createEmptyIncrementalSyncResult()
  }
}
