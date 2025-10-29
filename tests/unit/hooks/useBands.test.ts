import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useBand,
  useBandMemberships,
  useBandMembers,
  useBandInviteCodes,
  useCreateBand,
  useGenerateInviteCode,
  useRemoveBandMember,
  useUpdateMemberRole
} from '../../../src/hooks/useBands'
import { BandService } from '../../../src/services/BandService'
import { BandMembershipService } from '../../../src/services/BandMembershipService'
import { getSyncRepository } from '../../../src/services/data/SyncRepository'
import type { Band } from '../../../src/models/Band'
import type { BandMembership, InviteCode } from '../../../src/models/BandMembership'
import type { UserProfile } from '../../../src/models/User'

// Mock services
vi.mock('../../../src/services/BandService')
vi.mock('../../../src/services/BandMembershipService')
vi.mock('../../../src/services/data/SyncRepository', () => {
  const mockCallbacks = new Set<() => void>()

  const mockRepo = {
    on: vi.fn((event: string, callback: () => void) => {
      mockCallbacks.add(callback)
    }),
    off: vi.fn((event: string, callback: () => void) => {
      mockCallbacks.delete(callback)
    }),
    _triggerChange: () => {
      mockCallbacks.forEach(cb => cb())
    },
    _clearMockCallbacks: () => mockCallbacks.clear(),
  }

  return {
    SyncRepository: {
      getInstance: vi.fn(() => mockRepo),
    },
    getSyncRepository: vi.fn(() => mockRepo),
  }
})

// Mock database for user profiles and band memberships
vi.mock('../../../src/services/database', () => ({
  db: {
    userProfiles: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(),
        })),
      })),
    },
    bandMemberships: {
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

describe('useBands Hooks', () => {
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

    // Set default return values for service mocks
    vi.mocked(BandMembershipService.getBandInviteCodes).mockResolvedValue([])
    vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([])
    vi.mocked(BandMembershipService.getUserBands).mockResolvedValue([])
  })

  afterEach(() => {
    const repo = getSyncRepository() as any
    repo._clearMockCallbacks()
  })

  describe('useBand Hook', () => {
    it('should return initial loading state', () => {
      const { result } = renderHook(() => useBand('band-1'))

      expect(result.current.loading).toBe(true)
      expect(result.current.band).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should fetch band using BandService', async () => {
      vi.mocked(BandService.getBandById).mockResolvedValue(mockBand)

      const { result } = renderHook(() => useBand('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(BandService.getBandById).toHaveBeenCalledWith('band-1')
      expect(result.current.band).toEqual(mockBand)
      expect(result.current.error).toBeNull()
    })

    it('should handle null bandId', () => {
      const { result } = renderHook(() => useBand(''))

      expect(result.current.loading).toBe(false)
      expect(result.current.band).toBeNull()
      expect(BandService.getBandById).not.toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      const mockError = new Error('Failed to fetch band')
      vi.mocked(BandService.getBandById).mockRejectedValue(mockError)

      const { result } = renderHook(() => useBand('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.band).toBeNull()
      expect(result.current.error).toEqual(mockError)
    })

    it('should listen to sync events and refetch', async () => {
      vi.mocked(BandService.getBandById).mockResolvedValue(mockBand)

      const { result } = renderHook(() => useBand('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Update mock to return different data
      const updatedBand = { ...mockBand, name: 'Updated Band' }
      vi.mocked(BandService.getBandById).mockResolvedValue(updatedBand)

      // Trigger sync event
      act(() => {
        const repo = getSyncRepository() as any
        repo._triggerChange()
      })

      await waitFor(() => {
        expect(result.current.band?.name).toBe('Updated Band')
      })
    })

    it('should cleanup event listeners on unmount', () => {
      const repo = getSyncRepository()
      const { unmount } = renderHook(() => useBand('band-1'))

      unmount()

      expect(repo.off).toHaveBeenCalled()
    })
  })

  describe('useBandMemberships Hook', () => {
    it('should return initial loading state', () => {
      const { result } = renderHook(() => useBandMemberships('band-1'))

      expect(result.current.loading).toBe(true)
      expect(result.current.memberships).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should fetch memberships using BandMembershipService', async () => {
      vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([mockMembership])

      const { result } = renderHook(() => useBandMemberships('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(BandMembershipService.getBandMembers).toHaveBeenCalledWith('band-1')
      expect(result.current.memberships).toEqual([mockMembership])
      expect(result.current.error).toBeNull()
    })

    it('should handle null bandId', () => {
      const { result } = renderHook(() => useBandMemberships(''))

      expect(result.current.loading).toBe(false)
      expect(result.current.memberships).toEqual([])
      expect(BandMembershipService.getBandMembers).not.toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      const mockError = new Error('Failed to fetch memberships')
      vi.mocked(BandMembershipService.getBandMembers).mockRejectedValue(mockError)

      const { result } = renderHook(() => useBandMemberships('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.memberships).toEqual([])
      expect(result.current.error).toEqual(mockError)
    })

    it('should listen to sync events', async () => {
      vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([mockMembership])

      const { result } = renderHook(() => useBandMemberships('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const newMembership = { ...mockMembership, id: 'membership-2', userId: 'user-2' }
      vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([mockMembership, newMembership])

      act(() => {
        const repo = getSyncRepository() as any
        repo._triggerChange()
      })

      await waitFor(() => {
        expect(result.current.memberships).toHaveLength(2)
      })
    })
  })

  describe('useBandMembers Hook', () => {
    const mockUserProfile: UserProfile = {
      userId: 'user-1',
      displayName: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'https://example.com/avatar.jpg',
      createdDate: new Date('2025-01-01'),
    }

    it('should return initial loading state', () => {
      const { result } = renderHook(() => useBandMembers('band-1'))

      expect(result.current.loading).toBe(true)
      expect(result.current.members).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should fetch members with profiles', async () => {
      vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([mockMembership])

      const { db } = await import('../../../src/services/database')
      vi.mocked(db.userProfiles.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockUserProfile),
        }),
      } as any)

      const { result } = renderHook(() => useBandMembers('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.members).toHaveLength(1)
      expect(result.current.members[0].membership).toEqual(mockMembership)
      expect(result.current.members[0].profile).toEqual(mockUserProfile)
    })

    it('should handle null bandId', () => {
      const { result } = renderHook(() => useBandMembers(''))

      expect(result.current.loading).toBe(false)
      expect(result.current.members).toEqual([])
    })

    it('should handle errors', async () => {
      const mockError = new Error('Failed to fetch members')
      vi.mocked(BandMembershipService.getBandMembers).mockRejectedValue(mockError)

      const { result } = renderHook(() => useBandMembers('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.members).toEqual([])
      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useBandInviteCodes Hook', () => {
    it('should return initial loading state', () => {
      const { result } = renderHook(() => useBandInviteCodes('band-1'))

      expect(result.current.loading).toBe(true)
      expect(result.current.inviteCodes).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should fetch invite codes using BandMembershipService', async () => {
      vi.mocked(BandMembershipService.getBandInviteCodes).mockResolvedValue([mockInviteCode])

      const { result } = renderHook(() => useBandInviteCodes('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(BandMembershipService.getBandInviteCodes).toHaveBeenCalledWith('band-1')
      expect(result.current.inviteCodes).toEqual([mockInviteCode])
    })

    it('should filter for active codes only', async () => {
      const inactiveCo = { ...mockInviteCode, id: 'invite-2', isActive: false }
      vi.mocked(BandMembershipService.getBandInviteCodes).mockResolvedValue([mockInviteCode, inactiveCo])

      const { result } = renderHook(() => useBandInviteCodes('band-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should filter to only active codes
      expect(result.current.inviteCodes).toHaveLength(1)
      expect(result.current.inviteCodes[0].isActive).toBe(true)
    })

    it('should handle null bandId', () => {
      const { result } = renderHook(() => useBandInviteCodes(''))

      expect(result.current.loading).toBe(false)
      expect(result.current.inviteCodes).toEqual([])
    })
  })

  describe('useCreateBand Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useCreateBand())

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.createBand).toBe('function')
    })

    it('should create band using BandService', async () => {
      const bandData = { name: 'New Band', description: 'A new band' }
      const newBandId = 'band-new'

      vi.mocked(BandService.createBand).mockResolvedValue({ ...mockBand, id: newBandId, ...bandData })
      vi.mocked(BandMembershipService.getBandMembers).mockResolvedValue([])

      const { result } = renderHook(() => useCreateBand())

      let returnedId: string | undefined
      await act(async () => {
        returnedId = await result.current.createBand(bandData, 'user-1')
      })

      expect(BandService.createBand).toHaveBeenCalled()
      expect(returnedId).toBe(newBandId)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle creation errors', async () => {
      const mockError = new Error('Failed to create band')
      vi.mocked(BandService.createBand).mockRejectedValue(mockError)

      const { result } = renderHook(() => useCreateBand())

      await act(async () => {
        try {
          await result.current.createBand({ name: 'Test' }, 'user-1')
        } catch (err) {
          // Expected to throw
        }
      })

      expect(result.current.error).toEqual(mockError)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('useGenerateInviteCode Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useGenerateInviteCode())

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.generateCode).toBe('function')
    })

    it('should generate code using BandMembershipService', async () => {
      vi.mocked(BandMembershipService.createInviteCode).mockResolvedValue(mockInviteCode)

      const { result } = renderHook(() => useGenerateInviteCode())

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
      vi.mocked(BandMembershipService.createInviteCode).mockRejectedValue(mockError)

      const { result } = renderHook(() => useGenerateInviteCode())

      await act(async () => {
        try {
          await result.current.generateCode('band-1', 'user-1')
        } catch (err) {
          // Expected to throw
        }
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useRemoveBandMember Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useRemoveBandMember())

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.removeMember).toBe('function')
    })

    it('should remove member by updating status to inactive', async () => {
      vi.mocked(BandMembershipService.getUserBands).mockResolvedValue([mockMembership])

      const { result } = renderHook(() => useRemoveBandMember())

      await act(async () => {
        await result.current.removeMember('membership-1')
      })

      // Should update membership status, not delete
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle removal errors', async () => {
      const mockError = new Error('Failed to remove member')
      const { db } = await import('../../../src/services/database')
      vi.mocked(db.bandMemberships.update).mockRejectedValue(mockError)

      const { result } = renderHook(() => useRemoveBandMember())

      await act(async () => {
        try {
          await result.current.removeMember('membership-1')
        } catch (err) {
          // Expected to throw
        }
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateMemberRole Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useUpdateMemberRole())

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.updateRole).toBe('function')
    })

    it('should update role using BandMembershipService', async () => {
      vi.mocked(BandMembershipService.updateMembershipRole).mockResolvedValue()

      const { result } = renderHook(() => useUpdateMemberRole())

      await act(async () => {
        await result.current.updateRole('membership-1', 'admin')
      })

      expect(BandMembershipService.updateMembershipRole).toHaveBeenCalledWith('membership-1', 'admin')
      expect(result.current.loading).toBe(false)
    })

    it('should handle update errors', async () => {
      const mockError = new Error('Failed to update role')
      vi.mocked(BandMembershipService.updateMembershipRole).mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateMemberRole())

      await act(async () => {
        try {
          await result.current.updateRole('membership-1', 'admin')
        } catch (err) {
          // Expected to throw
        }
      })

      expect(result.current.error).toEqual(mockError)
    })
  })
})
