import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Setlist } from '../../../src/models/Setlist'
import type { SetlistSong } from '../../../src/types'

// Mock the RepositoryFactory module BEFORE importing SetlistService
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockGetSetlists = vi.fn()
  const mockGetSetlist = vi.fn()
  const mockAddSetlist = vi.fn()
  const mockUpdateSetlist = vi.fn()
  const mockDeleteSetlist = vi.fn()
  const mockGetSongs = vi.fn()

  const mockRepository = {
    getSetlists: mockGetSetlists,
    getSetlist: mockGetSetlist,
    addSetlist: mockAddSetlist,
    updateSetlist: mockUpdateSetlist,
    deleteSetlist: mockDeleteSetlist,
    getSongs: mockGetSongs,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// Import SetlistService AFTER the mock is set up
import { SetlistService } from '../../../src/services/SetlistService'
// Import the mocked repository to get access to the mock functions
import { repository } from '../../../src/services/data/RepositoryFactory'

// Extract mock functions for test assertions
const mockGetSetlists = repository.getSetlists as ReturnType<typeof vi.fn>
const mockGetSetlist = repository.getSetlist as ReturnType<typeof vi.fn>
const mockAddSetlist = repository.addSetlist as ReturnType<typeof vi.fn>
const mockUpdateSetlist = repository.updateSetlist as ReturnType<typeof vi.fn>
const mockDeleteSetlist = repository.deleteSetlist as ReturnType<typeof vi.fn>
const mockGetSongs = (repository as any).getSongs as ReturnType<typeof vi.fn>

describe('SetlistService - Migrated to Repository Pattern', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  describe('getSetlists', () => {
    it('should get all setlists for a band via repository', async () => {
      // Arrange
      const mockSetlists: Setlist[] = [
        {
          id: 'setlist-1',
          name: 'Summer Tour 2025',
          bandId: 'band-1',
          showDate: new Date('2025-07-01'),
          venue: 'The Venue',
          songs: [
            { songId: 'song-1', order: 1 },
            { songId: 'song-2', order: 2 },
          ],
          items: [],
          totalDuration: 360,
          status: 'draft',
          createdDate: new Date('2025-01-01'),
          lastModified: new Date('2025-01-01'),
        },
        {
          id: 'setlist-2',
          name: 'Practice Set',
          bandId: 'band-1',
          songs: [],
          items: [],
          totalDuration: 0,
          status: 'rehearsed',
          createdDate: new Date('2025-01-02'),
          lastModified: new Date('2025-01-02'),
        },
      ]

      mockGetSetlists.mockResolvedValue(mockSetlists)

      // Act
      const result = await SetlistService.getSetlists({ bandId: 'band-1' })

      // Assert
      expect(mockGetSetlists).toHaveBeenCalledWith('band-1')
      expect(result.setlists).toEqual(mockSetlists)
      expect(result.total).toBe(2)
    })

    it('should apply client-side status filter', async () => {
      // Arrange
      const mockSetlists: Setlist[] = [
        {
          id: 'setlist-1',
          name: 'Draft Setlist',
          bandId: 'band-1',
          songs: [],
          items: [],
          totalDuration: 0,
          status: 'draft',
          createdDate: new Date('2025-01-01'),
          lastModified: new Date('2025-01-01'),
        },
        {
          id: 'setlist-2',
          name: 'Rehearsed Setlist',
          bandId: 'band-1',
          songs: [],
          items: [],
          totalDuration: 0,
          status: 'rehearsed',
          createdDate: new Date('2025-01-02'),
          lastModified: new Date('2025-01-02'),
        },
        {
          id: 'setlist-3',
          name: 'Performed Setlist',
          bandId: 'band-1',
          songs: [],
          items: [],
          totalDuration: 0,
          status: 'performed',
          createdDate: new Date('2025-01-03'),
          lastModified: new Date('2025-01-03'),
        },
      ]

      mockGetSetlists.mockResolvedValue(mockSetlists)

      // Act
      const result = await SetlistService.getSetlists({
        bandId: 'band-1',
        status: 'rehearsed',
      })

      // Assert
      expect(result.setlists).toHaveLength(1)
      expect(result.setlists[0].status).toBe('rehearsed')
    })

    it('should apply client-side show date filter', async () => {
      // Arrange
      const targetDate = new Date('2025-07-01')
      const mockSetlists: Setlist[] = [
        {
          id: 'setlist-1',
          name: 'July 1st Show',
          bandId: 'band-1',
          showDate: new Date('2025-07-01'),
          songs: [],
          items: [],
          totalDuration: 0,
          status: 'draft',
          createdDate: new Date('2025-01-01'),
          lastModified: new Date('2025-01-01'),
        },
        {
          id: 'setlist-2',
          name: 'July 2nd Show',
          bandId: 'band-1',
          showDate: new Date('2025-07-02'),
          songs: [],
          items: [],
          totalDuration: 0,
          status: 'draft',
          createdDate: new Date('2025-01-02'),
          lastModified: new Date('2025-01-02'),
        },
      ]

      mockGetSetlists.mockResolvedValue(mockSetlists)

      // Act
      const result = await SetlistService.getSetlists({
        bandId: 'band-1',
        showDate: '2025-07-01',
      })

      // Assert
      expect(result.setlists).toHaveLength(1)
      expect(result.setlists[0].showDate).toEqual(targetDate)
    })

    it('should handle setlists without showDate when filtering', async () => {
      // Arrange
      const mockSetlists: Setlist[] = [
        {
          id: 'setlist-1',
          name: 'Setlist without date',
          bandId: 'band-1',
          songs: [],
          items: [],
          totalDuration: 0,
          status: 'draft',
          createdDate: new Date('2025-01-01'),
          lastModified: new Date('2025-01-01'),
        },
      ]

      mockGetSetlists.mockResolvedValue(mockSetlists)

      // Act
      const result = await SetlistService.getSetlists({
        bandId: 'band-1',
        showDate: '2025-07-01',
      })

      // Assert
      expect(result.setlists).toHaveLength(0)
    })
  })

  describe('createSetlist', () => {
    it('should create setlist via repository', async () => {
      // Arrange
      const mockCreatedSetlist: Setlist = {
        id: 'new-setlist-id',
        name: 'New Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockAddSetlist.mockResolvedValue(mockCreatedSetlist)

      // Act
      const result = await SetlistService.createSetlist({
        name: 'New Setlist',
        bandId: 'band-1',
      })

      // Assert
      expect(mockAddSetlist).toHaveBeenCalledTimes(1)
      expect(mockAddSetlist).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Setlist',
          bandId: 'band-1',
          status: 'draft',
          songs: [],
        })
      )
      expect(result).toEqual(mockCreatedSetlist)
    })

    it('should create setlist with songs', async () => {
      // Arrange
      const mockCreatedSetlist: Setlist = {
        id: 'new-setlist-id',
        name: 'Setlist with Songs',
        bandId: 'band-1',
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-2', order: 2 },
        ],
        items: [],
        totalDuration: 360,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      // Mock songs for duration calculation
      mockGetSongs.mockResolvedValue([
        { id: 'song-1', duration: 180 },
        { id: 'song-2', duration: 180 },
      ])
      mockAddSetlist.mockResolvedValue(mockCreatedSetlist)

      // Act
      const result = await SetlistService.createSetlist({
        name: 'Setlist with Songs',
        bandId: 'band-1',
        songs: ['song-1', 'song-2'],
      })

      // Assert
      expect(mockAddSetlist).toHaveBeenCalledWith(
        expect.objectContaining({
          songs: [
            { songId: 'song-1', order: 1 },
            { songId: 'song-2', order: 2 },
          ],
        })
      )
    })

    it('should throw error for empty setlist name', async () => {
      // Act & Assert
      await expect(
        SetlistService.createSetlist({
          name: '',
          bandId: 'band-1',
        })
      ).rejects.toThrow('Setlist name is required')
    })

    it('should throw error for setlist name exceeding 100 characters', async () => {
      // Act & Assert
      await expect(
        SetlistService.createSetlist({
          name: 'A'.repeat(101),
          bandId: 'band-1',
        })
      ).rejects.toThrow('Setlist name cannot exceed 100 characters')
    })

    it('should throw error for missing bandId', async () => {
      // Act & Assert
      await expect(
        SetlistService.createSetlist({
          name: 'Valid Name',
          bandId: '',
        })
      ).rejects.toThrow('Band ID is required')
    })
  })

  describe('getSetlistById', () => {
    it('should get setlist by id via repository', async () => {
      // Arrange
      const mockSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Specific Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(mockSetlist)

      // Act
      const result = await SetlistService.getSetlistById('setlist-123')

      // Assert
      expect(mockGetSetlist).toHaveBeenCalledWith('setlist-123')
      expect(result).toEqual(mockSetlist)
    })

    it('should return null for non-existent setlist', async () => {
      // Arrange
      mockGetSetlist.mockResolvedValue(null)

      // Act
      const result = await SetlistService.getSetlistById('non-existent')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('updateSetlist', () => {
    it('should update setlist via repository', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Original Name',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      const updatedSetlist: Setlist = {
        ...existingSetlist,
        name: 'Updated Name',
        lastModified: new Date('2025-01-02'),
      }

      mockGetSetlist.mockResolvedValueOnce(existingSetlist)
      mockUpdateSetlist.mockResolvedValue(updatedSetlist)
      mockGetSetlist.mockResolvedValueOnce(updatedSetlist)

      // Act
      const result = await SetlistService.updateSetlist('setlist-123', {
        name: 'Updated Name',
      })

      // Assert
      expect(mockUpdateSetlist).toHaveBeenCalledWith(
        'setlist-123',
        expect.objectContaining({
          name: 'Updated Name',
        })
      )
      expect(result.name).toBe('Updated Name')
    })

    it('should update setlist status', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      const updatedSetlist: Setlist = {
        ...existingSetlist,
        status: 'rehearsed',
      }

      mockGetSetlist.mockResolvedValueOnce(existingSetlist)
      mockUpdateSetlist.mockResolvedValue(updatedSetlist)
      mockGetSetlist.mockResolvedValueOnce(updatedSetlist)

      // Act
      const result = await SetlistService.updateSetlist('setlist-123', {
        status: 'rehearsed',
      })

      // Assert
      expect(result.status).toBe('rehearsed')
    })

    it('should throw error when updating non-existent setlist', async () => {
      // Arrange
      mockGetSetlist.mockResolvedValue(null)

      // Act & Assert
      await expect(
        SetlistService.updateSetlist('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Setlist not found')
    })

    it('should throw error for empty name update', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)

      // Act & Assert
      await expect(
        SetlistService.updateSetlist('setlist-123', { name: '' })
      ).rejects.toThrow('Setlist name cannot be empty')
    })

    it('should throw error for invalid status', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)

      // Act & Assert
      await expect(
        SetlistService.updateSetlist('setlist-123', {
          status: 'invalid' as any,
        })
      ).rejects.toThrow('Invalid setlist status')
    })
  })

  describe('deleteSetlist', () => {
    it('should delete setlist via repository', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Setlist to Delete',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)
      mockDeleteSetlist.mockResolvedValue(undefined)

      // Act
      await SetlistService.deleteSetlist('setlist-123')

      // Assert
      expect(mockDeleteSetlist).toHaveBeenCalledWith('setlist-123')
    })

    it('should throw error when deleting non-existent setlist', async () => {
      // Arrange
      mockGetSetlist.mockResolvedValue(null)

      // Act & Assert
      await expect(
        SetlistService.deleteSetlist('non-existent')
      ).rejects.toThrow('Setlist not found')
    })
  })

  describe('addSongToSetlist', () => {
    it('should add song to end of setlist', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [{ songId: 'song-1', order: 1 }],
        items: [],
        totalDuration: 180,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      const updatedSetlist: Setlist = {
        ...existingSetlist,
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-2', order: 2 },
        ],
        totalDuration: 360,
      }

      mockGetSetlist.mockResolvedValueOnce(existingSetlist)
      mockGetSongs.mockResolvedValue([{ id: 'song-2', duration: 180 }])
      mockUpdateSetlist.mockResolvedValue(updatedSetlist)
      mockGetSetlist.mockResolvedValueOnce(updatedSetlist)

      // Act
      const result = await SetlistService.addSongToSetlist('setlist-123', {
        songId: 'song-2',
      })

      // Assert
      expect(result.songs).toHaveLength(2)
      expect(result.songs[1].songId).toBe('song-2')
      expect(result.songs[1].order).toBe(2)
    })

    it('should insert song at specific position', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-2', order: 2 },
        ],
        items: [],
        totalDuration: 360,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      const updatedSetlist: Setlist = {
        ...existingSetlist,
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-3', order: 2 },
          { songId: 'song-2', order: 3 },
        ],
        totalDuration: 540,
      }

      mockGetSetlist.mockResolvedValueOnce(existingSetlist)
      mockGetSongs.mockResolvedValue([{ id: 'song-3', duration: 180 }])
      mockUpdateSetlist.mockResolvedValue(updatedSetlist)
      mockGetSetlist.mockResolvedValueOnce(updatedSetlist)

      // Act
      const result = await SetlistService.addSongToSetlist('setlist-123', {
        songId: 'song-3',
        position: 2,
      })

      // Assert
      expect(result.songs).toHaveLength(3)
      expect(result.songs[1].songId).toBe('song-3')
      expect(result.songs[1].order).toBe(2)
      expect(result.songs[2].songId).toBe('song-2')
      expect(result.songs[2].order).toBe(3)
    })

    it('should add song with custom attributes', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValueOnce(existingSetlist)
      mockGetSongs.mockResolvedValue([{ id: 'song-1', duration: 180 }])
      mockUpdateSetlist.mockResolvedValue({
        ...existingSetlist,
        songs: [
          {
            songId: 'song-1',
            order: 1,
            keyChange: 'D',
            tempoChange: 10,
            specialInstructions: 'Extended outro',
          },
        ],
      })

      // Act
      await SetlistService.addSongToSetlist('setlist-123', {
        songId: 'song-1',
        keyChange: 'D',
        tempoChange: 10,
        specialInstructions: 'Extended outro',
      })

      // Assert
      expect(mockUpdateSetlist).toHaveBeenCalledWith(
        'setlist-123',
        expect.objectContaining({
          songs: expect.arrayContaining([
            expect.objectContaining({
              keyChange: 'D',
              tempoChange: 10,
              specialInstructions: 'Extended outro',
            }),
          ]),
        })
      )
    })

    it('should throw error for invalid musical key', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)

      // Act & Assert
      await expect(
        SetlistService.addSongToSetlist('setlist-123', {
          songId: 'song-1',
          keyChange: 'Invalid',
        })
      ).rejects.toThrow('Invalid musical key format')
    })

    it('should throw error for invalid tempo change', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [],
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)

      // Act & Assert
      await expect(
        SetlistService.addSongToSetlist('setlist-123', {
          songId: 'song-1',
          tempoChange: 100,
        })
      ).rejects.toThrow('Tempo change must be between -50 and +50')
    })
  })

  describe('updateSongInSetlist', () => {
    it('should update song attributes in setlist', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-2', order: 2 },
        ],
        items: [],
        totalDuration: 360,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)
      mockUpdateSetlist.mockResolvedValue({
        ...existingSetlist,
        songs: [
          { songId: 'song-1', order: 1, keyChange: 'E', tempoChange: 5 },
          { songId: 'song-2', order: 2 },
        ],
      })

      // Act
      const result = await SetlistService.updateSongInSetlist(
        'setlist-123',
        'song-1',
        {
          keyChange: 'E',
          tempoChange: 5,
        }
      )

      // Assert
      expect(mockUpdateSetlist).toHaveBeenCalledWith(
        'setlist-123',
        expect.objectContaining({
          songs: expect.arrayContaining([
            expect.objectContaining({
              songId: 'song-1',
              keyChange: 'E',
              tempoChange: 5,
            }),
          ]),
        })
      )
    })

    it('should throw error when updating non-existent song', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [{ songId: 'song-1', order: 1 }],
        items: [],
        totalDuration: 180,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)

      // Act & Assert
      await expect(
        SetlistService.updateSongInSetlist('setlist-123', 'song-999', {
          keyChange: 'D',
        })
      ).rejects.toThrow('Song not found in setlist')
    })
  })

  describe('removeSongFromSetlist', () => {
    it('should remove song from setlist and renumber remaining songs', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-2', order: 2 },
          { songId: 'song-3', order: 3 },
        ],
        items: [],
        totalDuration: 540,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      const updatedSetlist: Setlist = {
        ...existingSetlist,
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-3', order: 2 },
        ],
        totalDuration: 360,
      }

      mockGetSetlist.mockResolvedValueOnce(existingSetlist)
      mockGetSongs.mockResolvedValue([
        { id: 'song-1', duration: 180 },
        { id: 'song-3', duration: 180 },
      ])
      mockUpdateSetlist.mockResolvedValue(updatedSetlist)
      mockGetSetlist.mockResolvedValueOnce(updatedSetlist)

      // Act
      const result = await SetlistService.removeSongFromSetlist(
        'setlist-123',
        'song-2'
      )

      // Assert
      expect(result.songs).toHaveLength(2)
      expect(result.songs[0].songId).toBe('song-1')
      expect(result.songs[0].order).toBe(1)
      expect(result.songs[1].songId).toBe('song-3')
      expect(result.songs[1].order).toBe(2)
    })

    it('should throw error when removing non-existent song', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [{ songId: 'song-1', order: 1 }],
        items: [],
        totalDuration: 180,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)

      // Act & Assert
      await expect(
        SetlistService.removeSongFromSetlist('setlist-123', 'song-999')
      ).rejects.toThrow('Song not found in setlist')
    })
  })

  describe('reorderSongs', () => {
    it('should reorder songs in setlist', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-2', order: 2 },
          { songId: 'song-3', order: 3 },
        ],
        items: [],
        totalDuration: 540,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      const updatedSetlist: Setlist = {
        ...existingSetlist,
        songs: [
          { songId: 'song-3', order: 1 },
          { songId: 'song-1', order: 2 },
          { songId: 'song-2', order: 3 },
        ],
      }

      mockGetSetlist.mockResolvedValueOnce(existingSetlist)
      mockUpdateSetlist.mockResolvedValue(updatedSetlist)
      mockGetSetlist.mockResolvedValueOnce(updatedSetlist)

      // Act
      const result = await SetlistService.reorderSongs('setlist-123', {
        songOrder: ['song-3', 'song-1', 'song-2'],
      })

      // Assert
      expect(result.songs[0].songId).toBe('song-3')
      expect(result.songs[0].order).toBe(1)
      expect(result.songs[1].songId).toBe('song-1')
      expect(result.songs[1].order).toBe(2)
      expect(result.songs[2].songId).toBe('song-2')
      expect(result.songs[2].order).toBe(3)
    })

    it('should throw error when reordering with non-existent song', async () => {
      // Arrange
      const existingSetlist: Setlist = {
        id: 'setlist-123',
        name: 'Test Setlist',
        bandId: 'band-1',
        songs: [
          { songId: 'song-1', order: 1 },
          { songId: 'song-2', order: 2 },
        ],
        items: [],
        totalDuration: 360,
        status: 'draft',
        createdDate: new Date('2025-01-01'),
        lastModified: new Date('2025-01-01'),
      }

      mockGetSetlist.mockResolvedValue(existingSetlist)

      // Act & Assert
      await expect(
        SetlistService.reorderSongs('setlist-123', {
          songOrder: ['song-1', 'song-999'],
        })
      ).rejects.toThrow('Song song-999 not found in setlist')
    })
  })
})
