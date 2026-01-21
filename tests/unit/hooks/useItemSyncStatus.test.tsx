import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  ItemSyncStatusProvider,
  useItemSyncStatus,
  useItemStatus,
} from '../../../src/hooks/useItemSyncStatus.tsx'
import type { ReactNode } from 'react'

// Mock the database module
vi.mock('../../../src/services/database', () => ({
  db: {
    syncQueue: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([]),
        })),
      })),
      filter: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
      })),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}))

// Mock the SyncRepository module
vi.mock('../../../src/services/data/SyncRepository', () => ({
  getSyncRepository: vi.fn(() => ({
    onSyncStatusChange: vi.fn(() => vi.fn()), // Returns an unsubscribe function
  })),
}))

// Import the mocked module
import { db } from '../../../src/services/database'

// Wrapper component for tests
function wrapper({ children }: { children: ReactNode }) {
  return <ItemSyncStatusProvider>{children}</ItemSyncStatusProvider>
}

describe('useItemSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with undefined status', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })
    expect(result.current.getStatus('item-1')).toBeUndefined()
  })

  it('should set item status', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })

    act(() => {
      result.current.setStatus('item-1', 'syncing')
    })

    expect(result.current.getStatus('item-1')).toBe('syncing')
  })

  it('should update item status', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })

    act(() => {
      result.current.setStatus('item-1', 'syncing')
    })

    act(() => {
      result.current.setStatus('item-1', 'synced')
    })

    expect(result.current.getStatus('item-1')).toBe('synced')
  })

  it('should track multiple items independently', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })

    act(() => {
      result.current.setStatus('item-1', 'syncing')
      result.current.setStatus('item-2', 'pending')
      result.current.setStatus('item-3', 'synced')
    })

    expect(result.current.getStatus('item-1')).toBe('syncing')
    expect(result.current.getStatus('item-2')).toBe('pending')
    expect(result.current.getStatus('item-3')).toBe('synced')
  })

  it('should clear specific item status', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })

    act(() => {
      result.current.setStatus('item-1', 'syncing')
      result.current.setStatus('item-2', 'pending')
    })

    act(() => {
      result.current.clearStatus('item-1')
    })

    expect(result.current.getStatus('item-1')).toBeUndefined()
    expect(result.current.getStatus('item-2')).toBe('pending')
  })

  it('should clear all statuses', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })

    act(() => {
      result.current.setStatus('item-1', 'syncing')
      result.current.setStatus('item-2', 'pending')
      result.current.setStatus('item-3', 'error')
    })

    act(() => {
      result.current.clearAll()
    })

    expect(result.current.getStatus('item-1')).toBeUndefined()
    expect(result.current.getStatus('item-2')).toBeUndefined()
    expect(result.current.getStatus('item-3')).toBeUndefined()
  })

  it('should have refreshAll function', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })
    expect(typeof result.current.refreshAll).toBe('function')
  })

  it('should increment refreshCounter on refreshAll', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })
    const initialCounter = result.current.refreshCounter

    act(() => {
      result.current.refreshAll()
    })

    expect(result.current.refreshCounter).toBe(initialCounter + 1)
  })

  it('should throw error when used without provider', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = () => {}

    expect(() => {
      renderHook(() => useItemSyncStatus())
    }).toThrow('useItemSyncStatus must be used within ItemSyncStatusProvider')

    console.error = originalError
  })
})

describe('useItemStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return synced status when no queue item exists', async () => {
    // Mock empty syncQueue
    vi.mocked(db.syncQueue!.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    } as any)
    vi.mocked(db.syncQueue!.filter).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    } as any)
    vi.mocked(db.syncQueue!.toArray).mockResolvedValue([])

    const { result } = renderHook(() => useItemStatus('item-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toBe('synced')
    })
  })

  it('should return pending status when queue item is pending', async () => {
    const pendingItem = {
      id: 1,
      table: 'songs',
      operation: 'create',
      data: { id: 'item-1', title: 'Test Song' },
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
    }
    // Mock syncQueue with pending item
    vi.mocked(db.syncQueue!.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([pendingItem]),
      }),
    } as any)
    vi.mocked(db.syncQueue!.filter).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([pendingItem]),
    } as any)
    vi.mocked(db.syncQueue!.toArray).mockResolvedValue([pendingItem])

    const { result } = renderHook(() => useItemStatus('item-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toBe('pending')
    })
  })

  it('should return syncing status when queue item is syncing', async () => {
    const syncingItem = {
      id: 1,
      table: 'songs',
      operation: 'create',
      data: { id: 'item-1', title: 'Test Song' },
      timestamp: new Date(),
      status: 'syncing',
      retryCount: 0,
    }
    // Mock syncQueue with syncing item
    vi.mocked(db.syncQueue!.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([syncingItem]),
      }),
    } as any)
    vi.mocked(db.syncQueue!.filter).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([syncingItem]),
    } as any)
    vi.mocked(db.syncQueue!.toArray).mockResolvedValue([syncingItem])

    const { result } = renderHook(() => useItemStatus('item-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toBe('syncing')
    })
  })

  it('should return error status when queue item has failed', async () => {
    const failedItem = {
      id: 1,
      table: 'songs',
      operation: 'create',
      data: { id: 'item-1', title: 'Test Song' },
      timestamp: new Date(),
      status: 'failed',
      retryCount: 3,
      lastError: 'Invalid UUID',
    }
    // Mock syncQueue with failed item
    vi.mocked(db.syncQueue!.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([failedItem]),
      }),
    } as any)
    vi.mocked(db.syncQueue!.filter).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([failedItem]),
    } as any)
    vi.mocked(db.syncQueue!.toArray).mockResolvedValue([failedItem])

    const { result } = renderHook(() => useItemStatus('item-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toBe('error')
    })
  })

  it('should use the most recent queue item when multiple exist', async () => {
    const oldDate = new Date('2024-01-01')
    const newDate = new Date('2024-12-01')

    const items = [
      {
        id: 1,
        table: 'songs',
        operation: 'create',
        data: { id: 'item-1' },
        timestamp: oldDate,
        status: 'pending',
      },
      {
        id: 2,
        table: 'songs',
        operation: 'update',
        data: { id: 'item-1' },
        timestamp: newDate,
        status: 'failed',
        lastError: 'Server error',
      },
    ]

    // Mock syncQueue with multiple items (old pending, new failed)
    vi.mocked(db.syncQueue!.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(items),
      }),
    } as any)
    vi.mocked(db.syncQueue!.filter).mockReturnValue({
      toArray: vi.fn().mockResolvedValue(items),
    } as any)
    vi.mocked(db.syncQueue!.toArray).mockResolvedValue(items)

    const { result } = renderHook(() => useItemStatus('item-1'), { wrapper })

    // Should show error because the most recent item is failed
    await waitFor(() => {
      expect(result.current).toBe('error')
    })
  })

  it('should handle database errors gracefully', async () => {
    // Mock syncQueue to throw an error
    vi.mocked(db.syncQueue!.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('DB Error')),
      }),
    } as any)
    vi.mocked(db.syncQueue!.filter).mockReturnValue({
      toArray: vi.fn().mockRejectedValue(new Error('DB Error')),
    } as any)
    vi.mocked(db.syncQueue!.toArray).mockRejectedValue(new Error('DB Error'))

    // Suppress console.error and console.log for this test
    const originalError = console.error
    const originalLog = console.log
    console.error = vi.fn()
    console.log = vi.fn()

    const { result } = renderHook(() => useItemStatus('item-1'), { wrapper })

    // Should fallback to synced on error
    await waitFor(() => {
      expect(result.current).toBe('synced')
    })

    console.error = originalError
    console.log = originalLog
  })
})
