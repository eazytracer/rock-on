import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { IDataRepository } from '../../../src/services/data/IDataRepository'
import type { Song } from '../../../src/models/Song'

// Mock the RepositoryFactory module BEFORE importing SongService
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockGetSongs = vi.fn()
  const mockAddSong = vi.fn()
  const mockUpdateSong = vi.fn()
  const mockDeleteSong = vi.fn()
  const mockGetSetlists = vi.fn()

  const mockRepository = {
    getSongs: mockGetSongs,
    addSong: mockAddSong,
    updateSong: mockUpdateSong,
    deleteSong: mockDeleteSong,
    getSetlists: mockGetSetlists,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// Import SongService AFTER the mock is set up
import { SongService } from '../../../src/services/SongService'
// Import the mocked repository to get access to the mock functions
import { repository } from '../../../src/services/data/RepositoryFactory'

// Extract mock functions for test assertions
const mockGetSongs = repository.getSongs as ReturnType<typeof vi.fn>
const mockAddSong = repository.addSong as ReturnType<typeof vi.fn>
const mockUpdateSong = repository.updateSong as ReturnType<typeof vi.fn>
const mockDeleteSong = repository.deleteSong as ReturnType<typeof vi.fn>
const mockGetSetlists = repository.getSetlists as ReturnType<typeof vi.fn>

describe('SongService - Migrated to Repository Pattern', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  describe('getAllSongs', () => {
    it('should get all songs via repository with no filters', async () => {
      // Arrange
      const mockSongs: Song[] = [
        {
          id: '1',
          title: 'Song 1',
          artist: 'Artist 1',
          album: 'Album 1',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 3,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date('2025-01-01'),
          confidenceLevel: 3,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
        {
          id: '2',
          title: 'Song 2',
          artist: 'Artist 2',
          album: 'Album 2',
          duration: 200,
          key: 'G',
          bpm: 140,
          difficulty: 4,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date('2025-01-02'),
          confidenceLevel: 4,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
      ]

      mockGetSongs.mockResolvedValue(mockSongs)

      // Act
      const result = await SongService.getAllSongs({ bandId: 'band-1' })

      // Assert
      expect(mockGetSongs).toHaveBeenCalledTimes(1)
      expect(result.songs).toEqual(mockSongs)
      expect(result.total).toBe(2)
      expect(result.filtered).toBe(2)
    })

    it('should filter songs by contextType via repository', async () => {
      // Arrange
      const mockSongs: Song[] = [
        {
          id: '1',
          title: 'Personal Song',
          artist: 'Artist 1',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 3,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 3,
          contextType: 'personal',
          contextId: 'user-1',
          createdBy: 'user-1',
          visibility: 'private',
        },
      ]

      mockGetSongs.mockResolvedValue(mockSongs)

      // Act
      const result = await SongService.getAllSongs({
        bandId: '',
        contextType: 'personal',
      })

      // Assert
      expect(mockGetSongs).toHaveBeenCalledWith(
        expect.objectContaining({ contextType: 'personal' })
      )
      expect(result.songs).toEqual(mockSongs)
    })

    it('should apply client-side search filter', async () => {
      // Arrange
      const mockSongs: Song[] = [
        {
          id: '1',
          title: 'Wonderwall',
          artist: 'Oasis',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 3,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 3,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
        {
          id: '2',
          title: 'Champagne Supernova',
          artist: 'Oasis',
          duration: 200,
          key: 'G',
          bpm: 140,
          difficulty: 4,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 4,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
      ]

      mockGetSongs.mockResolvedValue(mockSongs)

      // Act
      const result = await SongService.getAllSongs({
        bandId: 'band-1',
        search: 'wonder',
      })

      // Assert
      expect(mockGetSongs).toHaveBeenCalled()
      expect(result.songs).toHaveLength(1)
      expect(result.songs[0].title).toBe('Wonderwall')
      expect(result.filtered).toBe(1)
    })

    it('should apply client-side key filter', async () => {
      // Arrange
      const mockSongs: Song[] = [
        {
          id: '1',
          title: 'Song in C',
          artist: 'Artist',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 3,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 3,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
        {
          id: '2',
          title: 'Song in G',
          artist: 'Artist',
          duration: 200,
          key: 'G',
          bpm: 140,
          difficulty: 4,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 4,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
      ]

      mockGetSongs.mockResolvedValue(mockSongs)

      // Act
      const result = await SongService.getAllSongs({
        bandId: 'band-1',
        key: 'C',
      })

      // Assert
      expect(result.songs).toHaveLength(1)
      expect(result.songs[0].key).toBe('C')
    })

    it('should apply client-side difficulty filter', async () => {
      // Arrange
      const mockSongs: Song[] = [
        {
          id: '1',
          title: 'Easy Song',
          artist: 'Artist',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 1,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 3,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
        {
          id: '2',
          title: 'Hard Song',
          artist: 'Artist',
          duration: 200,
          key: 'G',
          bpm: 140,
          difficulty: 5,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 4,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
      ]

      mockGetSongs.mockResolvedValue(mockSongs)

      // Act
      const result = await SongService.getAllSongs({
        bandId: 'band-1',
        difficulty: 5,
      })

      // Assert
      expect(result.songs).toHaveLength(1)
      expect(result.songs[0].difficulty).toBe(5)
    })

    it('should apply client-side tags filter', async () => {
      // Arrange
      const mockSongs: Song[] = [
        {
          id: '1',
          title: 'Rock Song',
          artist: 'Artist',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 3,
          structure: [],
          chords: [],
          tags: ['rock', 'classic'],
          createdDate: new Date(),
          confidenceLevel: 3,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
        {
          id: '2',
          title: 'Jazz Song',
          artist: 'Artist',
          duration: 200,
          key: 'G',
          bpm: 140,
          difficulty: 4,
          structure: [],
          chords: [],
          tags: ['jazz', 'smooth'],
          createdDate: new Date(),
          confidenceLevel: 4,
          contextType: 'band',
          contextId: 'band-1',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
      ]

      mockGetSongs.mockResolvedValue(mockSongs)

      // Act
      const result = await SongService.getAllSongs({
        bandId: 'band-1',
        tags: ['rock'],
      })

      // Assert
      expect(result.songs).toHaveLength(1)
      expect(result.songs[0].tags).toContain('rock')
    })
  })

  describe('getPersonalSongs', () => {
    it('should get personal songs for a user via repository', async () => {
      // Arrange
      const mockSongs: Song[] = [
        {
          id: '1',
          title: 'My Personal Song',
          artist: 'Me',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 3,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 3,
          contextType: 'personal',
          contextId: 'user-123',
          createdBy: 'user-123',
          visibility: 'private',
        },
      ]

      mockGetSongs.mockResolvedValue(mockSongs)

      // Act
      const result = await SongService.getPersonalSongs('user-123')

      // Assert
      expect(mockGetSongs).toHaveBeenCalledWith(
        expect.objectContaining({
          contextType: 'personal',
          contextId: 'user-123',
        })
      )
      expect(result.songs).toEqual(mockSongs)
    })
  })

  describe('getBandSongs', () => {
    it('should get band songs for a band via repository', async () => {
      // Arrange
      const mockSongs: Song[] = [
        {
          id: '1',
          title: 'Band Song',
          artist: 'Artist',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 3,
          structure: [],
          chords: [],
          tags: [],
          createdDate: new Date(),
          confidenceLevel: 3,
          contextType: 'band',
          contextId: 'band-456',
          createdBy: 'user-1',
          visibility: 'band_only',
        },
      ]

      mockGetSongs.mockResolvedValue(mockSongs)

      // Act
      const result = await SongService.getBandSongs('band-456')

      // Assert
      expect(mockGetSongs).toHaveBeenCalledWith(
        expect.objectContaining({
          contextType: 'band',
          contextId: 'band-456',
        })
      )
      expect(result.songs).toEqual(mockSongs)
    })
  })

  describe('createSong', () => {
    it('should create song via repository', async () => {
      // Arrange
      const mockCreatedSong: Song = {
        id: 'new-song-id',
        title: 'New Song',
        artist: 'New Artist',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        structure: [],
        chords: [],
        tags: [],
        createdDate: new Date(),
        confidenceLevel: 1,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band_only',
      }

      mockAddSong.mockResolvedValue(mockCreatedSong)

      // Act
      const result = await SongService.createSong({
        title: 'New Song',
        artist: 'New Artist',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        bandId: 'band-1',
        createdBy: 'user-1',
      })

      // Assert
      expect(mockAddSong).toHaveBeenCalledTimes(1)
      expect(mockAddSong).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Song',
          artist: 'New Artist',
          contextType: 'band',
          contextId: 'band-1',
        })
      )
      expect(result).toEqual(mockCreatedSong)
    })

    it('should throw error for invalid song data', async () => {
      // Act & Assert
      await expect(
        SongService.createSong({
          title: '',
          artist: 'Artist',
          duration: 180,
          key: 'C',
          bpm: 120,
          difficulty: 3,
          bandId: 'band-1',
          createdBy: 'user-1',
        })
      ).rejects.toThrow('Song title is required')
    })

    it('should throw error for invalid BPM', async () => {
      // Act & Assert
      await expect(
        SongService.createSong({
          title: 'Song',
          artist: 'Artist',
          duration: 180,
          key: 'C',
          bpm: 500, // Invalid
          difficulty: 3,
          bandId: 'band-1',
          createdBy: 'user-1',
        })
      ).rejects.toThrow('BPM must be between 40 and 300')
    })

    it('should throw error for invalid musical key', async () => {
      // Act & Assert
      await expect(
        SongService.createSong({
          title: 'Song',
          artist: 'Artist',
          duration: 180,
          key: 'Invalid', // Invalid
          bpm: 120,
          difficulty: 3,
          bandId: 'band-1',
          createdBy: 'user-1',
        })
      ).rejects.toThrow('Invalid musical key format')
    })
  })

  describe('getSongById', () => {
    it('should get song by id via repository', async () => {
      // Arrange
      const mockSong: Song = {
        id: 'song-123',
        title: 'Specific Song',
        artist: 'Artist',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        structure: [],
        chords: [],
        tags: [],
        createdDate: new Date(),
        confidenceLevel: 3,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band_only',
      }

      ;(mockGetSongs as any).mockResolvedValue([mockSong])

      // Act
      const result = await SongService.getSongById('song-123')

      // Assert
      expect(mockGetSongs).toHaveBeenCalledWith({ id: 'song-123' })
      expect(result).toEqual(mockSong)
    })

    it('should return null for non-existent song', async () => {
      // Arrange
      mockGetSongs.mockResolvedValue([])

      // Act
      const result = await SongService.getSongById('non-existent')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('updateSong', () => {
    it('should update song via repository', async () => {
      // Arrange
      const existingSong: Song = {
        id: 'song-123',
        title: 'Original Title',
        artist: 'Artist',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        structure: [],
        chords: [],
        tags: [],
        createdDate: new Date(),
        confidenceLevel: 3,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band_only',
      }

      const updatedSong: Song = {
        ...existingSong,
        title: 'Updated Title',
      }

      mockGetSongs.mockResolvedValueOnce([existingSong])
      mockUpdateSong.mockResolvedValue(updatedSong)
      mockGetSongs.mockResolvedValueOnce([updatedSong])

      // Act
      const result = await SongService.updateSong('song-123', {
        title: 'Updated Title',
      })

      // Assert
      expect(mockUpdateSong).toHaveBeenCalledWith('song-123', {
        title: 'Updated Title',
      })
      expect(result.title).toBe('Updated Title')
    })

    it('should throw error when updating non-existent song', async () => {
      // Arrange
      mockGetSongs.mockResolvedValue([])

      // Act & Assert
      await expect(
        SongService.updateSong('non-existent', { title: 'New Title' })
      ).rejects.toThrow('Song not found')
    })
  })

  describe('deleteSong', () => {
    it('should delete song via repository', async () => {
      // Arrange
      const existingSong: Song = {
        id: 'song-123',
        title: 'Song to Delete',
        artist: 'Artist',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        structure: [],
        chords: [],
        tags: [],
        createdDate: new Date(),
        confidenceLevel: 3,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band_only',
      }

      mockGetSongs.mockResolvedValue([existingSong])
      mockGetSetlists.mockResolvedValue([]) // No setlists using this song
      mockDeleteSong.mockResolvedValue(undefined)

      // Act
      await SongService.deleteSong('song-123')

      // Assert
      expect(mockGetSetlists).toHaveBeenCalledWith('band-1')
      expect(mockDeleteSong).toHaveBeenCalledWith('song-123')
    })

    it('should throw error when song is used in setlists', async () => {
      // Arrange
      const existingSong: Song = {
        id: 'song-123',
        title: 'Song in Setlist',
        artist: 'Artist',
        duration: 180,
        key: 'C',
        bpm: 120,
        difficulty: 3,
        structure: [],
        chords: [],
        tags: [],
        createdDate: new Date(),
        confidenceLevel: 3,
        contextType: 'band',
        contextId: 'band-1',
        createdBy: 'user-1',
        visibility: 'band_only',
      }

      mockGetSongs.mockResolvedValue([existingSong])
      mockGetSetlists.mockResolvedValue([
        {
          id: 'setlist-1',
          name: 'Test Setlist',
          bandId: 'band-1',
          items: [
            { id: 'item-1', type: 'song', position: 1, songId: 'song-123' }
          ],
          totalDuration: 180,
          status: 'draft',
          createdDate: new Date(),
          lastModified: new Date()
        }
      ])

      // Act & Assert
      await expect(SongService.deleteSong('song-123')).rejects.toThrow(
        'Cannot delete song: used in setlists'
      )
    })

    it('should throw error when deleting non-existent song', async () => {
      // Arrange
      mockGetSongs.mockResolvedValue([])

      // Act & Assert
      await expect(SongService.deleteSong('non-existent')).rejects.toThrow(
        'Song not found'
      )
    })
  })
})
