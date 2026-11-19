import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useBand,
  useBandMemberships,
  useBandMembers,
  useCreateBand,
} from '../../../src/hooks/useBands'
import { BandService } from '../../../src/services/BandService'
import { BandMembershipService } from '../../../src/services/BandMembershipService'
import { repository } from '../../../src/services/data/RepositoryFactory'
import * as bandsApi from '../../../src/services/api/bands'
import { createQueryWrapper } from '../helpers/queryWrapper'
import type { Band } from '../../../src/models/Band'
import type { BandMembership } from '../../../src/models/BandMembership'
import type { UserProfile } from '../../../src/models/User'

// Band writes are RPCs (create_band makes the owner membership + code).
vi.mock('../../../src/services/api/bands', () => ({
  createBand: vi.fn(),
  updateBandProfile: vi.fn(),
}))

// Mock services + repository (data access now goes through repository, not db)
vi.mock('../../../src/services/BandService')
vi.mock('../../../src/services/BandMembershipService')
vi.mock('../../../src/services/data/RepositoryFactory', () => ({
  repository: {
    getUser: vi.fn(),
    getUserProfile: vi.fn(),
    getBandMembersWithProfiles: vi.fn(),
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

  beforeEach(() => {
    vi.clearAllMocks()
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

    it('fetches members with user + profile in one repository call', async () => {
      const member = {
        membership: mockMembership,
        user: null,
        profile: mockUserProfile,
      }
      vi.mocked(repository.getBandMembersWithProfiles).mockResolvedValue([
        member,
      ])

      const { result } = renderHook(() => useBandMembers('band-1'), {
        wrapper: wrapper(),
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(repository.getBandMembersWithProfiles).toHaveBeenCalledTimes(1)
      expect(repository.getBandMembersWithProfiles).toHaveBeenCalledWith(
        'band-1'
      )
      // No per-member lookups (the old N+1: 1 + 2 calls per member)
      expect(repository.getUser).not.toHaveBeenCalled()
      expect(repository.getUserProfile).not.toHaveBeenCalled()
      expect(result.current.members).toEqual([member])
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
      vi.mocked(repository.getBandMembersWithProfiles).mockRejectedValue(
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

  describe('useCreateBand Hook', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useCreateBand(), {
        wrapper: wrapper(),
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.createBand).toBe('function')
    })

    it('creates the band with create_band', async () => {
      vi.mocked(bandsApi.createBand).mockResolvedValue({
        id: 'band-new',
      } as any)
      vi.mocked(bandsApi.updateBandProfile).mockResolvedValue({} as any)

      const { result } = renderHook(() => useCreateBand(), {
        wrapper: wrapper(),
      })

      let returnedId: string | undefined
      await act(async () => {
        returnedId = await result.current.createBand(
          { name: 'New Band', description: 'A new band' },
          'user-1'
        )
      })

      expect(bandsApi.createBand).toHaveBeenCalledWith('New Band')
      expect(bandsApi.updateBandProfile).toHaveBeenCalledWith('band-new', {
        description: 'A new band',
      })
      expect(returnedId).toBe('band-new')
      expect(result.current.error).toBeNull()
    })

    it('should handle creation errors', async () => {
      const failure = new Error('Give the band a name.')
      vi.mocked(bandsApi.createBand).mockRejectedValue(failure)

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

      await waitFor(() => expect(result.current.error).toEqual(failure))
    })
  })
})
