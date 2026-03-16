/**
 * Unit tests for usePersonalSetlists hook
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePersonalSetlists } from '../../../src/hooks/useSetlists'
import { SetlistService } from '../../../src/services/SetlistService'
import type { Setlist } from '../../../src/models/Setlist'

vi.mock('../../../src/services/SetlistService', () => ({
  SetlistService: {
    getPersonalSetlists: vi.fn(),
    getSetlists: vi.fn(),
  },
}))

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ realtimeManager: null })),
}))

vi.mock('../../../src/services/database', () => ({
  db: {
    setlists: {
      filter: vi.fn(() => ({
        reverse: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
      })),
    },
  },
}))

function makePersonalSetlist(
  id: string,
  name: string,
  userId = 'user-123'
): Setlist {
  return {
    id,
    name,
    bandId: undefined,
    contextType: 'personal',
    contextId: userId,
    tags: [],
    items: [],
    totalDuration: 0,
    status: 'draft',
    createdDate: new Date(),
    lastModified: new Date(),
  }
}

describe('usePersonalSetlists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches personal setlists for the given userId', async () => {
    const mockSetlists = [
      makePersonalSetlist('s1', 'My Setlist 1'),
      makePersonalSetlist('s2', 'My Setlist 2'),
    ]
    vi.mocked(SetlistService.getPersonalSetlists).mockResolvedValue({
      setlists: mockSetlists,
      total: 2,
    })

    const { result } = renderHook(() => usePersonalSetlists('user-123'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(SetlistService.getPersonalSetlists).toHaveBeenCalledWith('user-123')
    expect(result.current.setlists).toHaveLength(2)
    expect(result.current.setlists[0].name).toBe('My Setlist 1')
    expect(result.current.error).toBeNull()
  })

  it('returns empty array when userId is empty', async () => {
    const { result } = renderHook(() => usePersonalSetlists(''))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(SetlistService.getPersonalSetlists).not.toHaveBeenCalled()
    expect(result.current.setlists).toHaveLength(0)
  })

  it('re-fetches when userId changes', async () => {
    vi.mocked(SetlistService.getPersonalSetlists)
      .mockResolvedValueOnce({
        setlists: [makePersonalSetlist('s1', 'A Setlist', 'user-a')],
        total: 1,
      })
      .mockResolvedValueOnce({
        setlists: [makePersonalSetlist('s2', 'B Setlist', 'user-b')],
        total: 1,
      })

    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) => usePersonalSetlists(userId),
      { initialProps: { userId: 'user-a' } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.setlists[0].name).toBe('A Setlist')

    rerender({ userId: 'user-b' })

    await waitFor(() => {
      expect(SetlistService.getPersonalSetlists).toHaveBeenCalledWith('user-b')
    })
  })

  it('sets error when fetch fails', async () => {
    vi.mocked(SetlistService.getPersonalSetlists).mockRejectedValue(
      new Error('Network error') as never
    )

    const { result } = renderHook(() => usePersonalSetlists('user-123'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.setlists).toHaveLength(0)
  })

  it('returned setlists all have contextType="personal"', async () => {
    vi.mocked(SetlistService.getPersonalSetlists).mockResolvedValue({
      setlists: [makePersonalSetlist('s1', 'Personal Setlist')],
      total: 1,
    })

    const { result } = renderHook(() => usePersonalSetlists('user-123'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    result.current.setlists.forEach(s => {
      expect(s.contextType).toBe('personal')
    })
  })

  it('returned setlists have no bandId', async () => {
    vi.mocked(SetlistService.getPersonalSetlists).mockResolvedValue({
      setlists: [makePersonalSetlist('s1', 'No Band Setlist')],
      total: 1,
    })

    const { result } = renderHook(() => usePersonalSetlists('user-123'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    result.current.setlists.forEach(s => {
      expect(s.bandId).toBeUndefined()
    })
  })
})
