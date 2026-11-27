import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { IDataRepository } from '../../../src/services/data/IDataRepository'
import type {
  BandMembership,
  InviteCode,
} from '../../../src/models/BandMembership'

// Mock the RepositoryFactory module BEFORE importing BandMembershipService
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockGetBandMemberships = vi.fn()
  const mockGetUserMemberships = vi.fn()
  const mockAddBandMembership = vi.fn()
  const mockUpdateBandMembership = vi.fn()
  const mockDeleteBandMembership = vi.fn()

  // Invite code methods (migrated to repository pattern)
  const mockGetInviteCodes = vi.fn()
  const mockGetInviteCode = vi.fn()
  const mockGetInviteCodeByCode = vi.fn()
  const mockAddInviteCode = vi.fn()
  const mockUpdateInviteCode = vi.fn()
  const mockDeleteInviteCode = vi.fn()
  const mockIncrementInviteCodeUsage = vi.fn()
  const mockPullFromRemote = vi.fn()

  const mockRepository = {
    getBandMemberships: mockGetBandMemberships,
    getUserMemberships: mockGetUserMemberships,
    addBandMembership: mockAddBandMembership,
    updateBandMembership: mockUpdateBandMembership,
    deleteBandMembership: mockDeleteBandMembership,
    getInviteCodes: mockGetInviteCodes,
    getInviteCode: mockGetInviteCode,
    getInviteCodeByCode: mockGetInviteCodeByCode,
    addInviteCode: mockAddInviteCode,
    updateInviteCode: mockUpdateInviteCode,
    deleteInviteCode: mockDeleteInviteCode,
    incrementInviteCodeUsage: mockIncrementInviteCodeUsage,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// Writes go through the phase 6 RPCs (src/services/api/bands.ts).
vi.mock('../../../src/services/api/bands', () => ({
  regenerateInviteCode: vi.fn(),
  joinBand: vi.fn(),
  leaveBand: vi.fn(),
  removeMember: vi.fn(),
  setMemberRole: vi.fn(),
  transferOwnership: vi.fn(),
}))

// membershipKey(): band_memberships id → (band_id, user_id)
const keyQuery = vi.hoisted(() => ({
  single: vi.fn(() =>
    Promise.resolve({
      data: { band_id: 'band-1', user_id: 'user-2' },
      error: null,
    })
  ),
}))
vi.mock('../../../src/services/api/client', () => ({
  api: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: keyQuery.single }) }),
    }),
  }),
}))

// Import BandMembershipService AFTER the mocks are set up
import { BandMembershipService } from '../../../src/services/BandMembershipService'
// Import the mocked repository to get access to the mock functions
import { repository } from '../../../src/services/data/RepositoryFactory'
import * as bandsApi from '../../../src/services/api/bands'
import { ApiError } from '../../../src/services/api/errors'

const api = bandsApi as unknown as Record<string, ReturnType<typeof vi.fn>>

// Extract mock functions for test assertions
const mockGetBandMemberships = repository.getBandMemberships as ReturnType<
  typeof vi.fn
>
const mockGetUserMemberships = repository.getUserMemberships as ReturnType<
  typeof vi.fn
>
const mockAddBandMembership = repository.addBandMembership as ReturnType<
  typeof vi.fn
>
const mockUpdateBandMembership = repository.updateBandMembership as ReturnType<
  typeof vi.fn
>
const mockDeleteBandMembership = repository.deleteBandMembership as ReturnType<
  typeof vi.fn
>

// Extract invite code mock functions (now in repository)
const mockGetInviteCodes = repository.getInviteCodes as ReturnType<typeof vi.fn>
const mockGetInviteCode = repository.getInviteCode as ReturnType<typeof vi.fn>
const mockGetInviteCodeByCode = repository.getInviteCodeByCode as ReturnType<
  typeof vi.fn
>
const mockAddInviteCode = repository.addInviteCode as ReturnType<typeof vi.fn>
const mockUpdateInviteCode = repository.updateInviteCode as ReturnType<
  typeof vi.fn
>
const mockDeleteInviteCode = repository.deleteInviteCode as ReturnType<
  typeof vi.fn
>
const mockIncrementInviteCodeUsage =
  repository.incrementInviteCodeUsage as ReturnType<typeof vi.fn>

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
      expect(result.every(m => m.status === 'active')).toBe(true)
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
      expect(result.every(m => m.status === 'active')).toBe(true)
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
    it('sets admin / member through set_member_role', async () => {
      await BandMembershipService.updateMembershipRole(
        'membership-123',
        'admin'
      )
      expect(api.setMemberRole).toHaveBeenCalledWith(
        'band-1',
        'user-2',
        'admin'
      )

      await BandMembershipService.updateMembershipRole(
        'membership-123',
        'member'
      )
      expect(api.setMemberRole).toHaveBeenCalledWith(
        'band-1',
        'user-2',
        'member'
      )
      expect(api.transferOwnership).not.toHaveBeenCalled()
    })

    it('owner transfers ownership in one call', async () => {
      await BandMembershipService.updateMembershipRole(
        'membership-123',
        'owner'
      )
      expect(api.transferOwnership).toHaveBeenCalledWith('band-1', 'user-2')
      expect(api.setMemberRole).not.toHaveBeenCalled()
    })

    it('never writes the membership row directly', async () => {
      await BandMembershipService.updateMembershipRole(
        'membership-123',
        'admin'
      )
      expect(mockUpdateBandMembership).not.toHaveBeenCalled()
    })
  })

  describe('removeMember', () => {
    it('removes through remove_member', async () => {
      await BandMembershipService.removeMember('membership-123')
      expect(api.removeMember).toHaveBeenCalledWith('band-1', 'user-2')
      expect(mockUpdateBandMembership).not.toHaveBeenCalled()
    })
  })

  describe('leaveBand', () => {
    it('leaves through leave_band', async () => {
      await BandMembershipService.leaveBand('user-1', 'band-1')
      expect(api.leaveBand).toHaveBeenCalledWith('band-1')
    })

    it('passes the owner refusal through', async () => {
      api.leaveBand.mockRejectedValueOnce(
        new ApiError('owner_must_transfer', 'You own Band. Transfer it first.')
      )
      await expect(
        BandMembershipService.leaveBand('user-1', 'band-1')
      ).rejects.toMatchObject({ key: 'owner_must_transfer' })
    })
  })

  describe('createInviteCode', () => {
    it('issues a fresh code through regenerate_invite_code', async () => {
      api.regenerateInviteCode.mockResolvedValue({
        id: 'ic-1',
        band_id: 'band-1',
        code: 'ABCD2345',
        created_by: 'user-1',
        created_date: '2026-11-18T10:00:00Z',
        expires_at: '2026-11-19T10:00:00Z',
        max_uses: null,
        current_uses: 0,
        is_active: true,
      })

      const result = await BandMembershipService.createInviteCode({
        bandId: 'band-1',
        createdBy: 'user-1',
      })

      expect(api.regenerateInviteCode).toHaveBeenCalledWith('band-1')
      expect(mockAddInviteCode).not.toHaveBeenCalled()
      expect(result).toMatchObject({
        code: 'ABCD2345',
        bandId: 'band-1',
        isActive: true,
        maxUses: undefined,
        expiresAt: new Date('2026-11-19T10:00:00Z'),
      })
    })
  })

  describe('getBandInviteCodes', () => {
    it('should get all invite codes for a band via repository', async () => {
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

      mockGetInviteCodes.mockResolvedValue(mockInviteCodes)

      // Act
      const result = await BandMembershipService.getBandInviteCodes('band-123')

      // Assert
      expect(mockGetInviteCodes).toHaveBeenCalledWith('band-123')
      expect(result).toEqual(mockInviteCodes)
    })
  })

  describe('joinBandWithCode', () => {
    it('joins through join_band', async () => {
      api.joinBand.mockResolvedValue({
        id: 'm-9',
        user_id: 'user-9',
        band_id: 'band-1',
        role: 'member',
        joined_date: '2026-11-18T10:00:00Z',
        status: 'active',
        permissions: ['member'],
      })

      const result = await BandMembershipService.joinBandWithCode(
        'user-9',
        'abcd2345'
      )

      expect(api.joinBand).toHaveBeenCalledWith('abcd2345')
      expect(mockAddBandMembership).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.membership).toMatchObject({
        bandId: 'band-1',
        role: 'member',
      })
    })

    it('returns the server copy for a bad or expired code', async () => {
      api.joinBand.mockRejectedValueOnce(
        new ApiError(
          'invite_invalid',
          "That code isn't valid any more. Ask for a new link."
        )
      )
      const result = await BandMembershipService.joinBandWithCode(
        'user-9',
        'NOPE'
      )
      expect(result).toEqual({
        success: false,
        error: "That code isn't valid any more. Ask for a new link.",
      })
    })

    it('returns the server copy when already a member', async () => {
      api.joinBand.mockRejectedValueOnce(
        new ApiError('already_member', "You're already in Band.")
      )
      const result = await BandMembershipService.joinBandWithCode(
        'user-9',
        'CODE'
      )
      expect(result).toEqual({
        success: false,
        error: "You're already in Band.",
      })
    })
  })

  describe('deleteInviteCode', () => {
    it('should delete invite code via repository', async () => {
      // Arrange
      mockDeleteInviteCode.mockResolvedValue(undefined)

      // Act
      await BandMembershipService.deleteInviteCode('invite-123')

      // Assert
      expect(mockDeleteInviteCode).toHaveBeenCalledTimes(1)
      expect(mockDeleteInviteCode).toHaveBeenCalledWith('invite-123')
    })
  })
})
