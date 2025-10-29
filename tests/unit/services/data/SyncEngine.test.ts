import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SyncEngine } from '../../../../src/services/data/SyncEngine'
import { LocalRepository } from '../../../../src/services/data/LocalRepository'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'
import { db } from '../../../../src/services/database'

describe('SyncEngine - Queue Management', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  beforeEach(async () => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()
    syncEngine = new SyncEngine(localRepo, remoteRepo)

    // Clear sync queue
    await db.syncQueue?.clear()
  })

  afterEach(async () => {
    syncEngine.destroy()
    await db.syncQueue?.clear()
  })

  it('should queue a create operation', async () => {
    await syncEngine.queueCreate('songs', {
      id: 'test-song-1',
      title: 'Test Song'
    })

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].operation).toBe('create')
    expect(queue![0].table).toBe('songs')
    expect(queue![0].status).toBe('pending')
  })

  it('should queue an update operation', async () => {
    await syncEngine.queueUpdate('songs', 'test-song-1', {
      title: 'Updated Title'
    })

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].operation).toBe('update')
    expect(queue![0].data.id).toBe('test-song-1')
  })

  it('should merge multiple updates for same record', async () => {
    await syncEngine.queueUpdate('songs', 'test-song-1', {
      title: 'Update 1'
    })

    await syncEngine.queueUpdate('songs', 'test-song-1', {
      artist: 'New Artist'
    })

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].data.title).toBe('Update 1')
    expect(queue![0].data.artist).toBe('New Artist')
  })

  it('should queue a delete operation', async () => {
    await syncEngine.queueDelete('songs', 'test-song-1')

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].operation).toBe('delete')
  })
})

describe('SyncEngine - Sync Operations', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  beforeEach(() => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()

    // Mock remote repository methods
    vi.spyOn(remoteRepo, 'addSong').mockResolvedValue({
      id: 'synced-song-1',
      title: 'Synced Song',
      contextType: 'band',
      contextId: 'band-1',
      createdBy: 'user-1'
    } as any)

    syncEngine = new SyncEngine(localRepo, remoteRepo)
  })

  afterEach(async () => {
    syncEngine.destroy()
    await db.syncQueue?.clear()
  })

  it('should push queued create operations', async () => {
    await syncEngine.queueCreate('songs', {
      id: 'test-song-1',
      title: 'Test Song'
    })

    await syncEngine['pushQueuedChanges']()

    expect(remoteRepo.addSong).toHaveBeenCalled()

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(0) // Cleared after successful sync
  })

  it('should handle sync failures with retry', async () => {
    vi.spyOn(remoteRepo, 'addSong').mockRejectedValue(new Error('Network error'))

    await syncEngine.queueCreate('songs', {
      id: 'test-song-1',
      title: 'Test Song'
    })

    await syncEngine['pushQueuedChanges']()

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].retries).toBe(1)
    expect(queue![0].status).toBe('pending') // Ready for retry
  })

  it('should mark as failed after max retries', async () => {
    vi.spyOn(remoteRepo, 'addSong').mockRejectedValue(new Error('Network error'))

    await syncEngine.queueCreate('songs', {
      id: 'test-song-1',
      title: 'Test Song'
    })

    // Simulate 3 failed attempts
    await syncEngine['pushQueuedChanges']()
    await syncEngine['pushQueuedChanges']()
    await syncEngine['pushQueuedChanges']()

    const queue = await db.syncQueue?.toArray()
    expect(queue![0].status).toBe('failed')
    expect(queue![0].retries).toBe(3)
  })
})

describe('SyncEngine - Conflict Resolution', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  beforeEach(() => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()
    syncEngine = new SyncEngine(localRepo, remoteRepo)
  })

  afterEach(async () => {
    syncEngine.destroy()
    await db.songs.clear()
  })

  it('should prefer remote when remote is newer', async () => {
    const localRecord = {
      id: 'song-1',
      title: 'Local Version',
      updated_date: '2025-01-01T10:00:00Z'
    }

    const remoteRecord = {
      id: 'song-1',
      title: 'Remote Version',
      updated_date: '2025-01-01T12:00:00Z' // Newer
    }

    await db.songs.add(localRecord as any)

    await syncEngine['mergeRecord']('songs', remoteRecord)

    const merged = await db.songs.get('song-1')
    expect(merged?.title).toBe('Remote Version')
  })

  it('should keep local when local is newer', async () => {
    const localRecord = {
      id: 'song-1',
      title: 'Local Version',
      updated_date: '2025-01-01T12:00:00Z' // Newer
    }

    const remoteRecord = {
      id: 'song-1',
      title: 'Remote Version',
      updated_date: '2025-01-01T10:00:00Z'
    }

    await db.songs.add(localRecord as any)

    await syncEngine['mergeRecord']('songs', remoteRecord)

    const merged = await db.songs.get('song-1')
    expect(merged?.title).toBe('Local Version')
  })
})

describe('SyncEngine - Online/Offline Handling', () => {
  let syncEngine: SyncEngine

  beforeEach(() => {
    const localRepo = new LocalRepository()
    const remoteRepo = new RemoteRepository()
    syncEngine = new SyncEngine(localRepo, remoteRepo)
  })

  afterEach(() => {
    syncEngine.destroy()
  })

  it('should detect online event and trigger sync', async () => {
    const syncSpy = vi.spyOn(syncEngine, 'syncNow')

    // Simulate going online
    window.dispatchEvent(new Event('online'))

    // Wait for event handler
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(syncSpy).toHaveBeenCalled()
  })

  it('should not sync when offline', async () => {
    const syncSpy = vi.spyOn(syncEngine, 'syncNow')

    // Simulate offline
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

    syncEngine['startPeriodicSync']()

    // Wait for interval
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(syncSpy).not.toHaveBeenCalled()
  })
})

describe('SyncEngine - Initial Sync (Cloud → Local)', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  beforeEach(async () => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()

    // Clear all local data
    await db.songs.clear()
    await db.setlists.clear()
    await db.practiceSessions.clear()
    await db.bands.clear()
    await db.bandMemberships.clear()
    await db.syncMetadata?.clear()

    // Mock remote repository to return test data
    vi.spyOn(remoteRepo, 'getUserMemberships').mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        bandId: 'band-1',
        role: 'admin',
        permissions: ['read', 'write'],
        joinedDate: new Date('2025-01-01'),
        status: 'active'
      }
    ])

    vi.spyOn(remoteRepo, 'getSongs').mockResolvedValue([
      {
        id: 'song-1',
        title: 'Test Song 1',
        artist: 'Test Artist',
        album: '',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        guitarTuning: 'Standard',
        structure: [],
        lyrics: '',
        chords: [],
        referenceLinks: [],
        tags: [],
        notes: 'Test notes',
        createdDate: new Date('2025-01-01'),
        confidenceLevel: 3,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band'
      }
    ])

    vi.spyOn(remoteRepo, 'getSetlists').mockResolvedValue([
      {
        id: 'setlist-1',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        notes: '',
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01')
      }
    ])

    vi.spyOn(remoteRepo, 'getPracticeSessions').mockResolvedValue([
      {
        id: 'practice-1',
        bandId: 'band-1',
        scheduledDate: new Date('2025-01-10'),
        duration: 120,
        location: 'Studio A',
        type: 'rehearsal',
        status: 'scheduled',
        notes: 'Test practice',
        objectives: ['Practice new songs'],
        completedObjectives: [],
        songs: [],
        attendees: []
      }
    ])

    syncEngine = new SyncEngine(localRepo, remoteRepo)
  })

  afterEach(async () => {
    syncEngine.destroy()
    await db.songs.clear()
    await db.setlists.clear()
    await db.practiceSessions.clear()
    await db.bands.clear()
    await db.bandMemberships.clear()
    await db.syncMetadata?.clear()
    localStorage.clear()
  })

  it('should download all data on initial sync', async () => {
    await syncEngine.performInitialSync('user-1')

    // Verify songs were downloaded
    const songs = await db.songs.toArray()
    expect(songs).toHaveLength(1)
    expect(songs[0].title).toBe('Test Song 1')

    // Verify setlists were downloaded
    const setlists = await db.setlists.toArray()
    expect(setlists).toHaveLength(1)
    expect(setlists[0].name).toBe('Test Setlist')

    // Verify practice sessions were downloaded
    const practices = await db.practiceSessions.toArray()
    expect(practices).toHaveLength(1)
    expect(practices[0].notes).toBe('Test practice')
  })

  it('should set last full sync timestamp', async () => {
    await syncEngine.performInitialSync('user-1')

    const lastFullSync = localStorage.getItem('last_full_sync')
    expect(lastFullSync).toBeTruthy()

    // Verify sync metadata was updated
    const meta = await db.syncMetadata?.get('songs_lastFullSync')
    expect(meta).toBeTruthy()
  })

  it('should handle user with no bands gracefully', async () => {
    vi.spyOn(remoteRepo, 'getUserMemberships').mockResolvedValue([])

    await syncEngine.performInitialSync('user-2')

    // Should not crash
    const songs = await db.songs.toArray()
    expect(songs).toHaveLength(0)
  })

  it('should detect when initial sync is needed', async () => {
    // Clear local storage
    localStorage.removeItem('last_full_sync')

    const isNeeded = await syncEngine.isInitialSyncNeeded()
    expect(isNeeded).toBe(true)
  })

  it('should detect when initial sync is not needed', async () => {
    // Set recent sync timestamp
    localStorage.setItem('last_full_sync', new Date().toISOString())

    const isNeeded = await syncEngine.isInitialSyncNeeded()
    expect(isNeeded).toBe(false)
  })

  it('should require re-sync after 30 days', async () => {
    // Set old sync timestamp (31 days ago)
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 31)
    localStorage.setItem('last_full_sync', oldDate.toISOString())

    const isNeeded = await syncEngine.isInitialSyncNeeded()
    expect(isNeeded).toBe(true)
  })
})

describe('SyncEngine - Pull from Remote (Incremental Sync)', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  beforeEach(async () => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()

    // Clear all local data
    await db.songs.clear()
    await db.setlists.clear()
    await db.practiceSessions.clear()
    await db.syncMetadata?.clear()

    // Add existing local song (older timestamp)
    await db.songs.add({
      id: 'song-1',
      title: 'Old Title',
      artist: 'Test Artist',
      album: '',
      duration: 180,
      key: 'C',
      bpm: 120,
      difficulty: 3,
      guitarTuning: 'Standard',
      structure: [],
      lyrics: '',
      chords: [],
      referenceLinks: [],
      tags: [],
      notes: 'Old notes',
      createdDate: new Date('2025-01-01'),
      lastModified: new Date('2025-01-01T10:00:00Z'),
      confidenceLevel: 3,
      contextType: 'band',
      contextId: 'band-1',
      createdBy: 'user-1',
      visibility: 'band'
    })

    // Mock remote to return newer version
    vi.spyOn(remoteRepo, 'getUserMemberships').mockResolvedValue([
      {
        id: 'membership-1',
        userId: 'user-1',
        bandId: 'band-1',
        role: 'admin',
        permissions: ['read', 'write'],
        joinedDate: new Date('2025-01-01'),
        status: 'active'
      }
    ])

    vi.spyOn(remoteRepo, 'getSongs').mockResolvedValue([
      {
        id: 'song-1',
        title: 'Updated Title', // Changed
        artist: 'Test Artist',
        album: '',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        guitarTuning: 'Standard',
        structure: [],
        lyrics: '',
        chords: [],
        referenceLinks: [],
        tags: [],
        notes: 'Updated notes', // Changed
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01T12:00:00Z'), // Newer timestamp
        confidenceLevel: 3,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band'
      },
      {
        id: 'song-2',
        title: 'New Song', // New record
        artist: 'New Artist',
        album: '',
        duration: 200,
        key: 'D',
        bpm: 140,
        difficulty: 2,
        guitarTuning: 'Standard',
        structure: [],
        lyrics: '',
        chords: [],
        referenceLinks: [],
        tags: [],
        notes: '',
        createdDate: new Date('2025-01-02'),
        confidenceLevel: 1,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band'
      }
    ])

    vi.spyOn(remoteRepo, 'getSetlists').mockResolvedValue([])
    vi.spyOn(remoteRepo, 'getPracticeSessions').mockResolvedValue([])

    syncEngine = new SyncEngine(localRepo, remoteRepo)
  })

  afterEach(async () => {
    syncEngine.destroy()
    await db.songs.clear()
    await db.setlists.clear()
    await db.practiceSessions.clear()
    await db.syncMetadata?.clear()
  })

  it('should update existing records with newer remote versions', async () => {
    await syncEngine.pullFromRemote('user-1')

    const song = await db.songs.get('song-1')
    expect(song?.title).toBe('Updated Title')
    expect(song?.notes).toBe('Updated notes')
  })

  it('should insert new records from remote', async () => {
    await syncEngine.pullFromRemote('user-1')

    const songs = await db.songs.toArray()
    expect(songs).toHaveLength(2)

    const newSong = await db.songs.get('song-2')
    expect(newSong?.title).toBe('New Song')
  })

  it('should not overwrite local records that are newer', async () => {
    // Add a local song with a newer timestamp
    await db.songs.put({
      id: 'song-3',
      title: 'Local Newer',
      artist: 'Artist',
      album: '',
      duration: 180,
      key: 'C',
      bpm: 120,
      difficulty: 3,
      guitarTuning: 'Standard',
      structure: [],
      lyrics: '',
      chords: [],
      referenceLinks: [],
      tags: [],
      notes: 'Local is newer',
      createdDate: new Date('2025-01-01'),
      lastModified: new Date('2025-01-01T14:00:00Z'), // Very recent
      confidenceLevel: 3,
      contextType: 'band',
      contextId: 'band-1',
      createdBy: 'user-1',
      visibility: 'band'
    })

    // Mock remote to return older version
    vi.spyOn(remoteRepo, 'getSongs').mockResolvedValue([
      {
        id: 'song-3',
        title: 'Remote Older',
        artist: 'Artist',
        album: '',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        guitarTuning: 'Standard',
        structure: [],
        lyrics: '',
        chords: [],
        referenceLinks: [],
        tags: [],
        notes: 'Remote is older',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01T10:00:00Z'), // Older timestamp
        confidenceLevel: 3,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band'
      }
    ])

    await syncEngine.pullFromRemote('user-1')

    const song = await db.songs.get('song-3')
    expect(song?.title).toBe('Local Newer') // Should keep local version
  })

  it('should update sync metadata after pull', async () => {
    await syncEngine.pullFromRemote('user-1')

    const meta = await db.syncMetadata?.get('songs_lastSync')
    expect(meta).toBeTruthy()
    expect(meta?.value).toBeInstanceOf(Date)
  })
})
