import Dexie, { Table } from 'dexie'
import { Band } from '../../models/Band'
import { Member } from '../../models/Member'
import { Song } from '../../models/Song'
import { PracticeSession } from '../../models/PracticeSession'
import { Setlist } from '../../models/Setlist'

export class RockOnDB extends Dexie {
  bands!: Table<Band>
  members!: Table<Member>
  songs!: Table<Song>
  practiceSessions!: Table<PracticeSession>
  setlists!: Table<Setlist>

  constructor() {
    super('RockOnDB')

    this.version(1).stores({
      bands: '++id, name, createdDate',
      members: '++id, name, email, isActive',
      songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel',
      practiceSessions: '++id, bandId, scheduledDate, type, status',
      setlists: '++id, name, bandId, showDate, status, createdDate, lastModified'
    })

    // Add hooks for automatic timestamps
    this.bands.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
    })

    this.songs.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
      obj.confidenceLevel = obj.confidenceLevel || 1
    })

    this.setlists.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
      obj.lastModified = new Date()
    })

    this.setlists.hook('updating', function(modifications, _primKey, _obj, _trans) {
      ;(modifications as any).lastModified = new Date()
    })

    this.members.hook('creating', function(_primKey, obj, _trans) {
      obj.joinDate = new Date()
      obj.isActive = obj.isActive !== false
    })
  }
}

export const db = new RockOnDB()

// Helper functions for common operations
export const initializeDefaultBand = async () => {
  const existingBands = await db.bands.count()
  if (existingBands === 0) {
    const bandId = await db.bands.add({
      id: crypto.randomUUID(),
      name: 'My Band',
      description: 'Your awesome band',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    })

    // Create default member
    const memberId = await db.members.add({
      id: crypto.randomUUID(),
      name: 'You',
      email: 'user@example.com',
      instruments: ['Guitar'],
      primaryInstrument: 'Guitar',
      role: 'admin',
      joinDate: new Date(),
      isActive: true
    })

    // Add member to band
    await db.bands.update(bandId, {
      memberIds: [memberId.toString()]
    })

    return { bandId, memberId }
  }
}

export default db