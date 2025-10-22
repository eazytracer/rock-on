import { SongSection, ReferenceLink } from '../types'

export interface Song {
  id: string
  title: string
  artist: string
  album?: string
  duration: number
  key: string
  bpm: number
  difficulty: 1 | 2 | 3 | 4 | 5
  guitarTuning?: string
  structure: SongSection[]
  lyrics?: string
  chords: string[]
  notes?: string
  referenceLinks: ReferenceLink[]
  tags: string[]
  createdDate: Date
  lastPracticed?: Date
  confidenceLevel: number

  // Multi-user context fields
  contextType: 'personal' | 'band'
  contextId: string // userId for personal, bandId for band
  createdBy: string // userId who created this song
  visibility: 'private' | 'band_only' | 'public'

  // Song variant linking (for Phase 2)
  songGroupId?: string // Links related versions of the same song
  linkedFromSongId?: string // Original song this was copied/derived from
}

export const SongSchema = {
  '++id': '',
  title: '',
  artist: '',
  album: '',
  duration: '',
  key: '',
  bpm: '',
  difficulty: '',
  guitarTuning: '',
  structure: '',
  lyrics: '',
  chords: '',
  notes: '',
  referenceLinks: '',
  tags: '',
  createdDate: '',
  lastPracticed: '',
  confidenceLevel: '',
  contextType: '',
  contextId: '',
  createdBy: '',
  visibility: '',
  songGroupId: '',
  linkedFromSongId: ''
}