import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { IDataRepository } from '../../../src/services/data/IDataRepository'
import type { BandMembership, InviteCode } from '../../../src/models/BandMembership'

// Mock the RepositoryFactory module BEFORE importing BandMembershipService
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockGetBandMemberships = vi.fn()
  const mockGetUserMemberships = vi.fn()
  const mockAddBandMembership = vi.fn()
  const mockUpdateBandMembership = vi.fn()
  const mockDeleteBandMembership = vi.fn()

  const mockRepository = {
    getBandMemberships: mockGetBandMemberships,
    getUserMemberships: mockGetUserMemberships,
    addBandMembership: mockAddBandMembership,
    updateBandMembership: mockUpdateBandMembership,
    deleteBandMembership: mockDeleteBandMembership,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// Mock the database module for invite codes (not yet in repository)
vi.mock('../../../src/services/database', () => {
  const mockInviteCodesWhere = vi.fn()
  const mockInviteCodesAdd = vi.fn()
  const mockInviteCodesUpdate = vi.fn()
  const mockInviteCodesDelete = vi.fn()

  return {
    db: {
      inviteCodes: {
        where: mockInviteCodesWhere,
        add: mockInviteCodesAdd,
        update: mockInviteCodesUpdate,
        delete: mockInviteCodesDelete,
      },
      bandMemberships: {
        where: vi.fn(),
      },
    },
  }
})

// Import BandMembershipService AFTER the mocks are set up
import { BandMembershipService } from '../../../src/services/BandMembershipService'
// Import the mocked repository to get access to the mock functions
import { repository } from '../../../src/services/data/RepositoryFactory'
import { db } from '../../../src/services/database'

// Extract mock functions for test assertions
const mockGetBandMemberships = repository.getBandMemberships as ReturnType<typeof vi.fn>
const mockGetUserMemberships = repository.getUserMemberships as ReturnType<typeof vi.fn>
const mockAddBandMembership = repository.addBandMembership as ReturnType<typeof vi.fn>
const mockUpdateBandMembership = repository.updateBandMembership as ReturnType<typeof vi.fn>
const mockDeleteBandMembership = repository.deleteBandMembership as ReturnType<typeof vi.fn>

// Extract invite codes mock functions
const mockInviteCodesWhere = db.inviteCodes.where as ReturnType<typeof vi.fn>
const mockInviteCodesAdd = db.inviteCodes.add as ReturnType<typeof vi.fn>
const mockInviteCodesUpdate = db.inviteCodes.update as ReturnType<typeof vi.fn>
const mockInviteCodesDelete = db.inviteCodes.delete as ReturnType<typeof vi.fn>
const mockBandMembershipsWhere = db.bandMemberships.where as ReturnType<typeof vi.fn>

describe('BandMembershipService - Migrated to Repository Pattern', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  describe('getUserBands', () => {
    it('should get all active bands for a user via repository', async () => {
      // Arrange
      const mockMemberships: BandMembership[] = [
        {
          id: '1',
          userId: 'user-123',
          bandId: 'band-1',
          role: 'admin',
          joinedDate: new Date('2025-01-01'),
          status: 'active',
          permissions: ['admin'],
        },
        {
          id: '2',
          userId: 'user-123',
          bandId: 'band-2',
          role: 'member',
          joinedDate: new Date('2025-01-02'),
          status: 'active',
          permissions: ['member'],
        },
        {
          id: '3',
          userId: 'user-123',
          bandId: 'band-3',
          role: 'member',
          joinedDate: new Date('2025-01-03'),
          status: 'inactive',
          permissions: ['member'],
        },
      ]

      mockGetUserMemberships.mockResolvedValue(mockMemberships)

      // Act
      const result = await BandMembershipService.getUserBands('user-123')

      // Assert
      expect(mockGetUserMemberships).toHaveBeenCalledTimes(1)
      expect(mockGetUserMemberships).toHaveBeenCalledWith('user-123')
      // Should only return active memberships (client-side filter)
      expect(result).toHaveLength(2)
      expect(result.every((m) => m.status === 'active')).toBe(true)
    })

    it('should return empty array when user has no bands', async () => {
      // Arrange
      mockGetUserMemberships.mockResolvedValue([])

      // Act
      const result = await BandMembershipService.getUserBands('user-456')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('getBandMembers', () => {
    it('should get all active members of a band via repository', async () => {
      // Arrange
      const mockMemberships: BandMembership[] = [
        {
          id: '1',
          userId: 'user-1',
          bandId: 'band-123',
          role: 'admin',
          joinedDate: new Date('2025-01-01'),
          status: 'active',
          permissions: ['admin'],
        },
        {
          id: '2',
          userId: 'user-2',
          bandId: 'band-123',
          role: 'member',
          joinedDate: new Date('2025-01-02'),
          status: 'active',
          permissions: ['member'],
        },
        {
          id: '3',
          userId: 'user-3',
          bandId: 'band-123',
          role: 'member',
          joinedDate: new Date('2025-01-03'),
          status: 'inactive',
          permissions: ['member'],
        },
      ]

      mockGetBandMemberships.mockResolvedValue(mockMemberships)

      // Act
      const result = await BandMembershipService.getBandMembers('band-123')

      // Assert
      expect(mockGetBandMemberships).toHaveBeenCalledTimes(1)
      expect(mockGetBandMemberships).toHaveBeenCalledWith('band-123')
      // Should only return active memberships (client-side filter)
      expect(result).toHaveLength(2)
      expect(result.every((m) => m.status === 'active')).toBe(true)
    })

    it('should return empty array when band has no members', async () => {
      // Arrange
      mockGetBandMemberships.mockResolvedValue([])

      // Act
      const result = await BandMembershipService.getBandMembers('band-empty')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('updateMembershipRole', () => {
    it('should update membership role via repository', async () => {
      // Arrange
      const updatedMembership: BandMembership = {
        id: 'membership-123',
        userId: 'user-1',
        bandId: 'band-1',
        role: 'admin',
        joinedDate: new Date(),
        status: 'active',
        permissions: ['admin'],
      }

      mockUpdateBandMembership.mockResolvedValue(updatedMembership)

      // Act
      await BandMembershipService.updateMembershipRole('membership-123', 'admin')

      // Assert
      expect(mockUpdateBandMembership).toHaveBeenCalledTimes(1)
      expect(mockUpdateBandMembership).toHaveBeenCalledWith('membership-123', {
        role: 'admin',
      })
    })

    it('should update role to member', async () => {
      // Arrange
      mockUpdateBandMembership.mockResolvedValue({} as any)

      // Act
      await BandMembershipService.updateMembershipRole('membership-123', 'member')

      // Assert
      expect(mockUpdateBandMembership).toHaveBeenCalledWith('membership-123', {
        role: 'member',
      })
    })

    it('should update role to viewer', async () => {
      // Arrange
      mockUpdateBandMembership.mockResolvedValue({} as any)

      // Act
      await BandMembershipService.updateMembershipRole('membership-123', 'viewer')

      // Assert
      expect(mockUpdateBandMembership).toHaveBeenCalledWith('membership-123', {
        role: 'viewer',
      })
    })
  })

  describe('leaveBand', () => {
    it('should mark membership as inactive via repository', async () => {
      // Arrange
      const mockMembership: BandMembership = {
        id: 'membership-123',
        userId: 'user-1',
        bandId: 'band-1',
        role: 'member',
        joinedDate: new Date(),
        status: 'active',
        permissions: ['member'],
      }

      const mockAllMembers: BandMembership[] = [
        mockMembership,
        {
          id: 'membership-456',
          userId: 'user-2',
          bandId: 'band-1',
          role: 'admin',
          joinedDate: new Date(),
          status: 'active',
          permissions: ['admin'],
        },
      ]

      mockGetBandMemberships.mockResolvedValue(mockAllMembers)
      mockGetUserMemberships.mockResolvedValue([mockMembership])
      mockUpdateBandMembership.mockResolvedValue({
        ...mockMembership,
        status: 'inactive',
      })

      // Act
      await BandMembershipService.leaveBand('user-1', 'band-1')

      // Assert
      expect(mockUpdateBandMembership).toHaveBeenCalledWith('membership-123', {
        status: 'inactive',
      })
    })

    it('should throw error if membership not found', async () => {
      // Arrange
      mockGetUserMemberships.mockResolvedValue([])

      // Act & Assert
      await expect(
        BandMembershipService.leaveBand('user-999', 'band-1')
      ).rejects.toThrow('Membership not found')
    })

    it('should throw error if user is last admin', async () => {
      // Arrange
      const mockMembership: BandMembership = {
        id: 'membership-123',
        userId: 'user-1',
        bandId: 'band-1',
        role: 'admin',
        joinedDate: new Date(),
        status: 'active',
        permissions: ['admin'],
      }

      const mockAllMembers: BandMembership[] = [
        mockMembership,
        {
          id: 'membership-456',
          userId: 'user-2',
          bandId: 'band-1',
          role: 'member',
          joinedDate: new Date(),
          status: 'active',
          permissions: ['member'],
        },
      ]

      mockGetUserMemberships.mockResolvedValue([mockMembership])
      mockGetBandMemberships.mockResolvedValue(mockAllMembers)

      // Act & Assert
      await expect(
        BandMembershipService.leaveBand('user-1', 'band-1')
      ).rejects.toThrow('Cannot leave: you are the last admin')
    })

    it('should allow admin to leave if there are other admins', async () => {
      // Arrange
      const mockMembership: BandMembership = {
        id: 'membership-123',
        userId: 'user-1',
        bandId: 'band-1',
        role: 'admin',
        joinedDate: new Date(),
        status: 'active',
        permissions: ['admin'],
      }

      const mockAllMembers: BandMembership[] = [
        mockMembership,
        {
          id: 'membership-456',
          userId: 'user-2',
          bandId: 'band-1',
          role: 'admin',
          joinedDate: new Date(),
          status: 'active',
          permissions: ['admin'],
        },
      ]

      mockGetUserMemberships.mockResolvedValue([mockMembership])
      mockGetBandMemberships.mockResolvedValue(mockAllMembers)
      mockUpdateBandMembership.mockResolvedValue({
        ...mockMembership,
        status: 'inactive',
      })

      // Act
      await BandMembershipService.leaveBand('user-1', 'band-1')

      // Assert
      expect(mockUpdateBandMembership).toHaveBeenCalledWith('membership-123', {
        status: 'inactive',
      })
    })
  })

  describe('createInviteCode', () => {
    it('should create invite code via database (not yet in repository)', async () => {
      // Arrange
      const request = {
        bandId: 'band-123',
        createdBy: 'user-1',
        maxUses: 10,
      }

      // Mock code doesn't exist
      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      })

      mockInviteCodesAdd.mockResolvedValue('invite-id')

      // Act
      const result = await BandMembershipService.createInviteCode(request)

      // Assert
      expect(mockInviteCodesAdd).toHaveBeenCalledTimes(1)
      expect(result.bandId).toBe('band-123')
      expect(result.createdBy).toBe('user-1')
      expect(result.maxUses).toBe(10)
      expect(result.currentUses).toBe(0)
      expect(result.code).toHaveLength(6)
    })

    it('should retry if generated code already exists', async () => {
      // Arrange
      const request = {
        bandId: 'band-123',
        createdBy: 'user-1',
      }

      // First call: code exists, second call: code doesn't exist
      mockInviteCodesWhere
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ id: 'existing', code: 'ABC123' }),
          }),
        })
        .mockReturnValueOnce({
          equals: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        })

      mockInviteCodesAdd.mockResolvedValue('invite-id')

      // Act
      const result = await BandMembershipService.createInviteCode(request)

      // Assert
      expect(mockInviteCodesWhere).toHaveBeenCalledTimes(2)
      expect(mockInviteCodesAdd).toHaveBeenCalledTimes(1)
    })

    it('should use default maxUses of 10 if not provided', async () => {
      // Arrange
      const request = {
        bandId: 'band-123',
        createdBy: 'user-1',
      }

      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      })

      mockInviteCodesAdd.mockResolvedValue('invite-id')

      // Act
      const result = await BandMembershipService.createInviteCode(request)

      // Assert
      expect(result.maxUses).toBe(10)
    })
  })

  describe('getBandInviteCodes', () => {
    it('should get all invite codes for a band via database', async () => {
      // Arrange
      const mockInviteCodes: InviteCode[] = [
        {
          id: '1',
          bandId: 'band-123',
          code: 'ABC123',
          createdBy: 'user-1',
          expiresAt: new Date('2025-12-31'),
          maxUses: 10,
          currentUses: 3,
          createdDate: new Date('2025-01-01'),
          isActive: true,
        },
        {
          id: '2',
          bandId: 'band-123',
          code: 'XYZ789',
          createdBy: 'user-2',
          maxUses: 5,
          currentUses: 2,
          createdDate: new Date('2025-01-02'),
          isActive: true,
        },
      ]

      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockInviteCodes),
        }),
      })

      // Act
      const result = await BandMembershipService.getBandInviteCodes('band-123')

      // Assert
      expect(mockInviteCodesWhere).toHaveBeenCalledWith('bandId')
      expect(result).toEqual(mockInviteCodes)
    })
  })

  describe('validateInviteCode', () => {
    it('should validate a valid invite code', async () => {
      // Arrange
      const mockInviteCode: InviteCode = {
        id: '1',
        bandId: 'band-123',
        code: 'ABC123',
        createdBy: 'user-1',
        expiresAt: new Date('2099-12-31'),
        maxUses: 10,
        currentUses: 3,
        createdDate: new Date('2025-01-01'),
        isActive: true,
      }

      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockInviteCode),
        }),
      })

      // Act
      const result = await BandMembershipService.validateInviteCode('ABC123')

      // Assert
      expect(result.valid).toBe(true)
      expect(result.inviteCode).toEqual(mockInviteCode)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid invite code', async () => {
      // Arrange
      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      })

      // Act
      const result = await BandMembershipService.validateInviteCode('INVALID')

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid invite code')
    })

    it('should reject expired invite code', async () => {
      // Arrange
      const mockInviteCode: InviteCode = {
        id: '1',
        bandId: 'band-123',
        code: 'ABC123',
        createdBy: 'user-1',
        expiresAt: new Date('2020-01-01'), // Expired
        maxUses: 10,
        currentUses: 3,
        createdDate: new Date('2025-01-01'),
        isActive: true,
      }

      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockInviteCode),
        }),
      })

      // Act
      const result = await BandMembershipService.validateInviteCode('ABC123')

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invite code has expired')
    })

    it('should reject invite code at max uses', async () => {
      // Arrange
      const mockInviteCode: InviteCode = {
        id: '1',
        bandId: 'band-123',
        code: 'ABC123',
        createdBy: 'user-1',
        maxUses: 10,
        currentUses: 10, // At max uses
        createdDate: new Date('2025-01-01'),
        isActive: true,
      }

      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockInviteCode),
        }),
      })

      // Act
      const result = await BandMembershipService.validateInviteCode('ABC123')

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invite code has reached maximum uses')
    })

    it('should convert code to uppercase', async () => {
      // Arrange
      const mockInviteCode: InviteCode = {
        id: '1',
        bandId: 'band-123',
        code: 'ABC123',
        createdBy: 'user-1',
        expiresAt: new Date('2099-12-31'),
        maxUses: 10,
        currentUses: 3,
        createdDate: new Date('2025-01-01'),
        isActive: true,
      }

      const mockEquals = vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(mockInviteCode),
      })

      mockInviteCodesWhere.mockReturnValue({
        equals: mockEquals,
      })

      // Act
      await BandMembershipService.validateInviteCode('abc123')

      // Assert
      expect(mockEquals).toHaveBeenCalledWith('ABC123')
    })
  })

  describe('joinBandWithCode', () => {
    it('should join band with valid code via repository', async () => {
      // Arrange
      const mockInviteCode: InviteCode = {
        id: 'invite-1',
        bandId: 'band-123',
        code: 'ABC123',
        createdBy: 'user-1',
        expiresAt: new Date('2099-12-31'),
        maxUses: 10,
        currentUses: 3,
        createdDate: new Date('2025-01-01'),
        isActive: true,
      }

      // Mock validateInviteCode
      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockInviteCode),
        }),
      })

      // Mock no existing membership via repository
      mockGetUserMemberships.mockResolvedValue([])

      const newMembership: BandMembership = {
        id: 'membership-new',
        userId: 'user-999',
        bandId: 'band-123',
        role: 'member',
        joinedDate: new Date(),
        status: 'active',
        permissions: ['member'],
      }

      mockAddBandMembership.mockResolvedValue(newMembership)
      mockInviteCodesUpdate.mockResolvedValue(undefined)

      // Act
      const result = await BandMembershipService.joinBandWithCode('user-999', 'ABC123')

      // Assert
      expect(result.success).toBe(true)
      expect(result.membership).toMatchObject({
        userId: 'user-999',
        bandId: 'band-123',
        role: 'member',
        status: 'active',
        permissions: ['member'],
      })
      expect(result.membership?.id).toBeDefined()
      expect(mockAddBandMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-999',
          bandId: 'band-123',
          role: 'member',
          status: 'active',
        })
      )
      expect(mockInviteCodesUpdate).toHaveBeenCalledWith('invite-1', {
        currentUses: 4,
      })
    })

    it('should reject if code is invalid', async () => {
      // Arrange
      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      })

      // Act
      const result = await BandMembershipService.joinBandWithCode('user-999', 'INVALID')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid invite code')
    })

    it('should reject if user is already a member', async () => {
      // Arrange
      const mockInviteCode: InviteCode = {
        id: 'invite-1',
        bandId: 'band-123',
        code: 'ABC123',
        createdBy: 'user-1',
        expiresAt: new Date('2099-12-31'),
        maxUses: 10,
        currentUses: 3,
        createdDate: new Date('2025-01-01'),
        isActive: true,
      }

      mockInviteCodesWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockInviteCode),
        }),
      })

      // Mock existing membership via repository
      mockGetUserMemberships.mockResolvedValue([
        {
          id: 'existing',
          userId: 'user-999',
          bandId: 'band-123',
          role: 'member',
          joinedDate: new Date(),
          status: 'active',
          permissions: ['member'],
        },
      ])

      // Act
      const result = await BandMembershipService.joinBandWithCode('user-999', 'ABC123')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('You are already a member of this band')
    })
  })

  describe('deleteInviteCode', () => {
    it('should delete invite code via database', async () => {
      // Arrange
      mockInviteCodesDelete.mockResolvedValue(undefined)

      // Act
      await BandMembershipService.deleteInviteCode('invite-123')

      // Assert
      expect(mockInviteCodesDelete).toHaveBeenCalledTimes(1)
      expect(mockInviteCodesDelete).toHaveBeenCalledWith('invite-123')
    })
  })
})
