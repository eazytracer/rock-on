/* eslint-disable @typescript-eslint/no-explicit-any */
import EventEmitter from 'eventemitter3'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '../supabase/client'
import type { AuditLogEntry } from './syncTypes'
import { createLogger } from '../../utils/logger'

const log = createLogger('RealtimeManager')

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
    userId: string // User who made the change
  }
  'setlists:changed': {
    bandId: string
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    recordId: string
    userId: string
  }
  'shows:changed': {
    bandId: string
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    recordId: string
    userId: string
  }
  'practices:changed': {
    bandId: string
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    recordId: string
    userId: string
  }
  toast: { message: string; type: 'info' | 'success' | 'error' }
}

/**
 * RealtimeManager handles WebSocket subscriptions to Supabase for real-time collaboration.
 *
 * Features:
 * - Subscribe to database changes for user's bands
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

  constructor() {
    super() // Initialize EventEmitter

    // Use the main Supabase client singleton which already has the user's session
    // The session must be set BEFORE creating RealtimeManager
    this.supabase = getSupabaseClient()
  }

  /**
   * Subscribe to audit_log for the user's bands
   * Single subscription per band (was 4)
   */
  async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
    this.currentUserId = userId

    for (const bandId of bandIds) {
      await this.subscribeToAuditLog(userId, bandId)
    }

    // Mark as connected if at least one subscription succeeded
    if (this.channels.size > 0) {
      this.connected = true
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
    try {
      const channelName = `audit-${bandId}`

      // Check if already subscribed to this band
      if (this.channels.has(channelName)) {
        return
      }

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
              log.error('Error handling audit change:', error)
            })
          }
        )
        .subscribe(async (status, err) => {
          if (err) {
            log.error(`Failed to subscribe to ${channelName} (${status}):`, err)
            this.connected = false
          } else if (status === 'SUBSCRIBED') {
            log.debug(`Subscribed to ${channelName}`)
            this.connected = true
          } else if (status === 'CHANNEL_ERROR') {
            log.error(`Channel error for ${channelName}`)
            this.connected = false
          }
        })

      this.channels.set(channelName, channel)
    } catch (error) {
      log.error(`Error subscribing to audit_log for band ${bandId}:`, error)
    }
  }

  /**
   * Handle audit log changes from Supabase
   * Single unified handler for all entity types
   */
  private async handleAuditChange(payload: any): Promise<void> {
    // Supabase realtime sends: { new: AuditLogEntry, old: ..., eventType: 'INSERT', ... }
    const audit = payload.new as AuditLogEntry

    if (!audit || !audit.table_name || !audit.action) {
      log.warn('Invalid audit payload:', payload)
      return
    }

    // Note: We do NOT skip changes from the same user anymore.
    // The same user may be on multiple devices, and all devices need the update.
    // We only skip toasts for own changes (handled in queueToastFromAudit).
    const isOwnChange = audit.user_id === this.currentUserId

    try {
      // The web client no longer keeps a local IndexedDB mirror — an audit
      // event is purely a change notification. We emit a `*:changed` event and
      // TanStack Query invalidation (useRealtimeInvalidate) refetches from
      // Supabase. No local data application happens here anymore.

      // Extract item name for toast
      const itemName = this.extractItemName(
        audit.table_name,
        audit.action,
        audit.old_values,
        audit.new_values
      )

      // Show toast with ACTUAL user name (not "Someone"!)
      // Skip toast for own changes (but still emit the change event below)
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

      this.emit(eventName, {
        bandId: audit.band_id,
        action: audit.action,
        recordId: audit.record_id,
        userId: audit.user_id, // Include userId so subscribers can skip own changes
      })
    } catch (error) {
      log.error('Error processing audit change:', error)
    }
  }

  /**
   * Extract a display name from an audit entry for toast messages.
   */
  private extractItemName(
    tableName: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    oldValues: any,
    newValues: any
  ): string {
    // For DELETE, use old_values; for INSERT/UPDATE, use new_values
    const values = action === 'DELETE' ? oldValues : newValues
    if (!values) return 'item'
    // Practice sessions display by scheduled date
    if (tableName === 'practice_sessions') {
      return values.scheduled_date || 'item'
    }
    return values.title || values.name || 'item'
  }

  /**
   * Queue a toast notification from audit log (no user lookup needed!)
   *
   * Restores the original toast coverage (songs, setlists, shows, practices —
   * all add/update/delete), which the audit-first migration had narrowed to
   * practices only. Practices keep their tailored immediate messages; the other
   * entities route through the 2s batch buffer so rapid edits collapse into one
   * "N changes by X" toast instead of spamming (matching the old behaviour).
   */
  private async queueToastFromAudit(
    userName: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    itemName: string
  ): Promise<void> {
    if (table === 'practice_sessions') {
      const displayName = this.formatPracticeDateForToast(itemName)
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
      return
    }

    if (table !== 'songs' && table !== 'setlists' && table !== 'shows') {
      return
    }
    this.enqueueBatchedToast(userName, eventType, table, itemName)
  }

  /**
   * Buffer a song/setlist/show change into the 2s batch window, keyed by who
   * made it. Same batching the legacy per-table path used, but keyed on the
   * audit user_name so no local user lookup is needed.
   */
  private enqueueBatchedToast(
    userName: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    itemName: string
  ): void {
    let pending = this.pendingToasts.get(userName)
    if (!pending) {
      pending = {
        userId: userName,
        userName,
        changes: [],
        timestamp: Date.now(),
      }
      this.pendingToasts.set(userName, pending)
    }
    pending.changes.push({ type: eventType, table, itemName })

    if (this.toastBatchTimeout) {
      clearTimeout(this.toastBatchTimeout)
    }
    this.toastBatchTimeout = setTimeout(() => {
      this.flushToasts()
    }, this.TOAST_BATCH_DELAY)
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
        const kind =
          change.table === 'songs'
            ? 'song '
            : change.table === 'setlists'
              ? 'setlist '
              : change.table === 'shows'
                ? 'show '
                : ''
        const message = `${userName} ${action} ${kind}"${change.itemName}"`

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
    this.emit('toast', { message, type })
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
        }
      } catch (error) {
        log.error(`Error unsubscribing from ${channelName}:`, error)
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
   * Handle disconnection
   */
  handleDisconnect(): void {
    this.connected = false
    log.debug('WebSocket disconnected')
  }

  /**
   * Attempt to reconnect
   */
  async reconnect(): Promise<void> {
    if (!this.currentUserId) {
      log.error('Cannot reconnect: no user ID')
      return
    }

    // Unsubscribe from old channels
    await this.unsubscribeAll()

    // Re-subscribe (would need to store band IDs)
    // For now, just mark as connected (full implementation would re-subscribe)
    this.connected = true
  }
}
