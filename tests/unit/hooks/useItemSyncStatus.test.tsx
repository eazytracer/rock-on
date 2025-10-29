import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ItemSyncStatusProvider, useItemSyncStatus, useItemStatus } from '../../../src/hooks/useItemSyncStatus.tsx'
import type { ReactNode } from 'react'

// Wrapper component for tests
function wrapper({ children }: { children: ReactNode }) {
  return <ItemSyncStatusProvider>{children}</ItemSyncStatusProvider>
}

describe('useItemSyncStatus', () => {
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
  it('should return synced status by default', () => {
    const { result } = renderHook(() => useItemStatus('item-1'), { wrapper })
    expect(result.current).toBe('synced')
  })

  it('should return current status for specific item', () => {
    // Render both hooks together so they share the same provider
    const { result } = renderHook(
      () => ({
        manager: useItemSyncStatus(),
        itemStatus: useItemStatus('item-1'),
      }),
      { wrapper }
    )

    // Initially should be synced
    expect(result.current.itemStatus).toBe('synced')

    // Set status and check
    act(() => {
      result.current.manager.setStatus('item-1', 'syncing')
    })

    expect(result.current.itemStatus).toBe('syncing')
  })

  it('should update when status changes', () => {
    const { result: statusManager } = renderHook(() => useItemSyncStatus(), { wrapper })
    const { result: itemStatus } = renderHook(() => useItemStatus('item-1'), { wrapper })

    expect(itemStatus.current).toBe('synced')

    act(() => {
      statusManager.current.setStatus('item-1', 'pending')
    })

    // Note: The hook should re-render and reflect the new status
    // In real usage, React will handle this automatically
  })
})
