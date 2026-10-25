import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useBand,
  useBandMemberships,
  useBandMembers,
  useBandInviteCodes,
  useCreateBand,
  useGenerateInviteCode,
  useRemoveBandMember,
  useUpdateMemberRole,
} from '../../../src/hooks/useBands'
import { BandService } from '../../../src/services/BandService'
import { BandMembershipService } from '../../../src/services/BandMembershipService'
import { repository } from '../../../src/services/data/RepositoryFactory'
import { getSupabaseClient } from '../../../src/services/supabase/client'
import { createQueryWrapper } from '../helpers/queryWrapper'
import type { Band } from '../../../src/models/Band'
import type {
  BandMembership,
  InviteCode,
} from '../../../src/models/BandMembership'
import type { UserProfile } from '../../../src/models/User'

// Mock Supabase client (used by createBandInSupabase + waitForMembership)
vi.mock('../../../src/services/supabase/client', () => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn(() => ({
    eq: vi.fn(() => ({
      single: mockSingle,
    })),
  }))
  const mockSelect = vi.fn(() => ({
    single: mockSingle,
    eq: mockEq,
  }))
  const mockInsert = vi.fn(() => ({
    select: mockSelect,
  }))
  const mockFrom = vi.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
  }))

  return {
    getSupabaseClient: vi.fn(() => ({
      from: mockFrom,
      _mockInsert: mockInsert,
      _mockSelect: mockSelect,
      _mockEq: mockEq,
      _mockSingle: mockSingle,
      _mockFrom: mockFrom,
    })),
  }
})

// Mock services + repository (data access now goes through repository, not db)
vi.mock('../../../src/services/BandService')
vi.mock('../../../src/services/BandMembershipService')
vi.mock('../../../src/services/data/RepositoryFactory', () => ({
  repository: {
    getUser: vi.fn(),
    getUserProfile: vi.fn(),
  },
}))

describe('useBands Hooks', () => {
  const wrapper = () => createQueryWrapper().wrapper

  const mockBand: Band = {
    id: 'band-1',
    name: 'Test Band',
    description: 'A test band',
    createdDate: new Date('2025-01-01'),
    memberIds: ['user-1', 'user-2'],
    settings: {
      defaultPracticeTime: 120,
      reminderMinutes: [60, 30, 10],
      autoSaveInterval: 30,
    },
  }

  const mockMembership: BandMembership = {
    id: 'membership-1',
    userId: 'user-1',
    bandId: 'band-1',
    role: 'admin',
    joinedDate: new Date('2025-01-01'),
    status: 'active',
    permissions: ['admin'],
  }

  const mockInviteCode: InviteCode = {
    id: 'invite-1',
    bandId: 'band-1',
    code: 'ABC123',
    createdBy: 'user-1',
    createdDate: new Date('2025-01-01'),
    currentUses: 0,
    maxUses: 10,
    isActive: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(BandMembershipService.getBandInviteCodes).mockResolvedValue([])
    vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([])
    vi.mocked(BandMembershipService.getUserBands).mockResolvedValue([])
  })

  describe('useBand Hook', () => {
    it('should return initial loading state', () => {
      const { result } = renderHook(() => useBand('band-1'), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(true)
      expect(result.current.band).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should fetch band using BandService', async () => {
      vi.mocked(BandService.getBandById).mockResolvedValue(mockBand)

      const { result } = renderHook(() => useBand('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(BandService.getBandById).toHaveBeenCalledWith('band-1')
      expect(result.current.band).toEqual(mockBand)
      expect(result.current.error).toBeNull()
    })

    it('should handle null bandId', () => {
      const { result } = renderHook(() => useBand(''), { wrapper: wrapper() })

      expect(result.current.loading).toBe(false)
      expect(result.current.band).toBeNull()
      expect(BandService.getBandById).not.toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      const mockError = new Error('Failed to fetch band')
      vi.mocked(BandService.getBandById).mockRejectedValue(mockError)

      const { result } = renderHook(() => useBand('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

      expect(result.current.band).toBeNull()
      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useBandMemberships Hook', () => {
    it('should return initial loading state', () => {
      const { result } = renderHook(() => useBandMemberships('band-1'), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(true)
      expect(result.current.memberships).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should fetch memberships using BandMembershipService', async () => {
      vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([
        mockMembership,
      ])

      const { result } = renderHook(() => useBandMemberships('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(BandMembershipService.getBandMembers).toHaveBeenCalledWith(
        'band-1'
      )
      expect(result.current.memberships).toEqual([mockMembership])
      expect(result.current.error).toBeNull()
    })

    it('should handle null bandId', () => {
      const { result } = renderHook(() => useBandMemberships(''), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.memberships).toEqual([])
      expect(BandMembershipService.getBandMembers).not.toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      const mockError = new Error('Failed to fetch memberships')
      vi.mocked(BandMembershipService.getBandMembers).mockRejectedValue(
        mockError
      )

      const { result } = renderHook(() => useBandMemberships('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

      expect(result.current.memberships).toEqual([])
      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useBandMembers Hook', () => {
    const mockUserProfile: UserProfile = {
      id: 'profile-1',
      userId: 'user-1',
      displayName: 'Test User',
      instruments: ['guitar'],
      avatarUrl: 'https://example.com/avatar.jpg',
      createdDate: new Date('2025-01-01'),
      updatedDate: new Date('2025-01-01'),
    }

    it('should return initial loading state', () => {
      const { result } = renderHook(() => useBandMembers('band-1'), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(true)
      expect(result.current.members).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should fetch members with profiles via repository', async () => {
      vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([
        mockMembership,
      ])
      vi.mocked(repository.getUser).mockResolvedValue(null)
      vi.mocked(repository.getUserProfile).mockResolvedValue(mockUserProfile)

      const { result } = renderHook(() => useBandMembers('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.members).toHaveLength(1)
      expect(result.current.members[0].membership).toEqual(mockMembership)
      expect(result.current.members[0].profile).toEqual(mockUserProfile)
    })

    it('should handle null bandId', () => {
      const { result } = renderHook(() => useBandMembers(''), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.members).toEqual([])
    })

    it('returns a stable empty array across renders while there is no data', () => {
      // BandMembersPage has an effect keyed on `members` that calls setState;
      // a fresh [] per render made it loop ("Maximum update depth exceeded").
      const { result, rerender } = renderHook(() => useBandMembers(''), {
        wrapper: wrapper(),
      })
      const first = result.current.members
      rerender()
      expect(result.current.members).toBe(first)
    })

    it('should handle errors', async () => {
      const mockError = new Error('Failed to fetch members')
      vi.mocked(BandMembershipService.getBandMembers).mockRejectedValue(
        mockError
      )

      const { result } = renderHook(() => useBandMembers('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

      expect(result.current.members).toEqual([])
      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useBandInviteCodes Hook', () => {
    it('should return initial loading state', () => {
      const { result } = renderHook(() => useBandInviteCodes('band-1'), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(true)
      expect(result.current.inviteCodes).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should fetch invite codes using BandMembershipService', async () => {
      vi.mocked(BandMembershipService.getBandInviteCodes).mockResolvedValue([
        mockInviteCode,
      ])

      const { result } = renderHook(() => useBandInviteCodes('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(BandMembershipService.getBandInviteCodes).toHaveBeenCalledWith(
        'band-1'
      )
      expect(result.current.inviteCodes).toEqual([mockInviteCode])
    })

    it('should filter for active codes only', async () => {
      const inactiveCo = { ...mockInviteCode, id: 'invite-2', isActive: false }
      vi.mocked(BandMembershipService.getBandInviteCodes).mockResolvedValue([
        mockInviteCode,
        inactiveCo,
      ])

      const { result } = renderHook(() => useBandInviteCodes('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.inviteCodes).toHaveLength(1)
      expect(result.current.inviteCodes[0].isActive).toBe(true)
    })

    it('should handle null bandId', () => {
      const { result } = renderHook(() => useBandInviteCodes(''), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.inviteCodes).toEqual([])
    })
  })

  describe('useCreateBand Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useCreateBand(), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.createBand).toBe('function')
    })

    it('should create band using Supabase', async () => {
      const bandData = { name: 'New Band', description: 'A new band' }
      const newBandId = 'band-new'

      const mockSupabaseClient = getSupabaseClient() as any
      mockSupabaseClient._mockSingle
        .mockResolvedValueOnce({
          data: {
            id: newBandId,
            name: bandData.name,
            description: bandData.description,
            created_date: new Date().toISOString(),
            member_ids: ['user-1'],
            settings: null,
          },
          error: null,
        })
        .mockResolvedValue({
          data: {
            id: 'membership-1',
            user_id: 'user-1',
            band_id: newBandId,
            role: 'admin',
            joined_date: new Date().toISOString(),
            status: 'active',
            permissions: ['admin'],
          },
          error: null,
        })

      const { result } = renderHook(() => useCreateBand(), {
        wrapper: wrapper(),
      })

      let returnedId: string | undefined
      await act(async () => {
        returnedId = await result.current.createBand(bandData, 'user-1')
      })

      expect(returnedId).toBe(newBandId)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle creation errors', async () => {
      const errorMessage = 'Database error'

      const mockSupabaseClient = getSupabaseClient() as any
      mockSupabaseClient._mockSingle.mockResolvedValue({
        data: null,
        error: { message: errorMessage },
      })

      const { result } = renderHook(() => useCreateBand(), {
        wrapper: wrapper(),
      })

      await act(async () => {
        try {
          await result.current.createBand({ name: 'Test' }, 'user-1')
        } catch {
          // Expected to throw
        }
      })

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
      expect(result.current.error).toEqual(
        new Error(`Failed to create band: ${errorMessage}`)
      )
    })
  })

  describe('useGenerateInviteCode Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useGenerateInviteCode(), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.generateCode).toBe('function')
    })

    it('should generate code using BandMembershipService', async () => {
      vi.mocked(BandMembershipService.createInviteCode).mockResolvedValue(
        mockInviteCode
      )

      const { result } = renderHook(() => useGenerateInviteCode(), {
        wrapper: wrapper(),
      })

      let code: string | undefined
      await act(async () => {
        code = await result.current.generateCode('band-1', 'user-1')
      })

      expect(BandMembershipService.createInviteCode).toHaveBeenCalledWith({
        bandId: 'band-1',
        createdBy: 'user-1',
      })
      expect(code).toBe('ABC123')
    })

    it('should handle generation errors', async () => {
      const mockError = new Error('Failed to generate code')
      vi.mocked(BandMembershipService.createInviteCode).mockRejectedValue(
        mockError
      )

      const { result } = renderHook(() => useGenerateInviteCode(), {
        wrapper: wrapper(),
      })

      await act(async () => {
        try {
          await result.current.generateCode('band-1', 'user-1')
        } catch {
          // Expected to throw
        }
      })

      await waitFor(() => expect(result.current.error).toEqual(mockError))
    })
  })

  describe('useRemoveBandMember Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useRemoveBandMember(), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.removeMember).toBe('function')
    })

    it('should remove member by updating status to inactive', async () => {
      vi.mocked(BandMembershipService.removeMember).mockResolvedValue(
        undefined as never
      )

      const { result } = renderHook(() => useRemoveBandMember(), {
        wrapper: wrapper(),
      })

      await act(async () => {
        await result.current.removeMember('membership-1')
      })

      expect(BandMembershipService.removeMember).toHaveBeenCalledWith(
        'membership-1'
      )
      expect(result.current.error).toBeNull()
    })

    it('should handle removal errors', async () => {
      const mockError = new Error('Failed to remove member')
      vi.mocked(BandMembershipService.removeMember).mockRejectedValue(mockError)

      const { result } = renderHook(() => useRemoveBandMember(), {
        wrapper: wrapper(),
      })

      await act(async () => {
        try {
          await result.current.removeMember('membership-1')
        } catch {
          // Expected to throw
        }
      })

      await waitFor(() => expect(result.current.error).toEqual(mockError))
    })
  })

  describe('useUpdateMemberRole Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useUpdateMemberRole(), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.updateRole).toBe('function')
    })

    it('should update role using BandMembershipService', async () => {
      vi.mocked(BandMembershipService.updateMembershipRole).mockResolvedValue()

      const { result } = renderHook(() => useUpdateMemberRole(), {
        wrapper: wrapper(),
      })

      await act(async () => {
        await result.current.updateRole('membership-1', 'admin')
      })

      expect(BandMembershipService.updateMembershipRole).toHaveBeenCalledWith(
        'membership-1',
        'admin'
      )
      expect(result.current.error).toBeNull()
    })

    it('should handle update errors', async () => {
      const mockError = new Error('Failed to update role')
      vi.mocked(BandMembershipService.updateMembershipRole).mockRejectedValue(
        mockError
      )

      const { result } = renderHook(() => useUpdateMemberRole(), {
        wrapper: wrapper(),
      })

      await act(async () => {
        try {
          await result.current.updateRole('membership-1', 'admin')
        } catch {
          // Expected to throw
        }
      })

      await waitFor(() => expect(result.current.error).toEqual(mockError))
    })
  })
})
