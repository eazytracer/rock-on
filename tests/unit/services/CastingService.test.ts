import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CastingService } from '../../../src/services/CastingService'
import type {
  SongCasting,
  SongAssignment,
  AssignmentRole,
  RoleType,
} from '../../../src/models/SongCasting'

// Mock the database module
vi.mock('../../../src/services/database', () => {
  const mockSongCastings = {
    add: vi.fn(),
    get: vi.fn(),
    where: vi.fn(),
    delete: vi.fn(),
  }

  const mockSongAssignments = {
    add: vi.fn(),
    update: vi.fn(),
    where: vi.fn(),
    delete: vi.fn(),
  }

  const mockAssignmentRoles = {
    add: vi.fn(),
    where: vi.fn(),
    delete: vi.fn(),
  }

  const mockBandMemberships = {
    where: vi.fn(),
  }

  const mockSongs = {
    get: vi.fn(),
  }

  return {
    db: {
      songCastings: mockSongCastings,
      songAssignments: mockSongAssignments,
      assignmentRoles: mockAssignmentRoles,
      bandMemberships: mockBandMemberships,
      songs: mockSongs,
    },
  }
})

// Import after mock setup
import { db } from '../../../src/services/database'

describe('CastingService', () => {
  let castingService: CastingService

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
    castingService = new CastingService()
  })

  describe('createCasting', () => {
    it('should create a new casting', async () => {
      // Arrange
      const newCasting: Omit<SongCasting, 'id'> = {
        contextType: 'setlist',
        contextId: 'setlist-1',
        songId: 123,
        createdBy: 'user-1',
        createdDate: new Date('2025-01-01'),
      }

      const mockCastingId = 456
      ;(db.songCastings.add as any).mockResolvedValue(mockCastingId)

      // Act
      const result = await castingService.createCasting(newCasting)

      // Assert
      expect(db.songCastings.add).toHaveBeenCalledWith(
        expect.objectContaining({
          contextType: 'setlist',
          contextId: 'setlist-1',
          songId: 123,
          createdBy: 'user-1',
        })
      )
      expect(result).toBe(mockCastingId)
    })
  })

  describe('getCasting', () => {
    it('should get casting for a song in a specific context', async () => {
      // Arrange
      const mockCasting: SongCasting = {
        id: 1,
        contextType: 'setlist',
        contextId: 'setlist-1',
        songId: 123,
        createdBy: 'user-1',
        createdDate: new Date('2025-01-01'),
      }

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockCasting),
        }),
      }
      ;(db.songCastings.where as any).mockReturnValue(mockWhere)

      // Act
      const result = await castingService.getCasting('setlist', 'setlist-1', 123)

      // Assert
      expect(db.songCastings.where).toHaveBeenCalledWith(
        '[contextType+contextId+songId]'
      )
      expect(mockWhere.equals).toHaveBeenCalledWith(['setlist', 'setlist-1', 123])
      expect(result).toEqual(mockCasting)
    })
  })

  describe('getCastingsForContext', () => {
    it('should get all castings for a context', async () => {
      // Arrange
      const mockCastings: SongCasting[] = [
        {
          id: 1,
          contextType: 'setlist',
          contextId: 'setlist-1',
          songId: 123,
          createdBy: 'user-1',
          createdDate: new Date('2025-01-01'),
        },
        {
          id: 2,
          contextType: 'setlist',
          contextId: 'setlist-1',
          songId: 456,
          createdBy: 'user-1',
          createdDate: new Date('2025-01-02'),
        },
      ]

      const mockWhere = {
        toArray: vi.fn().mockResolvedValue(mockCastings),
      }
      ;(db.songCastings.where as any).mockReturnValue(mockWhere)

      // Act
      const result = await castingService.getCastingsForContext('setlist', 'setlist-1')

      // Assert
      expect(db.songCastings.where).toHaveBeenCalledWith({
        contextType: 'setlist',
        contextId: 'setlist-1',
      })
      expect(result).toEqual(mockCastings)
    })
  })

  describe('deleteCasting', () => {
    it('should delete a casting and all its assignments and roles', async () => {
      // Arrange
      const castingId = 1
      const mockAssignments: SongAssignment[] = [
        {
          id: 10,
          songCastingId: castingId,
          memberId: 'member-1',
          isPrimary: true,
          confidence: 4,
          addedBy: 'user-1',
          addedDate: new Date('2025-01-01'),
        },
        {
          id: 11,
          songCastingId: castingId,
          memberId: 'member-2',
          isPrimary: false,
          confidence: 3,
          addedBy: 'user-1',
          addedDate: new Date('2025-01-01'),
        },
      ]

      // Mock assignment retrieval
      const mockAssignmentWhere = {
        toArray: vi.fn().mockResolvedValue(mockAssignments),
      }
      ;(db.songAssignments.where as any).mockReturnValue(mockAssignmentWhere)

      // Mock role deletion
      const mockRoleWhere = {
        delete: vi.fn().mockResolvedValue(undefined),
      }
      ;(db.assignmentRoles.where as any).mockReturnValue(mockRoleWhere)

      // Mock assignment deletion
      mockAssignmentWhere.delete = vi.fn().mockResolvedValue(undefined)

      // Mock casting deletion
      ;(db.songCastings.delete as any).mockResolvedValue(undefined)

      // Act
      await castingService.deleteCasting(castingId)

      // Assert
      expect(db.songAssignments.where).toHaveBeenCalledWith({ songCastingId: castingId })
      expect(db.assignmentRoles.where).toHaveBeenCalledTimes(2)
      expect(db.assignmentRoles.where).toHaveBeenCalledWith({ assignmentId: 10 })
      expect(db.assignmentRoles.where).toHaveBeenCalledWith({ assignmentId: 11 })
      expect(mockAssignmentWhere.delete).toHaveBeenCalled()
      expect(db.songCastings.delete).toHaveBeenCalledWith(castingId)
    })
  })

  describe('assignMember', () => {
    it('should assign a member to a song with roles', async () => {
      // Arrange
      const songCastingId = 1
      const memberId = 'member-1'
      const roles: Omit<AssignmentRole, 'id' | 'assignmentId'>[] = [
        {
          type: 'guitar_lead' as RoleType,
          name: 'Lead Guitar',
          isPrimary: true,
        },
        {
          type: 'vocals_backing' as RoleType,
          name: 'Backing Vocals',
          isPrimary: false,
        },
      ]

      const mockAssignmentId = 100
      ;(db.songAssignments.add as any).mockResolvedValue(mockAssignmentId)
      ;(db.assignmentRoles.add as any).mockResolvedValue(1)

      // Act
      const result = await castingService.assignMember(
        songCastingId,
        memberId,
        roles,
        true,
        4,
        'Great guitarist',
        'user-1'
      )

      // Assert
      expect(db.songAssignments.add).toHaveBeenCalledWith(
        expect.objectContaining({
          songCastingId,
          memberId,
          isPrimary: true,
          confidence: 4,
          notes: 'Great guitarist',
          addedBy: 'user-1',
        })
      )
      expect(db.assignmentRoles.add).toHaveBeenCalledTimes(2)
      expect(db.assignmentRoles.add).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId: mockAssignmentId,
          type: 'guitar_lead',
          name: 'Lead Guitar',
        })
      )
      expect(result).toBe(mockAssignmentId)
    })

    it('should default addedBy to memberId if not provided', async () => {
      // Arrange
      const songCastingId = 1
      const memberId = 'member-1'
      const roles: Omit<AssignmentRole, 'id' | 'assignmentId'>[] = [
        {
          type: 'drums' as RoleType,
          name: 'Drums',
          isPrimary: true,
        },
      ]

      const mockAssignmentId = 101
      ;(db.songAssignments.add as any).mockResolvedValue(mockAssignmentId)
      ;(db.assignmentRoles.add as any).mockResolvedValue(1)

      // Act
      await castingService.assignMember(songCastingId, memberId, roles)

      // Assert
      expect(db.songAssignments.add).toHaveBeenCalledWith(
        expect.objectContaining({
          addedBy: memberId,
        })
      )
    })
  })

  describe('updateAssignment', () => {
    it('should update assignment confidence and notes', async () => {
      // Arrange
      const assignmentId = 100
      const updates = {
        confidence: 5,
        notes: 'Now excellent!',
        isPrimary: false,
      }

      ;(db.songAssignments.update as any).mockResolvedValue(undefined)

      // Act
      await castingService.updateAssignment(assignmentId, updates)

      // Assert
      expect(db.songAssignments.update).toHaveBeenCalledWith(
        assignmentId,
        expect.objectContaining({
          confidence: 5,
          notes: 'Now excellent!',
          isPrimary: false,
          updatedDate: expect.any(Date),
        })
      )
    })
  })

  describe('addRoleToAssignment', () => {
    it('should add a role to an existing assignment', async () => {
      // Arrange
      const assignmentId = 100
      const role: Omit<AssignmentRole, 'id' | 'assignmentId'> = {
        type: 'keys_piano' as RoleType,
        name: 'Piano',
        isPrimary: false,
      }

      const mockRoleId = 200
      ;(db.assignmentRoles.add as any).mockResolvedValue(mockRoleId)

      // Act
      const result = await castingService.addRoleToAssignment(assignmentId, role)

      // Assert
      expect(db.assignmentRoles.add).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId,
          type: 'keys_piano',
          name: 'Piano',
          isPrimary: false,
        })
      )
      expect(result).toBe(mockRoleId)
    })
  })

  describe('removeRoleFromAssignment', () => {
    it('should remove a role from an assignment', async () => {
      // Arrange
      const roleId = 200
      ;(db.assignmentRoles.delete as any).mockResolvedValue(undefined)

      // Act
      await castingService.removeRoleFromAssignment(roleId)

      // Assert
      expect(db.assignmentRoles.delete).toHaveBeenCalledWith(roleId)
    })
  })

  describe('getAssignments', () => {
    it('should get all assignments for a casting', async () => {
      // Arrange
      const songCastingId = 1
      const mockAssignments: SongAssignment[] = [
        {
          id: 10,
          songCastingId,
          memberId: 'member-1',
          isPrimary: true,
          confidence: 4,
          addedBy: 'user-1',
          addedDate: new Date('2025-01-01'),
        },
      ]

      const mockWhere = {
        toArray: vi.fn().mockResolvedValue(mockAssignments),
      }
      ;(db.songAssignments.where as any).mockReturnValue(mockWhere)

      // Act
      const result = await castingService.getAssignments(songCastingId)

      // Assert
      expect(db.songAssignments.where).toHaveBeenCalledWith({ songCastingId })
      expect(result).toEqual(mockAssignments)
    })
  })

  describe('getRoles', () => {
    it('should get all roles for an assignment', async () => {
      // Arrange
      const assignmentId = 10
      const mockRoles: AssignmentRole[] = [
        {
          id: 1,
          assignmentId,
          type: 'guitar_lead' as RoleType,
          name: 'Lead Guitar',
          isPrimary: true,
        },
      ]

      const mockWhere = {
        toArray: vi.fn().mockResolvedValue(mockRoles),
      }
      ;(db.assignmentRoles.where as any).mockReturnValue(mockWhere)

      // Act
      const result = await castingService.getRoles(assignmentId)

      // Assert
      expect(db.assignmentRoles.where).toHaveBeenCalledWith({ assignmentId })
      expect(result).toEqual(mockRoles)
    })
  })

  describe('unassignMember', () => {
    it('should remove a member from a casting', async () => {
      // Arrange
      const songCastingId = 1
      const memberId = 'member-1'
      const mockAssignments: SongAssignment[] = [
        {
          id: 10,
          songCastingId,
          memberId,
          isPrimary: true,
          confidence: 4,
          addedBy: 'user-1',
          addedDate: new Date('2025-01-01'),
        },
      ]

      const mockAssignmentWhere = {
        toArray: vi.fn().mockResolvedValue(mockAssignments),
      }
      ;(db.songAssignments.where as any).mockReturnValue(mockAssignmentWhere)

      const mockRoleWhere = {
        delete: vi.fn().mockResolvedValue(undefined),
      }
      ;(db.assignmentRoles.where as any).mockReturnValue(mockRoleWhere)
      ;(db.songAssignments.delete as any).mockResolvedValue(undefined)

      // Act
      await castingService.unassignMember(songCastingId, memberId)

      // Assert
      expect(db.songAssignments.where).toHaveBeenCalledWith({ songCastingId, memberId })
      expect(db.assignmentRoles.where).toHaveBeenCalledWith({ assignmentId: 10 })
      expect(mockRoleWhere.delete).toHaveBeenCalled()
      expect(db.songAssignments.delete).toHaveBeenCalledWith(10)
    })
  })

  describe('isMemberAssigned', () => {
    it('should return true when member is assigned', async () => {
      // Arrange
      const songCastingId = 1
      const memberId = 'member-1'

      const mockWhere = {
        count: vi.fn().mockResolvedValue(1),
      }
      ;(db.songAssignments.where as any).mockReturnValue(mockWhere)

      // Act
      const result = await castingService.isMemberAssigned(songCastingId, memberId)

      // Assert
      expect(db.songAssignments.where).toHaveBeenCalledWith({ songCastingId, memberId })
      expect(result).toBe(true)
    })

    it('should return false when member is not assigned', async () => {
      // Arrange
      const songCastingId = 1
      const memberId = 'member-2'

      const mockWhere = {
        count: vi.fn().mockResolvedValue(0),
      }
      ;(db.songAssignments.where as any).mockReturnValue(mockWhere)

      // Act
      const result = await castingService.isMemberAssigned(songCastingId, memberId)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getUnassignedSongs', () => {
    it('should return song IDs not in any casting', async () => {
      // Arrange
      const contextType = 'setlist'
      const contextId = 'setlist-1'
      const allSongIds = [1, 2, 3, 4, 5]

      const mockCastings: SongCasting[] = [
        {
          id: 1,
          contextType: 'setlist',
          contextId: 'setlist-1',
          songId: 2,
          createdBy: 'user-1',
          createdDate: new Date('2025-01-01'),
        },
        {
          id: 2,
          contextType: 'setlist',
          contextId: 'setlist-1',
          songId: 4,
          createdBy: 'user-1',
          createdDate: new Date('2025-01-01'),
        },
      ]

      const mockWhere = {
        toArray: vi.fn().mockResolvedValue(mockCastings),
      }
      ;(db.songCastings.where as any).mockReturnValue(mockWhere)

      // Act
      const result = await castingService.getUnassignedSongs(
        contextType,
        contextId,
        allSongIds
      )

      // Assert
      expect(result).toEqual([1, 3, 5])
    })
  })

  describe('bulkAssign', () => {
    it('should assign multiple members to a casting', async () => {
      // Arrange
      const castingId = 1
      const assignments = [
        {
          memberId: 'member-1',
          roles: [
            {
              type: 'guitar_lead' as RoleType,
              name: 'Lead Guitar',
              isPrimary: true,
            },
          ],
          isPrimary: true,
          confidence: 5,
        },
        {
          memberId: 'member-2',
          roles: [
            {
              type: 'bass' as RoleType,
              name: 'Bass',
              isPrimary: true,
            },
          ],
          isPrimary: true,
          confidence: 4,
        },
      ]

      ;(db.songAssignments.add as any).mockResolvedValue(100)
      ;(db.assignmentRoles.add as any).mockResolvedValue(1)

      // Act
      await castingService.bulkAssign(castingId, assignments, 'user-1')

      // Assert
      expect(db.songAssignments.add).toHaveBeenCalledTimes(2)
      expect(db.assignmentRoles.add).toHaveBeenCalledTimes(2)
    })
  })
})
