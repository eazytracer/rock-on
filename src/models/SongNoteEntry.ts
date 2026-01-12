/**
 * Practice log entries for songs - Jira-style comments with optional session context
 * These can be personal (only visible to owner) or band-visible (shared with band members)
 */
export interface SongNoteEntry {
  id: string
  songId: string
  userId: string
  bandId: string
  sessionType: 'practice' | 'show' | null
  sessionId: string | null
  content: string
  visibility: 'personal' | 'band'
  createdDate: Date | string
  updatedDate: Date | string | null
  version: number
}

/**
 * Input type for creating a new note entry
 */
export type SongNoteEntryInput = Omit<
  SongNoteEntry,
  'id' | 'createdDate' | 'updatedDate' | 'version'
>

/**
 * Input type for updating a note entry
 */
export type SongNoteEntryUpdate = Partial<
  Pick<SongNoteEntry, 'content' | 'visibility'>
>
