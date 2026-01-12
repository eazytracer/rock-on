/**
 * Personal notes for songs - one per user per song per band
 * These are private notes visible only to the owner
 */
export interface SongPersonalNote {
  id: string
  songId: string
  userId: string
  bandId: string
  content: string | null
  createdDate: Date | string
  updatedDate: Date | string
  version: number
}

/**
 * Input type for creating a new personal note
 */
export type SongPersonalNoteInput = Omit<
  SongPersonalNote,
  'id' | 'createdDate' | 'updatedDate' | 'version'
>

/**
 * Input type for updating a personal note
 */
export type SongPersonalNoteUpdate = Partial<Pick<SongPersonalNote, 'content'>>
