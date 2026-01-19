import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useLastActiveTime,
  formatLastActive,
} from '../../../src/hooks/useLastActiveTime'

// Mock useAuth
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { id: 'user-123' },
  })),
}))

// Mock RemoteRepository
const mockGetUserLastActiveAt = vi.fn()
const mockUpdateUserActivity = vi.fn()

vi.mock('../../../src/services/data/RemoteRepository', () => ({
  RemoteRepository: vi.fn().mockImplementation(() => ({
    getUserLastActiveAt: mockGetUserLastActiveAt,
    updateUserActivity: mockUpdateUserActivity,
  })),
}))

describe('useLastActiveTime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches last active time on mount', async () => {
    const mockDate = new Date('2026-01-15T10:00:00Z')
    mockGetUserLastActiveAt.mockResolvedValue(mockDate)

    const { result } = renderHook(() => useLastActiveTime())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.lastActiveAt).toEqual(mockDate)
    expect(result.current.error).toBeNull()
    expect(mockGetUserLastActiveAt).toHaveBeenCalledWith('user-123')
  })

  it('handles undefined last active time', async () => {
    mockGetUserLastActiveAt.mockResolvedValue(undefined)

    const { result } = renderHook(() => useLastActiveTime())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.lastActiveAt).toBeUndefined()
    expect(result.current.error).toBeNull()
  })

  it('handles fetch error gracefully', async () => {
    const mockError = new Error('Network error')
    mockGetUserLastActiveAt.mockRejectedValue(mockError)

    const { result } = renderHook(() => useLastActiveTime())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.lastActiveAt).toBeUndefined()
    expect(result.current.error).toEqual(mockError)
  })

  it('uses provided userId over currentUser', async () => {
    const mockDate = new Date('2026-01-15T10:00:00Z')
    mockGetUserLastActiveAt.mockResolvedValue(mockDate)

    const { result } = renderHook(() => useLastActiveTime('custom-user-id'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockGetUserLastActiveAt).toHaveBeenCalledWith('custom-user-id')
  })

  it('provides refresh function to refetch data', async () => {
    const mockDate1 = new Date('2026-01-15T10:00:00Z')
    const mockDate2 = new Date('2026-01-15T12:00:00Z')
    mockGetUserLastActiveAt
      .mockResolvedValueOnce(mockDate1)
      .mockResolvedValueOnce(mockDate2)

    const { result } = renderHook(() => useLastActiveTime())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.lastActiveAt).toEqual(mockDate1)

    // Trigger refresh with act() and wait for state to update
    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.lastActiveAt).toEqual(mockDate2)
    })

    expect(mockGetUserLastActiveAt).toHaveBeenCalledTimes(2)
  })
})

describe('formatLastActive', () => {
  beforeEach(() => {
    // Mock Date.now() to return a fixed time
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Never" for undefined', () => {
    expect(formatLastActive(undefined)).toBe('Never')
  })

  it('returns "Just now" for activity less than 60 seconds ago', () => {
    const date = new Date('2026-01-15T11:59:30Z') // 30 seconds ago
    expect(formatLastActive(date)).toBe('Just now')
  })

  it('returns minutes ago for activity less than 60 minutes ago', () => {
    const date5min = new Date('2026-01-15T11:55:00Z') // 5 minutes ago
    expect(formatLastActive(date5min)).toBe('5 minutes ago')

    const date1min = new Date('2026-01-15T11:59:00Z') // 1 minute ago
    expect(formatLastActive(date1min)).toBe('1 minute ago')
  })

  it('returns hours ago for activity less than 24 hours ago', () => {
    const date2hr = new Date('2026-01-15T10:00:00Z') // 2 hours ago
    expect(formatLastActive(date2hr)).toBe('2 hours ago')

    const date1hr = new Date('2026-01-15T11:00:00Z') // 1 hour ago
    expect(formatLastActive(date1hr)).toBe('1 hour ago')
  })

  it('returns "Yesterday" for activity 1 day ago', () => {
    const date = new Date('2026-01-14T12:00:00Z') // 1 day ago
    expect(formatLastActive(date)).toBe('Yesterday')
  })

  it('returns days ago for activity less than 7 days ago', () => {
    const date = new Date('2026-01-12T12:00:00Z') // 3 days ago
    expect(formatLastActive(date)).toBe('3 days ago')
  })

  it('returns formatted date for activity more than 7 days ago', () => {
    const date = new Date('2026-01-01T12:00:00Z') // 14 days ago
    const formatted = formatLastActive(date)
    // The exact format depends on locale, but should contain date parts
    expect(formatted).not.toBe('Never')
    expect(formatted).not.toContain('ago')
    expect(formatted).not.toBe('Yesterday')
  })
})
