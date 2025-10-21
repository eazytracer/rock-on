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
  confidenceLevel: ''
}