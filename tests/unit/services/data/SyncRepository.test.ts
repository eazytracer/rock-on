import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SyncRepository } from '../../../../src/services/data/SyncRepository'
import { LocalRepository } from '../../../../src/services/data/LocalRepository'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'
import { SyncEngine } from '../../../../src/services/data/SyncEngine'
import { Song } from '../../../../src/models/Song'
import { Band } from '../../../../src/models/Band'
import { db } from '../../../../src/services/database'

// Mock the dependencies
vi.mock('../../../../src/services/data/LocalRepository')
vi.mock('../../../../src/services/data/RemoteRepository')
vi.mock('../../../../src/services/data/SyncEngine')

describe('SyncRepository', () => {
  let syncRepository: SyncRepository
  let mockLocal: any
  let mockRemote: any
  let mockSyncEngine: any
  let originalOnLine: boolean

  const testSong: Song = {
    id: 'test-song-1',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 180,
    key: 'C',
    bpm: 120,
    difficulty: 3,
    structure: [],
    chords: ['C', 'G', 'Am', 'F'],
    referenceLinks: [],
    tags: ['rock'],
    contextType: 'band',
    contextId: 'test-band-1',
    createdBy: 'test-user-1',
    visibility: 'band_only',
    confidenceLevel: 3,
    createdDate: new Date()
  }

  const testBand: Band = {
    id: 'test-band-1',
    name: 'Test Band',
    description: 'A test band',
    createdDate: new Date(),
    settings: {
      defaultPracticeTime: 120,
      reminderMinutes: [60, 30, 10],
      autoSaveInterval: 30
    },
    memberIds: []
  }

  beforeEach(() => {
    // Store original navigator.onLine
    originalOnLine = navigator.onLine

    // Create mock instances
    mockLocal = {
      getSongs: vi.fn(),
      getSong: vi.fn(),
      addSong: vi.fn(),
      updateSong: vi.fn(),
      deleteSong: vi.fn(),
      getBands: vi.fn(),
      getBand: vi.fn(),
      getBandsForUser: vi.fn(),
      addBand: vi.fn(),
      updateBand: vi.fn(),
      deleteBand: vi.fn(),
      getSetlists: vi.fn(),
      getSetlist: vi.fn(),
      addSetlist: vi.fn(),
      updateSetlist: vi.fn(),
      deleteSetlist: vi.fn(),
      getPracticeSessions: vi.fn(),
      getPracticeSession: vi.fn(),
      addPracticeSession: vi.fn(),
      updatePracticeSession: vi.fn(),
      deletePracticeSession: vi.fn(),
      getBandMemberships: vi.fn(),
      getUserMemberships: vi.fn(),
      addBandMembership: vi.fn(),
      updateBandMembership: vi.fn(),
      deleteBandMembership: vi.fn()
    }

    mockRemote = {
      getSongs: vi.fn(),
      getSong: vi.fn(),
      addSong: vi.fn(),
      updateSong: vi.fn(),
      deleteSong: vi.fn(),
      getBands: vi.fn(),
      getBand: vi.fn(),
      getBandsForUser: vi.fn(),
      addBand: vi.fn(),
      updateBand: vi.fn(),
      deleteBand: vi.fn(),
      getBandMemberships: vi.fn(),
      getUserMemberships: vi.fn(),
      addBandMembership: vi.fn()
    }

    mockSyncEngine = {
      queueCreate: vi.fn(),
      queueUpdate: vi.fn(),
      queueDelete: vi.fn(),
      syncNow: vi.fn(),
      getStatus: vi.fn(),
      onStatusChange: vi.fn()
    }

    // Mock the constructors
    vi.mocked(LocalRepository).mockImplementation(() => mockLocal)
    vi.mocked(RemoteRepository).mockImplementation(() => mockRemote)
    vi.mocked(SyncEngine).mockImplementation(() => mockSyncEngine)
  })

  afterEach(() => {
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: originalOnLine
    })
    vi.clearAllMocks()
  })

  describe('Read Operations - Always from Local', () => {
    it('should read songs from local repository', async () => {
      const expectedSongs = [testSong]
      mockLocal.getSongs.mockResolvedValue(expectedSongs)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getSongs()

      expect(mockLocal.getSongs).toHaveBeenCalledWith(undefined)
      expect(mockRemote.getSongs).not.toHaveBeenCalled()
      expect(result).toEqual(expectedSongs)
    })

    it('should read songs with filter from local repository', async () => {
      const filter = { contextType: 'band' as const, contextId: 'test-band-1' }
      const expectedSongs = [testSong]
      mockLocal.getSongs.mockResolvedValue(expectedSongs)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getSongs(filter)

      expect(mockLocal.getSongs).toHaveBeenCalledWith(filter)
      expect(mockRemote.getSongs).not.toHaveBeenCalled()
      expect(result).toEqual(expectedSongs)
    })

    it('should get a single song from local repository', async () => {
      mockLocal.getSong.mockResolvedValue(testSong)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getSong('test-song-1')

      expect(mockLocal.getSong).toHaveBeenCalledWith('test-song-1')
      expect(mockRemote.getSong).not.toHaveBeenCalled()
      expect(result).toEqual(testSong)
    })

    it('should read bands from local repository', async () => {
      const expectedBands = [testBand]
      mockLocal.getBands.mockResolvedValue(expectedBands)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getBands()

      expect(mockLocal.getBands).toHaveBeenCalled()
      expect(mockRemote.getBands).not.toHaveBeenCalled()
      expect(result).toEqual(expectedBands)
    })

    it('should get a single band cloud-first (remote, then local)', async () => {
      // Mock remote to return band
      mockRemote.getBand.mockResolvedValue(testBand)
      // Mock local addBand for caching
      mockLocal.addBand.mockResolvedValue(testBand)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getBand('test-band-1')

      // Should try remote first when online
      expect(mockRemote.getBand).toHaveBeenCalledWith('test-band-1')
      // Should cache the result in local
      expect(mockLocal.addBand).toHaveBeenCalledWith(testBand)
      expect(result).toEqual(testBand)
    })

    it('should get bands for user from local repository', async () => {
      const expectedBands = [testBand]
      mockLocal.getBandsForUser.mockResolvedValue(expectedBands)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getBandsForUser('test-user-1')

      expect(mockLocal.getBandsForUser).toHaveBeenCalledWith('test-user-1')
      expect(result).toEqual(expectedBands)
    })
  })

  describe('Write Operations - Local + Queue', () => {
    describe('Songs', () => {
      it('should write to local and queue for sync when adding song', async () => {
        mockLocal.addSong.mockResolvedValue(testSong)
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          configurable: true,
          value: true
        })

        syncRepository = new SyncRepository()
        const result = await syncRepository.addSong(testSong)

        expect(mockLocal.addSong).toHaveBeenCalledWith(testSong)
        expect(mockSyncEngine.queueCreate).toHaveBeenCalledWith('songs', testSong)
        expect(result).toEqual(testSong)
      })

      it('should write to local and queue for sync when updating song', async () => {
        const updates = { title: 'Updated Title' }
        const updatedSong = { ...testSong, ...updates }
        mockLocal.updateSong.mockResolvedValue(updatedSong)
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          configurable: true,
          value: true
        })

        syncRepository = new SyncRepository()
        const result = await syncRepository.updateSong('test-song-1', updates)

        expect(mockLocal.updateSong).toHaveBeenCalledWith('test-song-1', updates)
        expect(mockSyncEngine.queueUpdate).toHaveBeenCalledWith('songs', 'test-song-1', updates)
        expect(result).toEqual(updatedSong)
      })

      it('should write to local and queue for sync when deleting song', async () => {
        mockLocal.deleteSong.mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          configurable: true,
          value: true
        })

        syncRepository = new SyncRepository()
        await syncRepository.deleteSong('test-song-1')

        expect(mockLocal.deleteSong).toHaveBeenCalledWith('test-song-1')
        expect(mockSyncEngine.queueDelete).toHaveBeenCalledWith('songs', 'test-song-1')
      })
    })

    describe('Bands', () => {
      it('should write to local and queue for sync when adding band', async () => {
        mockLocal.addBand.mockResolvedValue(testBand)
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          configurable: true,
          value: true
        })

        syncRepository = new SyncRepository()
        const result = await syncRepository.addBand(testBand)

        expect(mockLocal.addBand).toHaveBeenCalledWith(testBand)
        expect(mockSyncEngine.queueCreate).toHaveBeenCalledWith('bands', testBand)
        expect(result).toEqual(testBand)
      })

      it('should write to local and queue for sync when updating band', async () => {
        const updates = { name: 'Updated Band' }
        const updatedBand = { ...testBand, ...updates }
        mockLocal.updateBand.mockResolvedValue(updatedBand)
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          configurable: true,
          value: true
        })

        syncRepository = new SyncRepository()
        const result = await syncRepository.updateBand('test-band-1', updates)

        expect(mockLocal.updateBand).toHaveBeenCalledWith('test-band-1', updates)
        expect(mockSyncEngine.queueUpdate).toHaveBeenCalledWith('bands', 'test-band-1', updates)
        expect(result).toEqual(updatedBand)
      })

      it('should write to local and queue for sync when deleting band', async () => {
        mockLocal.deleteBand.mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          configurable: true,
          value: true
        })

        syncRepository = new SyncRepository()
        await syncRepository.deleteBand('test-band-1')

        expect(mockLocal.deleteBand).toHaveBeenCalledWith('test-band-1')
        expect(mockSyncEngine.queueDelete).toHaveBeenCalledWith('bands', 'test-band-1')
      })
    })
  })

  describe('Sync Behavior - Online/Offline Aware', () => {
    it('should attempt sync when online after adding song', async () => {
      mockLocal.addSong.mockResolvedValue(testSong)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true
      })

      syncRepository = new SyncRepository()
      await syncRepository.addSong(testSong)

      expect(mockSyncEngine.syncNow).toHaveBeenCalled()
    })

    it('should not sync when offline after adding song', async () => {
      mockLocal.addSong.mockResolvedValue(testSong)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false
      })

      syncRepository = new SyncRepository()
      await syncRepository.addSong(testSong)

      expect(mockSyncEngine.syncNow).not.toHaveBeenCalled()
    })

    it('should attempt sync when online after updating song', async () => {
      const updates = { title: 'Updated' }
      const updatedSong = { ...testSong, ...updates }
      mockLocal.updateSong.mockResolvedValue(updatedSong)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true
      })

      syncRepository = new SyncRepository()
      await syncRepository.updateSong('test-song-1', updates)

      expect(mockSyncEngine.syncNow).toHaveBeenCalled()
    })

    it('should not sync when offline after updating song', async () => {
      const updates = { title: 'Updated' }
      const updatedSong = { ...testSong, ...updates }
      mockLocal.updateSong.mockResolvedValue(updatedSong)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false
      })

      syncRepository = new SyncRepository()
      await syncRepository.updateSong('test-song-1', updates)

      expect(mockSyncEngine.syncNow).not.toHaveBeenCalled()
    })

    it('should attempt sync when online after deleting song', async () => {
      mockLocal.deleteSong.mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true
      })

      syncRepository = new SyncRepository()
      await syncRepository.deleteSong('test-song-1')

      expect(mockSyncEngine.syncNow).toHaveBeenCalled()
    })

    it('should not sync when offline after deleting song', async () => {
      mockLocal.deleteSong.mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false
      })

      syncRepository = new SyncRepository()
      await syncRepository.deleteSong('test-song-1')

      expect(mockSyncEngine.syncNow).not.toHaveBeenCalled()
    })
  })

  describe('Setlists - Basic Stubs', () => {
    it('should implement getSetlists', async () => {
      mockLocal.getSetlists.mockResolvedValue([])

      syncRepository = new SyncRepository()
      const result = await syncRepository.getSetlists('test-band-1')

      expect(mockLocal.getSetlists).toHaveBeenCalledWith('test-band-1')
      expect(result).toEqual([])
    })

    it('should implement getSetlist', async () => {
      mockLocal.getSetlist.mockResolvedValue(null)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getSetlist('setlist-1')

      expect(mockLocal.getSetlist).toHaveBeenCalledWith('setlist-1')
      expect(result).toBeNull()
    })

    it('should implement addSetlist', async () => {
      const setlist = { id: 'setlist-1', bandId: 'band-1', name: 'Test Setlist', songs: [], createdDate: new Date() }
      mockLocal.addSetlist.mockResolvedValue(setlist)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false
      })

      syncRepository = new SyncRepository()
      const result = await syncRepository.addSetlist(setlist)

      expect(mockLocal.addSetlist).toHaveBeenCalledWith(setlist)
      expect(result).toEqual(setlist)
    })

    it('should implement updateSetlist', async () => {
      const updates = { name: 'Updated Setlist' }
      const updated = { id: 'setlist-1', bandId: 'band-1', name: 'Updated Setlist', songs: [], createdDate: new Date() }
      mockLocal.updateSetlist.mockResolvedValue(updated)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false
      })

      syncRepository = new SyncRepository()
      const result = await syncRepository.updateSetlist('setlist-1', updates)

      expect(mockLocal.updateSetlist).toHaveBeenCalledWith('setlist-1', updates)
      expect(result).toEqual(updated)
    })

    it('should implement deleteSetlist', async () => {
      mockLocal.deleteSetlist.mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false
      })

      syncRepository = new SyncRepository()
      await syncRepository.deleteSetlist('setlist-1')

      expect(mockLocal.deleteSetlist).toHaveBeenCalledWith('setlist-1')
    })
  })

  describe('Practice Sessions - Basic Stubs', () => {
    it('should implement getPracticeSessions', async () => {
      mockLocal.getPracticeSessions.mockResolvedValue([])

      syncRepository = new SyncRepository()
      const result = await syncRepository.getPracticeSessions('test-band-1')

      expect(mockLocal.getPracticeSessions).toHaveBeenCalledWith('test-band-1')
      expect(result).toEqual([])
    })

    it('should implement getPracticeSession', async () => {
      mockLocal.getPracticeSession.mockResolvedValue(null)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getPracticeSession('session-1')

      expect(mockLocal.getPracticeSession).toHaveBeenCalledWith('session-1')
      expect(result).toBeNull()
    })
  })

  describe('Band Memberships - Basic Stubs', () => {
    it('should implement getBandMemberships', async () => {
      mockLocal.getBandMemberships.mockResolvedValue([])

      syncRepository = new SyncRepository()
      const result = await syncRepository.getBandMemberships('test-band-1')

      expect(mockLocal.getBandMemberships).toHaveBeenCalledWith('test-band-1')
      expect(result).toEqual([])
    })

    it('should implement getUserMemberships cloud-first (remote, then local)', async () => {
      const mockMemberships = []
      // Mock remote to return memberships
      mockRemote.getUserMemberships.mockResolvedValue(mockMemberships)

      syncRepository = new SyncRepository()
      const result = await syncRepository.getUserMemberships('user-1')

      // Should try remote first when online
      expect(mockRemote.getUserMemberships).toHaveBeenCalledWith('user-1')
      expect(result).toEqual(mockMemberships)
    })
  })
})
