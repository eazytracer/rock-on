/**
 * Audit Log Mapping Utilities
 *
 * Shared mappers for converting audit_log JSONB records to application models.
 * Used by both RealtimeManager (WebSocket sync) and SyncEngine (incremental sync).
 *
 * These mappers handle snake_case → camelCase conversion for the data stored
 * in the audit_log table's new_values/old_values JSONB columns.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Song } from '../../models/Song'
import type { Setlist } from '../../models/Setlist'
import type { Show } from '../../models/Show'
import type { PracticeSession } from '../../models/PracticeSession'

/**
 * Safely parse a date string, returning a default date if invalid
 */
export function parseDate(dateString: any, defaultDate?: Date): Date {
  if (!dateString) {
    return defaultDate || new Date()
  }
  const parsed = new Date(dateString)
  if (isNaN(parsed.getTime())) {
    console.warn(`[auditMappers] Invalid date: ${dateString}, using default`)
    return defaultDate || new Date()
  }
  return parsed
}

/**
 * Map audit log JSONB to Song model
 * Handles snake_case → camelCase conversion
 */
export function mapAuditToSong(jsonb: any): Song {
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
    createdDate: parseDate(jsonb.created_date),
    lastPracticed: jsonb.last_practiced
      ? parseDate(jsonb.last_practiced)
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
export function mapAuditToSetlist(jsonb: any): Setlist {
  return {
    id: jsonb.id,
    name: jsonb.name || '',
    bandId: jsonb.band_id,
    items: jsonb.items || [], // Already JSONB
    totalDuration: 0, // Calculate from items if needed
    status: jsonb.status || 'draft',
    createdDate: parseDate(jsonb.created_date),
    lastModified: parseDate(jsonb.last_modified),
    version: jsonb.version || 0,
    lastModifiedBy: jsonb.last_modified_by || undefined,
  }
}

/**
 * Map audit log JSONB to Show model
 */
export function mapAuditToShow(jsonb: any): Show {
  return {
    id: jsonb.id,
    name: jsonb.name || '',
    venue: jsonb.venue || '',
    scheduledDate: parseDate(jsonb.scheduled_date),
    duration: jsonb.duration || 120,
    bandId: jsonb.band_id,
    setlistId: jsonb.setlist_id || undefined,
    status: jsonb.status || 'upcoming',
    notes: jsonb.notes || '',
    createdDate: parseDate(jsonb.created_date),
    updatedDate: parseDate(jsonb.updated_date),
    version: jsonb.version || 0,
    lastModifiedBy: jsonb.last_modified_by || undefined,
  }
}

/**
 * Map audit log JSONB to PracticeSession model
 */
export function mapAuditToPractice(jsonb: any): PracticeSession {
  return {
    id: jsonb.id,
    scheduledDate: parseDate(jsonb.scheduled_date),
    startTime: jsonb.start_time ? parseDate(jsonb.start_time) : undefined,
    endTime: jsonb.end_time ? parseDate(jsonb.end_time) : undefined,
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
    wrapupNotes: jsonb.wrapup_notes || '',
    // sessionRating: jsonb.session_rating ?? undefined, // TODO: Enable when sessionRating feature is implemented
    attendees: jsonb.attendees || [],
    createdDate: parseDate(jsonb.created_date),
    version: jsonb.version || 0,
    lastModifiedBy: jsonb.last_modified_by || undefined,
  }
}

/**
 * Extract item name from audit entry for display purposes
 * Used for toast notifications and logging
 */
export function extractItemName(
  tableName: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  oldValues: any,
  newValues: any
): string {
  // For DELETE, use old_values; for INSERT/UPDATE, use new_values
  const values = action === 'DELETE' ? oldValues : newValues

  if (!values) {
    return 'item'
  }

  // Special handling for practice_sessions - use scheduled_date
  if (tableName === 'practice_sessions') {
    return values.scheduled_date || 'item'
  }

  // Try common name fields
  return values.title || values.name || 'item'
}
