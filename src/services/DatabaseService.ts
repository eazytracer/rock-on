import { db, initializeDefaultBand } from './database'
import { SongService } from './SongService'
import { PracticeSessionService } from './PracticeSessionService'
import { SetlistService } from './SetlistService'
import { BandService } from './BandService'
import { syncService } from './SyncService'

export interface DatabaseStats {
  bands: number
  members: number
  songs: number
  sessions: number
  setlists: number
  totalSize: number
}

export class DatabaseService {
  static async initialize(): Promise<void> {
    try {
      await db.open()
      await initializeDefaultBand()
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw new Error('Database initialization failed')
    }
  }

  static async getStats(): Promise<DatabaseStats> {
    const [bands, members, songs, sessions, setlists] = await Promise.all([
      db.bands.count(),
      db.members.count(),
      db.songs.count(),
      db.practiceSessions.count(),
      db.setlists.count()
    ])

    // Estimate storage size (rough calculation)
    const totalSize = (bands + members + songs + sessions + setlists) * 1024 // Rough estimate in bytes

    return {
      bands,
      members,
      songs,
      sessions,
      setlists,
      totalSize
    }
  }

  static async exportData(): Promise<any> {
    const [bands, members, songs, sessions, setlists] = await Promise.all([
      db.bands.toArray(),
      db.members.toArray(),
      db.songs.toArray(),
      db.practiceSessions.toArray(),
      db.setlists.toArray()
    ])

    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: {
        bands,
        members,
        songs,
        practiceSessions: sessions,
        setlists
      }
    }
  }

  static async importData(importData: any): Promise<void> {
    if (!importData.version || !importData.data) {
      throw new Error('Invalid import data format')
    }

    try {
      await db.transaction('rw', [db.bands, db.members, db.songs, db.practiceSessions, db.setlists], async () => {
        // Clear existing data
        await Promise.all([
          db.bands.clear(),
          db.members.clear(),
          db.songs.clear(),
          db.practiceSessions.clear(),
          db.setlists.clear()
        ])

        // Import new data
        const { bands, members, songs, practiceSessions, setlists } = importData.data

        if (bands?.length) await db.bands.bulkAdd(bands)
        if (members?.length) await db.members.bulkAdd(members)
        if (songs?.length) await db.songs.bulkAdd(songs)
        if (practiceSessions?.length) await db.practiceSessions.bulkAdd(practiceSessions)
        if (setlists?.length) await db.setlists.bulkAdd(setlists)
      })
    } catch (error) {
      console.error('Failed to import data:', error)
      throw new Error('Data import failed')
    }
  }

  static async clearAllData(): Promise<void> {
    try {
      await db.transaction('rw', [db.bands, db.members, db.songs, db.practiceSessions, db.setlists], async () => {
        await Promise.all([
          db.bands.clear(),
          db.members.clear(),
          db.songs.clear(),
          db.practiceSessions.clear(),
          db.setlists.clear()
        ])
      })
    } catch (error) {
      console.error('Failed to clear data:', error)
      throw new Error('Failed to clear database')
    }
  }

  static async backup(): Promise<Blob> {
    const data = await this.exportData()
    const jsonString = JSON.stringify(data, null, 2)
    return new Blob([jsonString], { type: 'application/json' })
  }

  static async restore(file: File): Promise<void> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await this.importData(data)
    } catch (error) {
      console.error('Failed to restore from backup:', error)
      throw new Error('Backup restore failed')
    }
  }

  // Service accessors for convenience
  static get songs() {
    return SongService
  }

  static get sessions() {
    return PracticeSessionService
  }

  static get setlists() {
    return SetlistService
  }

  static get bands() {
    return BandService
  }

  // Database status methods
  static async isHealthy(): Promise<boolean> {
    try {
      await db.bands.limit(1).toArray()
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }

  static async getVersion(): Promise<string> {
    return '1.0.0'
  }

  // Sync methods
  static get sync() {
    return syncService
  }

  static async getSyncStatus() {
    return syncService.getSyncStatus()
  }

  static async triggerSync(): Promise<boolean> {
    return syncService.triggerSync()
  }

  static async addPendingChange(
    type: 'song' | 'session' | 'setlist' | 'band' | 'member',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    return syncService.addPendingChange(type, action, data)
  }

  // Utility methods for testing and development
  static async seedTestData(): Promise<void> {
    // Only seed if database is empty
    const stats = await this.getStats()
    if (stats.bands > 0) {
      return
    }

    try {
      // Create test band
      const band = await BandService.createBand({
        name: 'Test Band',
        description: 'A band for testing'
      })

      // Add test member
      await BandService.addMemberToBand(band.id, {
        name: 'Test Musician',
        email: 'test@example.com',
        instruments: ['Guitar', 'Vocals'],
        primaryInstrument: 'Guitar',
        role: 'admin'
      })

      // Add test songs
      await SongService.createSong({
        title: 'Test Song 1',
        artist: 'Test Artist',
        duration: 240,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        bandId: band.id,
        createdBy: 'test-user'
      })

      await SongService.createSong({
        title: 'Test Song 2',
        artist: 'Another Artist',
        duration: 180,
        key: 'G',
        bpm: 140,
        difficulty: 4,
        bandId: band.id,
        createdBy: 'test-user'
      })

      console.log('Test data seeded successfully')
    } catch (error) {
      console.error('Failed to seed test data:', error)
      throw new Error('Test data seeding failed')
    }
  }
}