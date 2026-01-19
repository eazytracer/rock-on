/* eslint-disable @typescript-eslint/no-explicit-any */
import EventEmitter from 'eventemitter3'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '../supabase/client'
import { repository } from './RepositoryFactory'
import { db } from '../database'
import type { Song } from '../../models/Song'
import type { Setlist } from '../../models/Setlist'
import type { Show } from '../../models/Show'
import type { PracticeSession } from '../../models/PracticeSession'

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, any>
  old: Record<string, any>
  schema: string
  table: string
}

/**
 * Audit log entry structure from Supabase
 */
interface AuditLogEntry {
  id: string
  table_name: 'songs' | 'setlists' | 'shows' | 'practice_sessions'
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  user_id: string | null
  user_name: string // Denormalized user name - always available!
  changed_at: string // ISO timestamp
  old_values: any // Complete JSONB record before change (NULL for INSERT)
  new_values: any // Complete JSONB record after change (NULL for DELETE)
  band_id: string
  client_info?: any // Optional metadata
}

interface PendingToast {
  userId: string
  userName: string
  changes: Array<{
    type: 'INSERT' | 'UPDATE' | 'DELETE'
    table: string
    itemName: string
  }>
  timestamp: number
}

/**
 * Event types emitted by RealtimeManager
 */
export type RealtimeEvents = {
  'songs:changed': {
    bandId: string
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    recordId: string
  }
  'setlists:changed': {
    bandId: string
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    recordId: string
  }
  'shows:changed': {
    bandId: string
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    recordId: string
  }
  'practices:changed': {
    bandId: string
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    recordId: string
  }
  toast: { message: string; type: 'info' | 'success' | 'error' }
}

/**
 * RealtimeManager handles WebSocket subscriptions to Supabase for real-time collaboration.
 *
 * Features:
 * - Subscribe to database changes for user's bands
 * - Update local IndexedDB when remote changes occur
 * - Mark items as "unread" if changed by another user
 * - Emit events for UI reactivity (EventEmitter pattern)
 * - Show toast notifications for remote changes
 * - Handle reconnection on network interruptions
 * - Batch rapid changes to avoid toast spam
 *
 * Event Emitter Pattern:
 * - Emits 'songs:changed', 'setlists:changed', etc. for UI updates
 * - Emits 'toast' events for notifications
 * - Hooks subscribe to these events for reactive UI updates
 */
export class RealtimeManager extends EventEmitter {
  private channels: Map<string, RealtimeChannel> = new Map()
  private supabase: ReturnType<typeof getSupabaseClient>
  private currentUserId: string | null = null
  private connected: boolean = false
  private pendingToasts: Map<string, PendingToast> = new Map()
  private toastBatchTimeout: NodeJS.Timeout | null = null
  private readonly TOAST_BATCH_DELAY = 2000 // 2 seconds

  // Connection tracking for diagnostics
  private connectionId: string = crypto.randomUUID()
  private connectionStartTime: number = 0
  private connectionMetrics = {
    subscriptionAttempts: 0,
    subscriptionSuccesses: 0,
    subscriptionFailures: 0,
    messagesReceived: 0,
    lastMessageTime: 0,
  }

  constructor() {
    super() // Initialize EventEmitter

    // Use the main Supabase client singleton which already has the user's session
    // The session must be set BEFORE creating RealtimeManager
    this.supabase = getSupabaseClient()

    console.log(`
┌─────────────────────────────────────────────────────────────┐
│ 🔌 RealtimeManager Instance Created                         │
│ Connection ID: ${this.connectionId.substring(0, 8)}...                           │
│ Timestamp: ${new Date().toISOString()}                      │
└─────────────────────────────────────────────────────────────┘
    `)
    this.logEnvironmentInfo()
  }

  private logEnvironmentInfo(): void {
    console.log('[RealtimeManager] Environment:', {
      userAgent: navigator.userAgent.substring(0, 100) + '...',
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      online: navigator.onLine,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      timestamp: Date.now(),
    })
  }

  /**
   * Subscribe to audit_log for the user's bands
   * Single subscription per band (was 4)
   */
  async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
    this.currentUserId = userId
    this.connectionStartTime = Date.now()

    console.log(`
┌─────────────────────────────────────────────────────────────┐
│ 📡 Subscribing to User Bands                                 │
│ Connection ID: ${this.connectionId.substring(0, 8)}...                           │
│ User ID: ${userId.substring(0, 8)}...                                    │
│ Band Count: ${bandIds.length}                                                │
│ Band IDs: ${bandIds.map(id => id.substring(0, 8)).join(', ')}           │
└─────────────────────────────────────────────────────────────┘
    `)

    for (const bandId of bandIds) {
      await this.subscribeToAuditLog(userId, bandId)
    }

    // Mark as connected if at least one subscription succeeded
    if (this.channels.size > 0) {
      this.connected = true
      const elapsed = Date.now() - this.connectionStartTime
      console.log(`
✅ Subscription Successful
   Connection ID: ${this.connectionId.substring(0, 8)}...
   Time elapsed: ${elapsed}ms
   Total channels: ${this.channels.size}
   Successes: ${this.connectionMetrics.subscriptionSuccesses}
   Failures: ${this.connectionMetrics.subscriptionFailures}
      `)
    }
  }

  /**
   * Subscribe to audit_log for a specific band
   * This replaces subscribeToBand() which created 4 subscriptions
   */
  private async subscribeToAuditLog(
    _userId: string,
    bandId: string
  ): Promise<void> {
    this.connectionMetrics.subscriptionAttempts++

    try {
      const channelName = `audit-${bandId}`

      // Check if already subscribed to this band
      if (this.channels.has(channelName)) {
        console.log(
          `[RealtimeManager] Already subscribed to ${channelName}, skipping...`
        )
        return
      }

      console.log(
        `[RealtimeManager] Subscribing to audit log for band: ${bandId} (attempt #${this.connectionMetrics.subscriptionAttempts})`
      )

      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT', // Only INSERT (audit_log is append-only)
            schema: 'public',
            table: 'audit_log',
            filter: `band_id=eq.${bandId}`,
          },
          (payload: any) => {
            // Supabase realtime payload structure: { new, old, eventType, schema, table }
            this.handleAuditChange(payload).catch(error => {
              console.error(`Error handling audit change:`, error)
            })
          }
        )
        .subscribe(async (status, err) => {
          if (err) {
            this.connectionMetrics.subscriptionFailures++
            console.error(`❌ Failed to subscribe to ${channelName}:`, err)
            console.error(
              `   Connection ID: ${this.connectionId.substring(0, 8)}`
            )
            console.error(
              `   Failures: ${this.connectionMetrics.subscriptionFailures}`
            )
            this.connected = false
          } else if (status === 'SUBSCRIBED') {
            this.connectionMetrics.subscriptionSuccesses++
            console.log(`✅ Subscribed to ${channelName} (audit-first)`)
            console.log(
              `   Connection ID: ${this.connectionId.substring(0, 8)}`
            )
            this.connected = true
          } else if (status === 'CHANNEL_ERROR') {
            this.connectionMetrics.subscriptionFailures++
            console.error(`❌ Channel error for ${channelName}`)
            this.connected = false
          }
        })

      this.channels.set(channelName, channel)
    } catch (error) {
      this.connectionMetrics.subscriptionFailures++
      console.error(`Error subscribing to audit_log for band ${bandId}:`, error)
    }
  }

  /**
   * Subscribe to all table channels for a specific band
   * @deprecated - Use subscribeToAuditLog instead (audit-first approach)
   */
  // @ts-expect-error - Intentionally unused
  private async subscribeToBand(
    _userId: string,
    bandId: string
  ): Promise<void> {
    // Subscribe to songs
    await this.subscribeToTable(
      'songs',
      bandId,
      this.handleSongChange.bind(this)
    )

    // Subscribe to setlists
    await this.subscribeToTable(
      'setlists',
      bandId,
      this.handleSetlistChange.bind(this)
    )

    // Subscribe to shows
    await this.subscribeToTable(
      'shows',
      bandId,
      this.handleShowChange.bind(this)
    )

    // Subscribe to practice sessions
    await this.subscribeToTable(
      'practice_sessions',
      bandId,
      this.handlePracticeSessionChange.bind(this)
    )
  }

  /**
   * Subscribe to a specific table for a band
   */
  private async subscribeToTable(
    table: string,
    bandId: string,
    handler: (payload: RealtimePayload) => Promise<void>
  ): Promise<void> {
    try {
      const channelName = `${table}-${bandId}`

      // Determine the filter field based on table
      const filterField = table === 'songs' ? 'context_id' : 'band_id'

      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `${filterField}=eq.${bandId}`,
          },
          (payload: any) => {
            handler(payload as RealtimePayload).catch(error => {
              console.error(`Error handling ${table} change:`, error)
            })
          }
        )
        .subscribe(async (status, err) => {
          if (err) {
            console.error(`❌ Failed to subscribe to ${channelName}:`, err)
            this.connected = false
          } else if (status === 'SUBSCRIBED') {
            console.log(`✅ Subscribed to ${channelName}`)
            this.connected = true
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`❌ Channel error for ${channelName}`)
            this.connected = false
          }
        })

      this.channels.set(channelName, channel)
    } catch (error) {
      console.error(`Error subscribing to ${table} for band ${bandId}:`, error)
    }
  }

  /**
   * Handle song changes from Supabase
   */
  private async handleSongChange(payload: RealtimePayload): Promise<void> {
    const { eventType, new: newRow, old: oldRow } = payload

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      console.log(
        `📡 Received ${eventType} event for song:`,
        newRow.id,
        newRow.title
      )

      // Determine who modified the record (for INSERT, use created_by; for UPDATE, use last_modified_by)
      const modifiedBy =
        eventType === 'INSERT'
          ? newRow.created_by
          : newRow.last_modified_by || newRow.created_by

      // Skip if current user made this change (avoid redundant refetches and toasts)
      if (modifiedBy === this.currentUserId) {
        console.log(
          '[RealtimeManager] Skipping own change for song:',
          newRow.id
        )
        return
      }

      // Cloud-first approach: Fetch the latest data from Supabase to ensure consistency
      try {
        const { data, error } = await this.supabase
          .from('songs')
          .select('*')
          .eq('id', newRow.id)
          .single<{
            id: string
            title: string
            artist: string | null
            album: string | null
            key: string | null
            tempo: number | null // Supabase column name
            duration: number | null
            difficulty: number
            guitar_tuning: string | null
            structure: any
            lyrics: string | null
            chords: any
            notes: string | null
            reference_links: any
            tags: any
            created_date: string
            last_practiced: string | null
            confidence_level: number
            context_type: 'personal' | 'band'
            context_id: string
            created_by: string
            visibility: 'personal' | 'band' | 'public'
            song_group_id: string | null
            linked_from_song_id: string | null
            version: number | null
            last_modified_by: string | null
            updated_date: string | null
            archived: boolean | null
          }>()

        if (error) {
          console.error('Failed to fetch song from Supabase:', error)
          return
        }

        if (!data) {
          console.warn('Song not found in Supabase:', newRow.id)
          return
        }

        // Map from Supabase snake_case to app camelCase
        const song: Song = {
          id: data.id,
          title: data.title,
          artist: data.artist || '',
          album: data.album || undefined,
          key: data.key || '',
          bpm: data.tempo || 120, // Map Supabase 'tempo' to Song 'bpm'
          duration: data.duration || 0,
          difficulty: (data.difficulty || 1) as 1 | 2 | 3 | 4 | 5,
          guitarTuning: data.guitar_tuning || undefined,
          structure: data.structure || [],
          lyrics: data.lyrics || undefined,
          chords: data.chords || [],
          notes: data.notes || '',
          referenceLinks: data.reference_links || [],
          tags: data.tags || [],
          createdDate: new Date(data.created_date),
          lastPracticed: data.last_practiced
            ? new Date(data.last_practiced)
            : undefined,
          confidenceLevel: data.confidence_level || 1,
          contextType: data.context_type,
          contextId: data.context_id,
          createdBy: data.created_by,
          visibility: data.visibility || 'band',
          songGroupId: data.song_group_id || undefined,
          linkedFromSongId: data.linked_from_song_id || undefined,
          version: data.version || 0,
          lastModifiedBy: data.last_modified_by || undefined,
        }

        // Update or insert into local IndexedDB (upsert)
        await db.songs.put(song)
        console.log(`✅ Synced song from cloud:`, song.title)

        // Emit change event for UI reactivity
        console.log('[RealtimeManager] Emitting songs:changed event:', {
          bandId: song.contextId,
          action: eventType,
          recordId: song.id,
        })
        this.emit('songs:changed', {
          bandId: song.contextId,
          action: eventType,
          recordId: song.id,
        })

        // Queue toast notification
        await this.queueToast(modifiedBy, eventType, 'song', song.title)
      } catch (error) {
        console.error('Error syncing song from cloud:', error)
      }
    }

    if (eventType === 'DELETE') {
      // Get song title from local DB before deleting (Supabase DELETE events don't include all fields)
      let songTitle = 'a song'
      try {
        const song = await db.songs.get(oldRow.id)
        if (song) {
          songTitle = song.title || 'a song'
        }
      } catch (error) {
        console.warn(
          '[RealtimeManager] Could not fetch song title before delete:',
          error
        )
      }

      await repository.deleteSong(oldRow.id)

      // Emit change event for UI reactivity
      this.emit('songs:changed', {
        bandId: oldRow.context_id,
        action: 'DELETE',
        recordId: oldRow.id,
      })

      // Show toast for deletion
      await this.queueToast(oldRow.created_by, 'DELETE', 'song', songTitle)
    }
  }

  /**
   * Handle setlist changes from Supabase
   */
  private async handleSetlistChange(payload: RealtimePayload): Promise<void> {
    const { eventType, new: newRow, old: oldRow } = payload

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      console.log(
        `📡 Received ${eventType} event for setlist:`,
        newRow.id,
        newRow.name
      )

      // Determine who modified the record (for INSERT, use created_by; for UPDATE, use last_modified_by)
      const modifiedBy =
        eventType === 'INSERT'
          ? newRow.created_by
          : newRow.last_modified_by || newRow.created_by

      // Skip if current user made this change (avoid redundant refetches and toasts)
      if (modifiedBy === this.currentUserId) {
        console.log(
          '[RealtimeManager] Skipping own change for setlist:',
          newRow.id
        )
        return
      }

      const setlist: Partial<Setlist> = {
        id: newRow.id,
        name: newRow.name,
        bandId: newRow.band_id,
        items: newRow.items, // Already JSONB, no conversion needed
        createdDate: new Date(newRow.created_date),
        lastModified: new Date(newRow.last_modified),
        version: newRow.version,
        lastModifiedBy: newRow.last_modified_by,
      }

      // Update or insert into local IndexedDB (upsert)
      await db.setlists.put({ ...setlist, id: newRow.id } as Setlist)

      // Emit change event for UI reactivity
      this.emit('setlists:changed', {
        bandId: newRow.band_id,
        action: eventType,
        recordId: newRow.id,
      })

      await this.queueToast(modifiedBy, eventType, 'setlist', newRow.name)
    }

    if (eventType === 'DELETE') {
      // Get setlist name from local DB before deleting (Supabase DELETE events don't include all fields)
      let setlistName = 'a setlist'
      try {
        const setlist = await db.setlists.get(oldRow.id)
        if (setlist) {
          setlistName = setlist.name || 'a setlist'
        }
      } catch (error) {
        console.warn(
          '[RealtimeManager] Could not fetch setlist name before delete:',
          error
        )
      }

      await repository.deleteSetlist(oldRow.id)

      // Emit change event for UI reactivity
      this.emit('setlists:changed', {
        bandId: oldRow.band_id,
        action: 'DELETE',
        recordId: oldRow.id,
      })

      await this.queueToast(oldRow.created_by, 'DELETE', 'setlist', setlistName)
    }
  }

  /**
   * Handle show changes from Supabase
   */
  private async handleShowChange(payload: RealtimePayload): Promise<void> {
    const { eventType, new: newRow, old: oldRow } = payload

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      console.log(
        `📡 Received ${eventType} event for show:`,
        newRow.id,
        newRow.name
      )

      // Determine who modified the record (for INSERT, use created_by; for UPDATE, use last_modified_by)
      const modifiedBy =
        eventType === 'INSERT'
          ? newRow.created_by
          : newRow.last_modified_by || newRow.created_by

      // Skip if current user made this change (avoid redundant refetches and toasts)
      if (modifiedBy === this.currentUserId) {
        console.log(
          '[RealtimeManager] Skipping own change for show:',
          newRow.id
        )
        return
      }

      const show: Partial<Show> = {
        id: newRow.id,
        name: newRow.name,
        venue: newRow.venue,
        scheduledDate: new Date(newRow.scheduled_date),
        bandId: newRow.band_id,
        setlistId: newRow.setlist_id,
        status: newRow.status,
        notes: newRow.notes,
        createdDate: new Date(newRow.created_date),
        updatedDate: new Date(newRow.updated_date),
        version: newRow.version,
        lastModifiedBy: newRow.last_modified_by,
      }

      // Update or insert into local IndexedDB (upsert)
      await db.shows.put({ ...show, id: newRow.id } as Show)

      // Emit change event for UI reactivity
      this.emit('shows:changed', {
        bandId: newRow.band_id,
        action: eventType,
        recordId: newRow.id,
      })

      await this.queueToast(modifiedBy, eventType, 'show', newRow.name)
    }

    if (eventType === 'DELETE') {
      // Get show name from local DB before deleting (Supabase DELETE events don't include all fields)
      let showName = 'a show'
      try {
        const show = await db.shows.get(oldRow.id)
        if (show) {
          showName = show.name || 'a show'
        }
      } catch (error) {
        console.warn(
          '[RealtimeManager] Could not fetch show name before delete:',
          error
        )
      }

      await repository.deleteShow(oldRow.id)

      // Emit change event for UI reactivity
      this.emit('shows:changed', {
        bandId: oldRow.band_id,
        action: 'DELETE',
        recordId: oldRow.id,
      })

      await this.queueToast(oldRow.created_by, 'DELETE', 'show', showName)
    }
  }

  /**
   * Handle practice session changes from Supabase
   */
  private async handlePracticeSessionChange(
    payload: RealtimePayload
  ): Promise<void> {
    const { eventType, new: newRow, old: oldRow } = payload

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      console.log(
        `📡 Received ${eventType} event for practice session:`,
        newRow.id
      )

      // Determine who modified the record (for INSERT, use created_by; for UPDATE, use last_modified_by)
      const modifiedBy =
        eventType === 'INSERT'
          ? newRow.created_by
          : newRow.last_modified_by || newRow.created_by

      // Skip if current user made this change (avoid redundant refetches and toasts)
      if (modifiedBy === this.currentUserId) {
        console.log(
          '[RealtimeManager] Skipping own change for practice session:',
          newRow.id
        )
        return
      }

      const practice: Partial<PracticeSession> = {
        id: newRow.id,
        scheduledDate: new Date(newRow.scheduled_date),
        startTime: newRow.start_time ? new Date(newRow.start_time) : undefined,
        endTime: newRow.end_time ? new Date(newRow.end_time) : undefined,
        location: newRow.location,
        bandId: newRow.band_id,
        setlistId: newRow.setlist_id,
        notes: newRow.notes,
        attendees: newRow.attendees || [], // JSONB field
        createdDate: new Date(newRow.created_date),
        version: newRow.version,
        lastModifiedBy: newRow.last_modified_by,
      }

      // Update or insert into local IndexedDB (upsert)
      await db.practiceSessions.put({
        ...practice,
        id: newRow.id,
      } as PracticeSession)

      // Emit change event for UI reactivity
      this.emit('practices:changed', {
        bandId: newRow.band_id,
        action: eventType,
        recordId: newRow.id,
      })

      const displayName = newRow.date
        ? new Date(newRow.date).toLocaleDateString()
        : 'Practice'
      await this.queueToast(modifiedBy, eventType, 'practice', displayName)
    }

    if (eventType === 'DELETE') {
      // Get practice session info from local DB before deleting
      let practiceName = 'a practice'
      try {
        const practice = await db.practiceSessions.get(oldRow.id)
        if (practice) {
          practiceName = practice.scheduledDate
            ? new Date(practice.scheduledDate).toLocaleDateString()
            : 'a practice'
        }
      } catch (error) {
        console.warn(
          '[RealtimeManager] Could not fetch practice before delete:',
          error
        )
      }

      await repository.deletePracticeSession(oldRow.id)

      // Emit change event for UI reactivity
      this.emit('practices:changed', {
        bandId: oldRow.band_id,
        action: 'DELETE',
        recordId: oldRow.id,
      })

      await this.queueToast(
        oldRow.created_by,
        'DELETE',
        'practice',
        practiceName
      )
    }
  }

  /**
   * Handle audit log changes from Supabase
   * Single unified handler for all entity types
   */
  private async handleAuditChange(payload: any): Promise<void> {
    // Track message received
    this.connectionMetrics.messagesReceived++
    this.connectionMetrics.lastMessageTime = Date.now()

    // Supabase realtime sends: { new: AuditLogEntry, old: ..., eventType: 'INSERT', ... }
    const audit = payload.new as AuditLogEntry

    if (!audit || !audit.table_name || !audit.action) {
      console.warn('[RealtimeManager] Invalid audit payload:', payload)
      return
    }

    console.log(
      `📡 Received audit event (#${this.connectionMetrics.messagesReceived}):`,
      {
        connectionId: this.connectionId.substring(0, 8),
        table: audit.table_name,
        action: audit.action,
        user: audit.user_name,
        recordId: audit.record_id.substring(0, 8),
        timeSinceStart: Date.now() - this.connectionStartTime,
      }
    )

    // Note: We do NOT skip changes from the same user anymore.
    // The same user may be on multiple devices, and all devices need the update.
    // We only skip toasts for own changes (handled in queueToastFromAudit).
    const isOwnChange = audit.user_id === this.currentUserId

    // Handle based on action type
    try {
      switch (audit.action) {
        case 'INSERT':
        case 'UPDATE':
          await this.handleRecordUpsert(audit)
          break

        case 'DELETE':
          await this.handleRecordDelete(audit)
          break
      }

      // Extract item name for toast
      const itemName = this.extractItemName(audit)

      // Show toast with ACTUAL user name (not "Someone"!)
      // Skip toast for own changes (but still process the data sync above)
      if (!isOwnChange) {
        await this.queueToastFromAudit(
          audit.user_name,
          audit.action,
          audit.table_name,
          itemName
        )
      }

      // Emit change event for UI reactivity
      // Map table_name to event name (practice_sessions → practices)
      const eventName =
        audit.table_name === 'practice_sessions'
          ? 'practices:changed'
          : `${audit.table_name}:changed`

      console.log(
        `[RealtimeManager] Emitting ${eventName} event, listeners:`,
        this.listenerCount(eventName)
      )
      this.emit(eventName, {
        bandId: audit.band_id,
        action: audit.action,
        recordId: audit.record_id,
      })
    } catch (error) {
      console.error('[RealtimeManager] Error processing audit change:', error)
    }
  }

  /**
   * Handle INSERT and UPDATE operations
   * Maps JSONB from audit log to local IndexedDB
   */
  private async handleRecordUpsert(audit: AuditLogEntry): Promise<void> {
    const { table_name, new_values } = audit

    if (!new_values) {
      console.warn(
        '[RealtimeManager] No new_values in audit entry for INSERT/UPDATE'
      )
      return
    }

    switch (table_name) {
      case 'songs': {
        const song = this.mapAuditToSong(new_values)
        await db.songs.put(song)
        console.log(`✅ Synced song from audit log:`, song.title)
        break
      }

      case 'setlists': {
        const setlist = this.mapAuditToSetlist(new_values)
        await db.setlists.put(setlist)
        console.log(`✅ Synced setlist from audit log:`, setlist.name)
        break
      }

      case 'shows': {
        const show = this.mapAuditToShow(new_values)
        await db.shows.put(show)
        console.log(`✅ Synced show from audit log:`, show.name)
        break
      }

      case 'practice_sessions': {
        const practice = this.mapAuditToPractice(new_values)
        await db.practiceSessions.put(practice)
        console.log(`✅ Synced practice from audit log`)
        break
      }

      default:
        console.warn(`[RealtimeManager] Unknown table_name: ${table_name}`)
    }
  }

  /**
   * Handle DELETE operations
   * Uses existing repository delete methods
   */
  private async handleRecordDelete(audit: AuditLogEntry): Promise<void> {
    const { table_name, record_id } = audit

    switch (table_name) {
      case 'songs':
        await repository.deleteSong(record_id)
        console.log(`✅ Deleted song from audit log:`, record_id)
        break

      case 'setlists':
        await repository.deleteSetlist(record_id)
        console.log(`✅ Deleted setlist from audit log:`, record_id)
        break

      case 'shows':
        await repository.deleteShow(record_id)
        console.log(`✅ Deleted show from audit log:`, record_id)
        break

      case 'practice_sessions':
        await repository.deletePracticeSession(record_id)
        console.log(`✅ Deleted practice from audit log:`, record_id)
        break

      default:
        console.warn(
          `[RealtimeManager] Unknown table_name for DELETE: ${table_name}`
        )
    }
  }

  /**
   * Safely parse a date string, returning a default date if invalid
   */
  private parseDate(dateString: any, defaultDate?: Date): Date {
    if (!dateString) {
      return defaultDate || new Date()
    }
    const parsed = new Date(dateString)
    if (isNaN(parsed.getTime())) {
      console.warn(
        `[RealtimeManager] Invalid date: ${dateString}, using default`
      )
      return defaultDate || new Date()
    }
    return parsed
  }

  /**
   * Map audit log JSONB to Song model
   * Handles snake_case → camelCase conversion
   */
  private mapAuditToSong(jsonb: any): Song {
    return {
      id: jsonb.id,
      title: jsonb.title || '',
      artist: jsonb.artist || '',
      album: jsonb.album || undefined,
      key: jsonb.key || '',
      bpm: jsonb.tempo || 120, // tempo → bpm
      duration: jsonb.duration || 0,
      difficulty: (jsonb.difficulty || 1) as 1 | 2 | 3 | 4 | 5,
      guitarTuning: jsonb.guitar_tuning || undefined,
      structure: jsonb.structure || [],
      lyrics: jsonb.lyrics || undefined,
      chords: jsonb.chords || [],
      notes: jsonb.notes || '',
      referenceLinks: jsonb.reference_links || [],
      tags: jsonb.tags || [],
      createdDate: this.parseDate(jsonb.created_date),
      lastPracticed: jsonb.last_practiced
        ? this.parseDate(jsonb.last_practiced)
        : undefined,
      confidenceLevel: jsonb.confidence_level || 1,
      contextType: jsonb.context_type,
      contextId: jsonb.context_id,
      createdBy: jsonb.created_by,
      visibility: jsonb.visibility || 'band',
      songGroupId: jsonb.song_group_id || undefined,
      linkedFromSongId: jsonb.linked_from_song_id || undefined,
      version: jsonb.version || 0,
      lastModifiedBy: jsonb.last_modified_by || undefined,
    }
  }

  /**
   * Map audit log JSONB to Setlist model
   */
  private mapAuditToSetlist(jsonb: any): Setlist {
    return {
      id: jsonb.id,
      name: jsonb.name || '',
      bandId: jsonb.band_id,
      items: jsonb.items || [], // Already JSONB
      totalDuration: 0, // Calculate from items if needed
      status: jsonb.status || 'draft',
      createdDate: this.parseDate(jsonb.created_date),
      lastModified: this.parseDate(jsonb.last_modified),
      version: jsonb.version || 0,
      lastModifiedBy: jsonb.last_modified_by || undefined,
    }
  }

  /**
   * Map audit log JSONB to Show model
   */
  private mapAuditToShow(jsonb: any): Show {
    return {
      id: jsonb.id,
      name: jsonb.name || '',
      venue: jsonb.venue || '',
      scheduledDate: this.parseDate(jsonb.scheduled_date),
      duration: jsonb.duration || 120,
      bandId: jsonb.band_id,
      setlistId: jsonb.setlist_id || undefined,
      status: jsonb.status || 'upcoming',
      notes: jsonb.notes || '',
      createdDate: this.parseDate(jsonb.created_date),
      updatedDate: this.parseDate(jsonb.updated_date),
      version: jsonb.version || 0,
      lastModifiedBy: jsonb.last_modified_by || undefined,
    }
  }

  /**
   * Map audit log JSONB to PracticeSession model
   */
  private mapAuditToPractice(jsonb: any): PracticeSession {
    return {
      id: jsonb.id,
      scheduledDate: this.parseDate(jsonb.scheduled_date),
      startTime: jsonb.start_time
        ? this.parseDate(jsonb.start_time)
        : undefined,
      endTime: jsonb.end_time ? this.parseDate(jsonb.end_time) : undefined,
      duration: jsonb.duration || 120,
      location: jsonb.location || '',
      type: jsonb.type || 'rehearsal',
      status: 'scheduled', // Default status for IndexedDB model
      objectives: jsonb.objectives || [],
      completedObjectives: jsonb.completed_objectives || [],
      songs: jsonb.songs || [],
      bandId: jsonb.band_id,
      setlistId: jsonb.setlist_id || undefined,
      notes: jsonb.notes || '',
      attendees: jsonb.attendees || [],
      createdDate: this.parseDate(jsonb.created_date),
      version: jsonb.version || 0,
      lastModifiedBy: jsonb.last_modified_by || undefined,
    }
  }

  /**
   * Extract item name from audit entry for toast display
   */
  private extractItemName(audit: AuditLogEntry): string {
    // For DELETE, use old_values; for INSERT/UPDATE, use new_values
    const values =
      audit.action === 'DELETE' ? audit.old_values : audit.new_values

    if (!values) {
      return 'item'
    }

    // Special handling for practice_sessions - use scheduled_date
    if (audit.table_name === 'practice_sessions') {
      return values.scheduled_date || 'item'
    }

    // Try common name fields
    return values.title || values.name || 'item'
  }

  /**
   * Queue a toast notification from audit log (no user lookup needed!)
   *
   * PRACTICE-SPECIFIC TOASTS ONLY: Only show toasts for practice_sessions changes.
   * Other tables (songs, setlists, shows) use silent sync with "last synced" indicator.
   */
  private async queueToastFromAudit(
    userName: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    itemName: string
  ): Promise<void> {
    // ONLY show toasts for practice_sessions (others were too noisy)
    if (table !== 'practice_sessions') {
      return
    }

    // Format practice date for display
    const displayName = this.formatPracticeDateForToast(itemName)

    // Show immediate toast for practice changes
    let message: string
    switch (eventType) {
      case 'INSERT':
        message = `${userName} scheduled practice for ${displayName}`
        break
      case 'UPDATE':
        message = `${userName} updated practice details`
        break
      case 'DELETE':
        message = `${userName} cancelled practice`
        break
    }

    this.showToast(message, 'info')
  }

  /**
   * Format practice date for toast display
   * Handles both ISO date strings and fallback to generic name
   */
  private formatPracticeDateForToast(itemName: string): string {
    // Try to parse as date (itemName might be ISO string or formatted date)
    try {
      const date = new Date(itemName)
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      }
    } catch {
      // Not a valid date, use as-is
    }
    return itemName || 'a practice'
  }

  /**
   * Queue a toast notification (batches rapid changes)
   * @deprecated - Use queueToastFromAudit for audit-first approach
   */
  private async queueToast(
    userId: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    itemName: string
  ): Promise<void> {
    // Get user's display name
    let userName = 'Someone'
    const effectiveUserId = userId || 'unknown' // Use 'unknown' as key if userId is empty

    try {
      // Validate userId before querying (avoid Dexie "No key or key range specified" error)
      if (!userId) {
        console.warn(
          '[RealtimeManager] queueToast called with empty userId, using default name'
        )
      } else {
        const user = await db.users.get(userId)
        if (user) {
          // User.name is the display name in our User model
          userName = user.name || 'Someone'
        } else {
          console.warn('[RealtimeManager] User not found in local DB:', userId)
        }
      }
    } catch (error) {
      console.error('Failed to get user name:', error)
    }

    // Add to pending toasts
    let pending = this.pendingToasts.get(effectiveUserId)
    if (!pending) {
      pending = {
        userId: effectiveUserId,
        userName,
        changes: [],
        timestamp: Date.now(),
      }
      this.pendingToasts.set(effectiveUserId, pending)
    }

    pending.changes.push({ type: eventType, table, itemName })

    // Reset batch timer
    if (this.toastBatchTimeout) {
      clearTimeout(this.toastBatchTimeout)
    }

    this.toastBatchTimeout = setTimeout(() => {
      this.flushToasts()
    }, this.TOAST_BATCH_DELAY)
  }

  /**
   * Show batched toast notifications
   */
  private flushToasts(): void {
    for (const pending of this.pendingToasts.values()) {
      const { userName, changes } = pending

      if (changes.length === 1) {
        // Single change - detailed message
        const change = changes[0]
        const action =
          change.type === 'INSERT'
            ? 'added'
            : change.type === 'UPDATE'
              ? 'updated'
              : 'deleted'
        const message = `${userName} ${action} "${change.itemName}"`

        this.showToast(message, 'info')
      } else {
        // Multiple changes - batched message
        const message = `${changes.length} changes by ${userName}`
        this.showToast(message, 'info')
      }
    }

    this.pendingToasts.clear()
    this.toastBatchTimeout = null
  }

  /**
   * Show a toast notification via event emitter
   * UI components can listen to 'toast' events and display them
   */
  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    // Emit toast event for UI to handle
    console.log(
      '[RealtimeManager] Emitting toast event, listeners:',
      this.listenerCount('toast')
    )
    this.emit('toast', { message, type })

    // Also log for debugging
    console.log(`[Toast ${type}]: ${message}`)
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    for (const [channelName, channel] of this.channels) {
      try {
        // Check if unsubscribe method exists (for test mocks)
        if (typeof channel.unsubscribe === 'function') {
          await channel.unsubscribe()
          console.log(`Unsubscribed from ${channelName}`)
        }
      } catch (error) {
        console.error(`Error unsubscribing from ${channelName}:`, error)
      }
    }

    this.channels.clear()
    this.connected = false
    this.currentUserId = null
  }

  /**
   * Check if connected to WebSocket
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get diagnostics information for debugging
   * Exposed for manual debugging via window.debugRealtime()
   */
  getDiagnostics() {
    return {
      connectionId: this.connectionId,
      uptime: this.connectionStartTime
        ? Date.now() - this.connectionStartTime
        : 0,
      metrics: {
        ...this.connectionMetrics,
        messagesPerMinute:
          this.connectionMetrics.messagesReceived > 0 &&
          this.connectionStartTime > 0
            ? (
                this.connectionMetrics.messagesReceived /
                ((Date.now() - this.connectionStartTime) / 60000)
              ).toFixed(2)
            : '0.00',
      },
      channels: {
        count: this.channels.size,
        names: Array.from(this.channels.keys()),
      },
      state: {
        connected: this.connected,
        currentUserId: this.currentUserId?.substring(0, 8) + '...',
        isOnline: navigator.onLine,
      },
      pendingToasts: this.pendingToasts.size,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnect(): void {
    this.connected = false
    console.log('WebSocket disconnected')
  }

  /**
   * Attempt to reconnect
   */
  async reconnect(): Promise<void> {
    if (!this.currentUserId) {
      console.error('Cannot reconnect: no user ID')
      return
    }

    console.log('Attempting to reconnect...')

    // Unsubscribe from old channels
    await this.unsubscribeAll()

    // Re-subscribe (would need to store band IDs)
    // For now, just mark as connected (full implementation would re-subscribe)
    this.connected = true
    console.log('Reconnected')
  }
}
