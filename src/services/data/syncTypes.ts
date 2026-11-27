/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Audit log entry structure from Supabase audit_log table.
 * Used by RealtimeManager (WebSocket).
 */
export interface AuditLogEntry {
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
