import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  ItemSyncStatusProvider,
  useItemSyncStatus,
  useItemStatus,
} from '../../../src/hooks/useItemSyncStatus.tsx'
import type { ReactNode } from 'react'

// Wrapper component for tests
function wrapper({ children }: { children: ReactNode }) {
  return <ItemSyncStatusProvider>{children}</ItemSyncStatusProvider>
}

describe('useItemSyncStatus (in-memory override store)', () => {
  it('initializes with undefined status for unknown items', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })
    expect(result.current.getStatus('item-1')).toBeUndefined()
  })

  it('sets and reads an item status', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })

    act(() => {
      result.current.setStatus('item-1', 'syncing')
    })

    expect(result.current.getStatus('item-1')).toBe('syncing')
  })

  it('clears a single item status', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })

    act(() => {
      result.current.setStatus('item-1', 'error')
      result.current.setStatus('item-2', 'synced')
    })
    act(() => {
      result.current.clearStatus('item-1')
    })

    expect(result.current.getStatus('item-1')).toBeUndefined()
    expect(result.current.getStatus('item-2')).toBe('synced')
  })

  it('clears all statuses', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })

    act(() => {
      result.current.setStatus('item-1', 'syncing')
      result.current.setStatus('item-2', 'error')
    })
    act(() => {
      result.current.clearAll()
    })

    expect(result.current.getStatus('item-1')).toBeUndefined()
    expect(result.current.getStatus('item-2')).toBeUndefined()
  })

  it('increments the refresh counter on refreshAll', () => {
    const { result } = renderHook(() => useItemSyncStatus(), { wrapper })
    const before = result.current.refreshCounter

    act(() => {
      result.current.refreshAll()
    })

    expect(result.current.refreshCounter).toBe(before + 1)
  })

  it('throws when used outside the provider', () => {
    // Suppress the expected React error boundary console noise
    expect(() => renderHook(() => useItemSyncStatus())).toThrow(
      /must be used within ItemSyncStatusProvider/
    )
  })
})

describe('useItemStatus', () => {
  beforeEach(() => {
    // no-op — provider state is fresh per renderHook
  })

  it("defaults to 'synced' when there is no manual override", () => {
    const { result } = renderHook(() => useItemStatus('item-1'), { wrapper })
    expect(result.current).toBe('synced')
  })

  it('reflects a manual override set via the provider', () => {
    const { result } = renderHook(
      () => {
        const store = useItemSyncStatus()
        const status = useItemStatus('item-1')
        return { store, status }
      },
      { wrapper }
    )

    expect(result.current.status).toBe('synced')

    act(() => {
      result.current.store.setStatus('item-1', 'error')
    })

    expect(result.current.status).toBe('error')
  })
})
