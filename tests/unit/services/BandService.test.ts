import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Band } from '../../../src/models/Band'
import type { Member } from '../../../src/models/Member'

// Mock the RepositoryFactory module BEFORE importing BandService
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockGetBands = vi.fn()
  const mockGetBand = vi.fn()
  const mockAddBand = vi.fn()
  const mockUpdateBand = vi.fn()
  const mockDeleteBand = vi.fn()
  const mockGetSongs = vi.fn()
  const mockGetSetlists = vi.fn()
  const mockGetPracticeSessions = vi.fn()

  const mockRepository = {
    getBands: mockGetBands,
    getBand: mockGetBand,
    addBand: mockAddBand,
    updateBand: mockUpdateBand,
    deleteBand: mockDeleteBand,
    getSongs: mockGetSongs,
    getSetlists: mockGetSetlists,
    getPracticeSessions: mockGetPracticeSessions,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// Mock the database module for member operations (not yet in repository)
vi.mock('../../../src/services/database', () => {
  const mockMembers = {
    get: vi.fn(),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        first: vi.fn(),
      })),
    })),
    add: vi.fn(),
    update: vi.fn(),
  }

  return {
    db: {
      members: mockMembers,
    },
  }
})

// Import BandService AFTER the mocks are set up
import { BandService } from '../../../src/services/BandService'
// Import the mocked repository to get access to the mock functions
import { repository } from '../../../src/services/data/RepositoryFactory'
import { db } from '../../../src/services/database'

// Extract mock functions for test assertions
const mockGetBands = repository.getBands as ReturnType<typeof vi.fn>
const mockGetBand = repository.getBand as ReturnType<typeof vi.fn>
const mockAddBand = repository.addBand as ReturnType<typeof vi.fn>
const mockUpdateBand = repository.updateBand as ReturnType<typeof vi.fn>
const mockDeleteBand = repository.deleteBand as ReturnType<typeof vi.fn>
const mockGetSongs = repository.getSongs as ReturnType<typeof vi.fn>
const mockGetSetlists = repository.getSetlists as ReturnType<typeof vi.fn>
const mockGetPracticeSessions = repository.getPracticeSessions as ReturnType<typeof vi.fn>

describe('BandService - Migrated to Repository Pattern', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  describe('getAllBands', () => {
    it('should get all bands via repository', async () => {
      // Arrange
      const mockBands: Band[] = [
        {
          id: 'band-1',
          name: 'The Rockers',
          description: 'A rock band',
          createdDate: new Date('2025-01-01'),
          settings: {
            defaultPracticeTime: 120,
            reminderMinutes: [60, 30, 10],
            autoSaveInterval: 30,
          },
          memberIds: ['member-1', 'member-2'],
        },
        {
          id: 'band-2',
          name: 'Jazz Ensemble',
          description: 'A jazz group',
          createdDate: new Date('2025-01-02'),
          settings: {
            defaultPracticeTime: 90,
            reminderMinutes: [30, 15],
            autoSaveInterval: 20,
          },
          memberIds: ['member-3'],
        },
      ]

      mockGetBands.mockResolvedValue(mockBands)

      // Act
      const result = await BandService.getAllBands()

      // Assert
      expect(mockGetBands).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockBands)
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no bands exist', async () => {
      // Arrange
      mockGetBands.mockResolvedValue([])

      // Act
      const result = await BandService.getAllBands()

      // Assert
      expect(mockGetBands).toHaveBeenCalledTimes(1)
      expect(result).toEqual([])
    })
  })

  describe('getBandById', () => {
    it('should get band by id via repository', async () => {
      // Arrange
      const mockBand: Band = {
        id: 'band-123',
        name: 'The Rockers',
        description: 'A rock band',
        createdDate: new Date('2025-01-01'),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: ['member-1'],
      }

      mockGetBand.mockResolvedValue(mockBand)

      // Act
      const result = await BandService.getBandById('band-123')

      // Assert
      expect(mockGetBand).toHaveBeenCalledWith('band-123')
      expect(result).toEqual(mockBand)
    })

    it('should return null for non-existent band', async () => {
      // Arrange
      mockGetBand.mockResolvedValue(null)

      // Act
      const result = await BandService.getBandById('non-existent')

      // Assert
      expect(mockGetBand).toHaveBeenCalledWith('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('createBand', () => {
    it('should create band via repository with default settings', async () => {
      // Arrange
      const bandData = {
        name: 'New Band',
        description: 'A new band',
      }

      // Mock no existing band with same name
      mockGetBands.mockResolvedValue([])

      const expectedBand: Band = {
        id: expect.any(String),
        name: 'New Band',
        description: 'A new band',
        createdDate: expect.any(Date),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      mockAddBand.mockResolvedValue(expectedBand as Band)

      // Act
      const result = await BandService.createBand(bandData)

      // Assert
      expect(mockGetBands).toHaveBeenCalled()
      expect(mockAddBand).toHaveBeenCalledTimes(1)
      expect(mockAddBand).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Band',
          description: 'A new band',
          settings: {
            defaultPracticeTime: 120,
            reminderMinutes: [60, 30, 10],
            autoSaveInterval: 30,
          },
          memberIds: [],
        })
      )
      expect(result).toEqual(expectedBand)
    })

    it('should create band with custom settings', async () => {
      // Arrange
      const bandData = {
        name: 'Custom Band',
        description: 'Band with custom settings',
        settings: {
          defaultPracticeTime: 90,
          reminderMinutes: [30],
        },
      }

      mockGetBands.mockResolvedValue([])

      const expectedBand: Band = {
        id: expect.any(String),
        name: 'Custom Band',
        description: 'Band with custom settings',
        createdDate: expect.any(Date),
        settings: {
          defaultPracticeTime: 90,
          reminderMinutes: [30],
          autoSaveInterval: 30, // Should merge with defaults
        },
        memberIds: [],
      }

      mockAddBand.mockResolvedValue(expectedBand as Band)

      // Act
      const result = await BandService.createBand(bandData)

      // Assert
      expect(mockAddBand).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: {
            defaultPracticeTime: 90,
            reminderMinutes: [30],
            autoSaveInterval: 30,
          },
        })
      )
      expect(result.settings.defaultPracticeTime).toBe(90)
    })

    it('should throw error for empty band name', async () => {
      // Act & Assert
      await expect(
        BandService.createBand({ name: '' })
      ).rejects.toThrow('Band name is required')

      await expect(
        BandService.createBand({ name: '   ' })
      ).rejects.toThrow('Band name is required')
    })

    it('should throw error for band name exceeding 100 characters', async () => {
      // Arrange
      const longName = 'a'.repeat(101)

      // Act & Assert
      await expect(
        BandService.createBand({ name: longName })
      ).rejects.toThrow('Band name cannot exceed 100 characters')
    })

    it('should throw error for description exceeding 500 characters', async () => {
      // Arrange
      const longDescription = 'a'.repeat(501)

      // Act & Assert
      await expect(
        BandService.createBand({
          name: 'Valid Name',
          description: longDescription,
        })
      ).rejects.toThrow('Band description cannot exceed 500 characters')
    })

    it('should throw error for duplicate band name', async () => {
      // Arrange
      const existingBands: Band[] = [
        {
          id: 'existing-band',
          name: 'Existing Band',
          createdDate: new Date(),
          settings: {
            defaultPracticeTime: 120,
            reminderMinutes: [60, 30, 10],
            autoSaveInterval: 30,
          },
          memberIds: [],
        },
      ]

      mockGetBands.mockResolvedValue(existingBands)

      // Act & Assert
      await expect(
        BandService.createBand({ name: 'Existing Band' })
      ).rejects.toThrow('Band name already exists')
    })
  })

  describe('updateBand', () => {
    it('should update band via repository', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Original Name',
        description: 'Original description',
        createdDate: new Date('2025-01-01'),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: ['member-1'],
      }

      const updatedBand: Band = {
        ...existingBand,
        name: 'Updated Name',
        description: 'Updated description',
      }

      mockGetBand.mockResolvedValueOnce(existingBand)
      mockGetBands.mockResolvedValue([]) // No duplicate name
      mockUpdateBand.mockResolvedValue(updatedBand)
      mockGetBand.mockResolvedValueOnce(updatedBand)

      // Act
      const result = await BandService.updateBand('band-123', {
        name: 'Updated Name',
        description: 'Updated description',
      })

      // Assert
      expect(mockUpdateBand).toHaveBeenCalledWith('band-123', {
        name: 'Updated Name',
        description: 'Updated description',
      })
      expect(result.name).toBe('Updated Name')
      expect(result.description).toBe('Updated description')
    })

    it('should update band settings by merging with existing settings', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Band Name',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      const updatedBand: Band = {
        ...existingBand,
        settings: {
          defaultPracticeTime: 90,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
      }

      mockGetBand.mockResolvedValueOnce(existingBand)
      mockUpdateBand.mockResolvedValue(updatedBand)
      mockGetBand.mockResolvedValueOnce(updatedBand)

      // Act
      const result = await BandService.updateBand('band-123', {
        settings: { defaultPracticeTime: 90 },
      })

      // Assert
      expect(mockUpdateBand).toHaveBeenCalledWith('band-123', {
        settings: {
          defaultPracticeTime: 90,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
      })
      expect(result.settings.defaultPracticeTime).toBe(90)
    })

    it('should throw error when updating non-existent band', async () => {
      // Arrange
      mockGetBand.mockResolvedValue(null)

      // Act & Assert
      await expect(
        BandService.updateBand('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Band not found')
    })

    it('should throw error for invalid band name', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Original Name',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      mockGetBand.mockResolvedValue(existingBand)

      // Act & Assert
      await expect(
        BandService.updateBand('band-123', { name: '' })
      ).rejects.toThrow('Band name is required')

      await expect(
        BandService.updateBand('band-123', { name: 'a'.repeat(101) })
      ).rejects.toThrow('Band name cannot exceed 100 characters')
    })

    it('should throw error for duplicate band name', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Original Name',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      const otherBand: Band = {
        id: 'band-456',
        name: 'Other Band',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      mockGetBand.mockResolvedValue(existingBand)
      mockGetBands.mockResolvedValue([otherBand])

      // Act & Assert
      await expect(
        BandService.updateBand('band-123', { name: 'Other Band' })
      ).rejects.toThrow('Band name already exists')
    })

    it('should allow updating to same name (no duplicate error)', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Same Name',
        description: 'Old description',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      const updatedBand: Band = {
        ...existingBand,
        description: 'New description',
      }

      mockGetBand.mockResolvedValueOnce(existingBand)
      mockGetBands.mockResolvedValue([existingBand]) // Same band
      mockUpdateBand.mockResolvedValue(updatedBand)
      mockGetBand.mockResolvedValueOnce(updatedBand)

      // Act
      const result = await BandService.updateBand('band-123', {
        name: 'Same Name',
        description: 'New description',
      })

      // Assert
      expect(result.description).toBe('New description')
    })
  })

  describe('deleteBand', () => {
    it('should delete band via repository when no associated data exists', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Band to Delete',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      mockGetBand.mockResolvedValue(existingBand)
      mockGetSongs.mockResolvedValue([])
      mockGetPracticeSessions.mockResolvedValue([])
      mockGetSetlists.mockResolvedValue([])
      mockDeleteBand.mockResolvedValue(undefined)

      // Act
      await BandService.deleteBand('band-123')

      // Assert
      expect(mockGetBand).toHaveBeenCalledWith('band-123')
      expect(mockGetSongs).toHaveBeenCalledWith({ contextId: 'band-123' })
      expect(mockGetPracticeSessions).toHaveBeenCalledWith('band-123')
      expect(mockGetSetlists).toHaveBeenCalledWith('band-123')
      expect(mockDeleteBand).toHaveBeenCalledWith('band-123')
    })

    it('should throw error when deleting non-existent band', async () => {
      // Arrange
      mockGetBand.mockResolvedValue(null)

      // Act & Assert
      await expect(BandService.deleteBand('non-existent')).rejects.toThrow(
        'Band not found'
      )
    })

    it('should throw error when band has associated songs', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Band with Songs',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      mockGetBand.mockResolvedValue(existingBand)
      mockGetSongs.mockResolvedValue([{ id: 'song-1' } as any])
      mockGetPracticeSessions.mockResolvedValue([])
      mockGetSetlists.mockResolvedValue([])

      // Act & Assert
      await expect(BandService.deleteBand('band-123')).rejects.toThrow(
        'Cannot delete band: has associated songs, sessions, or setlists'
      )
    })

    it('should throw error when band has associated practice sessions', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Band with Sessions',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      mockGetBand.mockResolvedValue(existingBand)
      mockGetSongs.mockResolvedValue([])
      mockGetPracticeSessions.mockResolvedValue([{ id: 'session-1' } as any])
      mockGetSetlists.mockResolvedValue([])

      // Act & Assert
      await expect(BandService.deleteBand('band-123')).rejects.toThrow(
        'Cannot delete band: has associated songs, sessions, or setlists'
      )
    })

    it('should throw error when band has associated setlists', async () => {
      // Arrange
      const existingBand: Band = {
        id: 'band-123',
        name: 'Band with Setlists',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: [],
      }

      mockGetBand.mockResolvedValue(existingBand)
      mockGetSongs.mockResolvedValue([])
      mockGetPracticeSessions.mockResolvedValue([])
      mockGetSetlists.mockResolvedValue([{ id: 'setlist-1' } as any])

      // Act & Assert
      await expect(BandService.deleteBand('band-123')).rejects.toThrow(
        'Cannot delete band: has associated songs, sessions, or setlists'
      )
    })
  })

  describe('getBandMembers', () => {
    it('should get band members from member IDs', async () => {
      // Arrange
      const mockBand: Band = {
        id: 'band-123',
        name: 'The Band',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: ['member-1', 'member-2'],
      }

      const mockMember1: Member = {
        id: 'member-1',
        name: 'John Doe',
        email: 'john@example.com',
        instruments: ['Guitar'],
        primaryInstrument: 'Guitar',
        role: 'admin',
        joinDate: new Date(),
        isActive: true,
      }

      const mockMember2: Member = {
        id: 'member-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        instruments: ['Bass'],
        primaryInstrument: 'Bass',
        role: 'member',
        joinDate: new Date(),
        isActive: true,
      }

      mockGetBand.mockResolvedValue(mockBand)
      ;(db.members.get as any)
        .mockResolvedValueOnce(mockMember1)
        .mockResolvedValueOnce(mockMember2)

      // Act
      const result = await BandService.getBandMembers('band-123')

      // Assert
      expect(mockGetBand).toHaveBeenCalledWith('band-123')
      expect(db.members.get).toHaveBeenCalledWith('member-1')
      expect(db.members.get).toHaveBeenCalledWith('member-2')
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('John Doe')
      expect(result[1].name).toBe('Jane Smith')
    })

    it('should throw error when band not found', async () => {
      // Arrange
      mockGetBand.mockResolvedValue(null)

      // Act & Assert
      await expect(BandService.getBandMembers('non-existent')).rejects.toThrow(
        'Band not found'
      )
    })

    it('should filter out null members', async () => {
      // Arrange
      const mockBand: Band = {
        id: 'band-123',
        name: 'The Band',
        createdDate: new Date(),
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30,
        },
        memberIds: ['member-1', 'non-existent'],
      }

      const mockMember1: Member = {
        id: 'member-1',
        name: 'John Doe',
        email: 'john@example.com',
        instruments: ['Guitar'],
        primaryInstrument: 'Guitar',
        role: 'admin',
        joinDate: new Date(),
        isActive: true,
      }

      mockGetBand.mockResolvedValue(mockBand)
      ;(db.members.get as any)
        .mockResolvedValueOnce(mockMember1)
        .mockResolvedValueOnce(null)

      // Act
      const result = await BandService.getBandMembers('band-123')

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('John Doe')
    })
  })
})
