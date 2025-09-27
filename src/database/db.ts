import Dexie, { Table } from 'dexie'
import { Song } from '../models/Song'
import { Member } from '../models/Member'
import { PracticeSession } from '../models/PracticeSession'
import { Setlist } from '../models/Setlist'

export class RockOnDatabase extends Dexie {
  songs!: Table<Song>
  members!: Table<Member>
  practiceSessions!: Table<PracticeSession>
  setlists!: Table<Setlist>

  constructor() {
    super('RockOnDatabase')

    this.version(1).stores({
      songs: '++id, title, artist, album, duration, key, bpm, difficulty, *tags, createdDate, lastPracticed, confidenceLevel',
      members: '++id, name, email, phone, *instruments, primaryInstrument, role, joinDate, isActive',
      practiceSessions: '++id, bandId, scheduledDate, startTime, endTime, duration, location, type, status',
      setlists: '++id, name, bandId, showDate, venue, totalDuration, status, createdDate, lastModified'
    })
  }
}

export const db = new RockOnDatabase()