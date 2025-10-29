import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatusIndicator } from '../../../src/components/sync/SyncStatusIndicator'
import * as useSyncStatusModule from '../../../src/hooks/useSyncStatus'

// Mock the useSyncStatus hook
vi.mock('../../../src/hooks/useSyncStatus')

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render syncing state with spinner', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: true,
      lastSyncTime: null,
      pendingCount: 0,
      isOnline: true,
      syncError: null,
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    expect(screen.getByText(/syncing/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should render synced state with last sync time', () => {
    const lastSyncTime = new Date('2025-10-25T12:00:00Z')
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: false,
      lastSyncTime: lastSyncTime,
      pendingCount: 0,
      isOnline: true,
      syncError: null,
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    expect(screen.getByText(/synced/i)).toBeInTheDocument()
    expect(screen.queryByText(/syncing/i)).not.toBeInTheDocument()
  })

  it('should render offline state with indicator', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: false,
      lastSyncTime: null,
      pendingCount: 0,
      isOnline: false,
      syncError: null,
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    expect(screen.getByText(/offline/i)).toBeInTheDocument()
    const indicator = screen.getByTestId('connection-indicator')
    expect(indicator).toHaveClass('bg-red-500')
  })

  it('should render online indicator when connected', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: false,
      lastSyncTime: new Date(),
      pendingCount: 0,
      isOnline: true,
      syncError: null,
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    const indicator = screen.getByTestId('connection-indicator')
    expect(indicator).toHaveClass('bg-green-500')
  })

  it('should show pending changes count when > 0', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: false,
      lastSyncTime: new Date(),
      pendingCount: 5,
      isOnline: false,
      syncError: null,
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    expect(screen.getByText(/5 changes pending/i)).toBeInTheDocument()
  })

  it('should show error state with error message', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: false,
      lastSyncTime: null,
      pendingCount: 0,
      isOnline: true,
      syncError: 'Network timeout',
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    expect(screen.getByText(/sync failed/i)).toBeInTheDocument()
    expect(screen.getByText(/network timeout/i)).toBeInTheDocument()
  })

  it('should show warning icon when there is an error', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: false,
      lastSyncTime: null,
      pendingCount: 0,
      isOnline: true,
      syncError: 'Sync error',
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    expect(screen.getByTestId('error-icon')).toBeInTheDocument()
  })

  it('should have proper ARIA labels for accessibility', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: true,
      lastSyncTime: null,
      pendingCount: 0,
      isOnline: true,
      syncError: null,
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveAttribute('aria-label', 'Sync status')
  })

  it('should show pending badge when offline with changes', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: false,
      lastSyncTime: new Date(),
      pendingCount: 3,
      isOnline: false,
      syncError: null,
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    expect(screen.getByText(/3 changes pending/i)).toBeInTheDocument()
    expect(screen.getByTestId('pending-badge')).toBeInTheDocument()
  })

  it('should not show pending count when syncing', () => {
    vi.spyOn(useSyncStatusModule, 'useSyncStatus').mockReturnValue({
      isSyncing: true,
      lastSyncTime: null,
      pendingCount: 5,
      isOnline: true,
      syncError: null,
      sync: vi.fn(),
    })

    render(<SyncStatusIndicator />)

    expect(screen.queryByText(/changes pending/i)).not.toBeInTheDocument()
    expect(screen.getByText(/syncing/i)).toBeInTheDocument()
  })
})
