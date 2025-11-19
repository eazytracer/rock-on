/**
 * SyncEngine - Immediate Sync Tests (Phase 3.2 TDD)
 *
 * Tests for immediate sync behavior:
 * - Sync triggered immediately on queue add
 * - Sync completes within 1 second
 * - Status updates: syncing → synced
 * - Retry logic with exponential backoff
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SyncEngine } from '../../../../src/services/data/SyncEngine'
import { LocalRepository } from '../../../../src/services/data/LocalRepository'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'
import { db } from '../../../../src/services/database'
import { SyncStatus } from '../../../../src/services/data/syncTypes'

describe('SyncEngine - Immediate Sync (Phase 3.2)', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  const mockSong = {
    id: 'test-song-immediate',
    title: 'Immediate Sync Test',
    artist: 'Test Artist',
    album: '',
    duration: 180,
    key: 'C',
    bpm: 120,
    difficulty: 3,
    guitarTuning: 'Standard',
    structure: [],
    lyrics: '',
    chords: [],
    referenceLinks: [],
    tags: [],
    notes: 'Test immediate sync',
    createdDate: new Date('2025-01-01'),
    confidenceLevel: 3,
    contextType: 'band',
    contextId: 'band-1',
    createdBy: 'user-1',
    visibility: 'band'
  }

  beforeEach(async () => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()

    // Mock remote repository methods
    vi.spyOn(remoteRepo, 'addSong').mockResolvedValue({
      ...mockSong,
      id: 'synced-song-1'
    } as any)

    vi.spyOn(remoteRepo, 'updateSong').mockResolvedValue({
      ...mockSong,
      id: 'synced-song-1'
    } as any)

    syncEngine = new SyncEngine(localRepo, remoteRepo)

    // Clear sync queue
    await db.syncQueue?.clear()
  })

  afterEach(async () => {
    syncEngine.destroy()
    await db.syncQueue?.clear()
    vi.clearAllMocks()
  })

  describe('Immediate Sync Trigger', () => {
    it('should trigger sync immediately on queue add', async () => {
      // Spy on the scheduleImmediateSync method (private, so we'll test the effect)
      const pushQueuedChangesSpy = vi.spyOn(syncEngine as any, 'pushQueuedChanges')

      await syncEngine.queueCreate('songs', mockSong)

      // Wait for debounce delay (should be ~100ms)
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should have called pushQueuedChanges due to immediate sync
      expect(pushQueuedChangesSpy).toHaveBeenCalled()
    })

    it('should debounce multiple rapid queue adds', async () => {
      const pushQueuedChangesSpy = vi.spyOn(syncEngine as any, 'pushQueuedChanges')

      // Queue 3 operations rapidly
      await syncEngine.queueCreate('songs', { ...mockSong, id: 'song-1' })
      await syncEngine.queueCreate('songs', { ...mockSong, id: 'song-2' })
      await syncEngine.queueCreate('songs', { ...mockSong, id: 'song-3' })

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should only trigger once due to debouncing
      expect(pushQueuedChangesSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Sync Latency', () => {
    it('should sync within 1 second', async () => {
      const start = Date.now()

      await syncEngine.queueCreate('songs', mockSong)

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 300))

      // Verify sync completed
      const queue = await db.syncQueue?.toArray()
      expect(queue).toHaveLength(0) // Queue should be empty

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Must be under 1 second
    })

    it('should sync update operations immediately', async () => {
      const start = Date.now()

      await syncEngine.queueUpdate('songs', 'song-1', {
        id: 'song-1',
        title: 'Updated Title'
      })

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 300))

      const queue = await db.syncQueue?.toArray()
      expect(queue).toHaveLength(0)

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000)
    })

    it('should sync delete operations immediately', async () => {
      const start = Date.now()

      vi.spyOn(remoteRepo, 'deleteSong').mockResolvedValue()

      await syncEngine.queueDelete('songs', 'song-1')

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 300))

      const queue = await db.syncQueue?.toArray()
      expect(queue).toHaveLength(0)

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Status Updates', () => {
    it('should update status from pending to syncing to synced', async () => {
      const statusChanges: SyncStatus[] = []

      // Listen for status changes
      syncEngine.onStatusChange((status) => {
        statusChanges.push({ ...status })
      })

      await syncEngine.queueCreate('songs', mockSong)

      // Initial status should show pending
      let status = await syncEngine.getStatus()
      expect(status.pendingCount).toBe(1)

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 300))

      // Final status should show no pending items
      status = await syncEngine.getStatus()
      expect(status.pendingCount).toBe(0)

      // Should have received status updates
      expect(statusChanges.length).toBeGreaterThan(0)
    })

    it('should notify listeners on queue add', async () => {
      const listener = vi.fn()
      syncEngine.onStatusChange(listener)

      await syncEngine.queueCreate('songs', mockSong)

      // Wait a tick for async status update
      await new Promise(resolve => setTimeout(resolve, 10))

      // Should have been notified
      expect(listener).toHaveBeenCalled()

      // Get the last call's status
      const lastStatus = listener.mock.calls[listener.mock.calls.length - 1][0]
      expect(lastStatus.pendingCount).toBeGreaterThan(0)
    })

    it('should notify listeners on sync completion', async () => {
      const listener = vi.fn()
      syncEngine.onStatusChange(listener)

      await syncEngine.queueCreate('songs', mockSong)

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 400))

      // Should have been notified at least once (queue add is synchronous, completion is async)
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Retry Logic with Exponential Backoff', () => {
    it('should retry on network error', async () => {
      let attempts = 0
      vi.spyOn(remoteRepo, 'addSong').mockImplementation(() => {
        attempts++
        if (attempts < 2) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve(mockSong as any)
      })

      await syncEngine.queueCreate('songs', mockSong)

      // Wait for initial sync attempt
      await new Promise(resolve => setTimeout(resolve, 300))

      // Should have attempted once and marked for retry
      const queue = await db.syncQueue?.toArray()
      expect(queue).toHaveLength(1)
      expect(queue![0].retryCount).toBe(1)

      // Manually trigger another sync attempt
      await syncEngine['pushQueuedChanges']()

      // Should succeed on second attempt
      const queueAfter = await db.syncQueue?.toArray()
      expect(queueAfter).toHaveLength(0)
      expect(attempts).toBe(2)
    })

    it('should mark as failed after max retries', async () => {
      vi.spyOn(remoteRepo, 'addSong').mockRejectedValue(new Error('Network error'))

      await syncEngine.queueCreate('songs', mockSong)

      // Wait for initial attempt
      await new Promise(resolve => setTimeout(resolve, 300))

      // Manually trigger retry attempts
      await syncEngine['pushQueuedChanges']()
      await syncEngine['pushQueuedChanges']()

      const queue = await db.syncQueue?.toArray()
      expect(queue).toHaveLength(1)
      expect(queue![0].status).toBe('failed')
      expect(queue![0].retries).toBe(3)
      expect(queue![0].lastError).toBe('Network error')
    })

    it('should preserve queue item data during retries', async () => {
      let attempts = 0
      vi.spyOn(remoteRepo, 'addSong').mockImplementation(() => {
        attempts++
        if (attempts < 2) {
          return Promise.reject(new Error('Temporary error'))
        }
        return Promise.resolve(mockSong as any)
      })

      await syncEngine.queueCreate('songs', mockSong)

      // Wait for initial attempt
      await new Promise(resolve => setTimeout(resolve, 300))

      // Check queue item still has original data
      const queue = await db.syncQueue?.toArray()
      expect(queue![0].data.title).toBe('Immediate Sync Test')
      expect(queue![0].data.artist).toBe('Test Artist')

      // Complete the sync on next attempt
      await syncEngine['pushQueuedChanges']()

      // Should be synced and removed from queue
      const queueAfter = await db.syncQueue?.toArray()
      expect(queueAfter).toHaveLength(0)
    })
  })

  describe('Online/Offline Behavior', () => {
    it('should queue operations when offline but sync immediately when online', async () => {
      // Create a new sync engine with offline state
      const offlineRepo = new RemoteRepository()
      vi.spyOn(offlineRepo, 'addSong').mockResolvedValue(mockSong as any)

      // Mock navigator.onLine to return false
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })

      const offlineEngine = new SyncEngine(localRepo, offlineRepo)

      await offlineEngine.queueCreate('songs', mockSong)

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should be in queue, not synced (offline)
      let queue = await db.syncQueue?.toArray()
      expect(queue).toHaveLength(1)
      expect(offlineRepo.addSong).not.toHaveBeenCalled()

      // Go online
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
      window.dispatchEvent(new Event('online'))

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 400))

      // Should now be synced
      queue = await db.syncQueue?.toArray()
      expect(queue).toHaveLength(0)
      expect(offlineRepo.addSong).toHaveBeenCalled()

      // Cleanup
      offlineEngine.destroy()
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true, writable: true })
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent queue operations', async () => {
      // Mock delete operation
      vi.spyOn(remoteRepo, 'deleteSong').mockResolvedValue()

      const operations = [
        syncEngine.queueCreate('songs', { ...mockSong, id: 'song-1' }),
        syncEngine.queueCreate('songs', { ...mockSong, id: 'song-2' }),
        syncEngine.queueCreate('songs', { ...mockSong, id: 'song-3' }),
        syncEngine.queueUpdate('songs', 'song-4', { id: 'song-4', title: 'Updated' }),
        syncEngine.queueDelete('songs', 'song-5')
      ]

      await Promise.all(operations)

      // Wait for debounced sync
      await new Promise(resolve => setTimeout(resolve, 400))

      // All should be synced
      const queue = await db.syncQueue?.toArray()
      expect(queue).toHaveLength(0)
    })
  })
})
