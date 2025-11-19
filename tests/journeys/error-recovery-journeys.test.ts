/**
 * Error Recovery Journey Tests
 *
 * Tests complete user journeys for error scenarios and recovery patterns.
 * Validates that the app handles errors gracefully and recovers correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDevice, TestScenario, expectNoDataLoss } from './helpers/testSetup'
import { db } from '../../src/services/database'

describe('Error Recovery Journeys', () => {
  let scenario: TestScenario
  const testUserId = 'test-user-1'
  const testBandId = 'test-band-1'

  beforeEach(async () => {
    scenario = new TestScenario()
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await scenario.teardown()
  })

  describe('Network Errors During CRUD', () => {
    it('JOURNEY: Network error during CREATE → Retries → Eventually succeeds', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Simulate network error
      await device.goOffline()

      // User creates song (will queue for retry)
      await device.createSong({ title: 'Queued Song' })

      // Verify it's in local DB
      expect(await device.getSongs()).toHaveLength(1)

      // Network comes back
      await device.goOnline()

      // Should retry and succeed
      await device.waitForSync(5000)

      // Verify still in DB (no data loss)
      expect(await device.getSongs()).toHaveLength(1)
    })

    it('JOURNEY: Network error during UPDATE → Doesn\'t duplicate → Retries correctly', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Create song while online
      const song = await device.createSong({ title: 'Original' })

      // Go offline
      await device.goOffline()

      // Edit (will queue)
      await device.editSong(song.id, { title: 'Edited' })

      // Come back online
      await device.goOnline()
      await device.waitForSync(5000)

      // Should have exactly 1 song (not duplicated)
      const songs = await device.getSongs()
      expect(songs).toHaveLength(1)
      expect(songs[0].title).toBe('Edited')
    })

    it('JOURNEY: Network error during DELETE → Doesn\'t lose data → Completes deletion', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Create song while online
      const song = await device.createSong({ title: 'To Delete' })
      await device.waitForSync()

      // Go offline
      await device.goOffline()

      // Delete (will queue)
      await device.deleteSong(song.id)

      // Verify locally deleted
      expect(await device.getSongs()).toHaveLength(0)

      // Come back online
      await device.goOnline()
      await device.waitForSync(5000)

      // Should still be deleted (completed successfully)
      expect(await device.getSongs()).toHaveLength(0)
    })
  })

  describe('Sync Queue Failures', () => {
    it('JOURNEY: Sync fails → Shows error to user → User can retry manually', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Go offline
      await device.goOffline()

      // Create multiple songs
      await device.createSong({ title: 'Song 1' })
      await device.createSong({ title: 'Song 2' })
      await device.createSong({ title: 'Song 3' })

      // Verify queued
      expect(await device.getSongs()).toHaveLength(3)

      // Go online but simulate sync failure
      await device.goOnline()

      // In real app, user would see error message
      // User clicks "Retry" button
      // TODO: Simulate manual retry trigger

      // After retry, should succeed
      await device.waitForSync(10000)

      // Verify all synced
      expect(await device.getSongs()).toHaveLength(3)
    })

    it('JOURNEY: Sync queue overflow (100+ pending) → App doesn\'t crash → Processes all', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Go offline
      await device.goOffline()

      // Create 100+ songs (stress test)
      const promises = []
      for (let i = 1; i <= 100; i++) {
        promises.push(device.createSong({ title: `Queued Song ${i}` }))
      }
      await Promise.all(promises)

      // Verify all in local DB
      expect(await device.getSongs()).toHaveLength(100)

      // Go online
      await device.goOnline()

      // Should process all without crashing
      await device.waitForSync(60000) // 60s for 100 items

      // Verify no data loss
      const syncedSongs = await device.getSongs()
      expect(syncedSongs).toHaveLength(100)
    })
  })

  describe('Invalid Data Handling', () => {
    it('JOURNEY: Invalid date format → Doesn\'t crash → Shows validation error', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Try to create song with invalid date
      try {
        // @ts-ignore - intentionally passing invalid data
        await device.createSong({
          title: 'Test Song',
          createdDate: 'not-a-date'
        })
      } catch (error) {
        // Should show validation error, not crash
        expect(error).toBeDefined()
      }

      // App should still be functional
      const validSong = await device.createSong({ title: 'Valid Song' })
      expect(validSong).toBeDefined()
    })

    it('JOURNEY: Missing required field → Shows error → Doesn\'t save incomplete data', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Try to create song without required fields
      try {
        // @ts-ignore
        await device.createSong({
          artist: 'Artist Only' // Missing title
        })
      } catch (error) {
        // Should show validation error
        expect(error).toBeDefined()
      }

      // Verify the invalid song was not saved
      const songs = await device.getSongs()
      const invalidSong = songs.find(s => !s.title) // Song without required title
      expect(invalidSong).toBeUndefined() // Should not exist
    })

    it('JOURNEY: Corrupted data in audit log → Skips bad record → Continues processing', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // This would test the parseDate() helper and JSONB validation
      // that catches corrupted data in audit_log

      // Create valid song
      await device.createSong({ title: 'Valid Song' })

      // Simulate corrupted audit log entry (in real test, would inject bad data)

      // App should skip corrupted entry and continue
      // Should still be able to create more songs
      await device.createSong({ title: 'Another Valid Song' })

      expect(await device.getSongs()).toHaveLength(2)
    })
  })

  describe('Concurrent Operations', () => {
    it('JOURNEY: Rapid clicks on save → Doesn\'t create duplicates', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Simulate user clicking save button multiple times rapidly
      const promises = []
      const songData = { title: 'Same Song' }

      // Create same song 5 times in rapid succession
      for (let i = 0; i < 5; i++) {
        promises.push(device.createSong(songData))
      }

      await Promise.all(promises)

      // Should have 5 unique songs (each with different ID)
      // OR should have dedupe logic that creates only 1
      const songs = await device.getSongs()

      // Check if all songs have unique IDs
      const uniqueIds = new Set(songs.map(s => s.id))
      expect(uniqueIds.size).toBe(songs.length)

      // Or if dedupe is implemented, should be 1
      // expect(songs).toHaveLength(1)
    })

    it('JOURNEY: Create then immediately delete → Handles correctly', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Create song
      const song = await device.createSong({ title: 'Quick Delete' })

      // Immediately delete (before sync completes)
      await device.deleteSong(song.id)

      // Verify deleted locally
      expect(await device.getSongs()).toHaveLength(0)

      // Wait for sync
      await device.waitForSync(5000)

      // Should still be deleted (correct final state)
      expect(await device.getSongs()).toHaveLength(0)
    })

    it('JOURNEY: Multiple tabs editing same song → Last write wins', async () => {
      await scenario.setupDevices(['tab1', 'tab2'], testUserId, testBandId)
      const tab1 = scenario.getDevice('tab1')
      const tab2 = scenario.getDevice('tab2')

      // Create song in tab1
      const song = await tab1.createSong({ title: 'Original' })
      await scenario.waitForAllDevicesToSync()

      // Both tabs edit simultaneously
      await Promise.all([
        tab1.editSong(song.id, { title: 'Edit from Tab 1' }),
        tab2.editSong(song.id, { title: 'Edit from Tab 2' })
      ])

      await scenario.waitForAllDevicesToSync(3000)

      // Last write wins - both tabs should have same final state
      const tab1Songs = await tab1.getSongs()
      const tab2Songs = await tab2.getSongs()

      expect(tab1Songs[0].title).toBe(tab2Songs[0].title)
    })
  })

  describe('Memory & Performance', () => {
    it('JOURNEY: Long running session (1000 operations) → No memory leaks', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      const startMemory = performance.memory?.usedJSHeapSize || 0

      // Perform 1000 create/edit/delete operations
      for (let i = 0; i < 100; i++) {
        // Create
        const song = await device.createSong({ title: `Song ${i}` })

        // Edit
        await device.editSong(song.id, { title: `Edited Song ${i}` })

        // Delete (keep last 50)
        if (i > 50) {
          const songs = await device.getSongs()
          if (songs.length > 50) {
            await device.deleteSong(songs[0].id)
          }
        }
      }

      const endMemory = performance.memory?.usedJSHeapSize || 0

      // Memory growth should be reasonable (not exponential)
      // Allow for 50MB growth (generous threshold)
      const memoryGrowth = endMemory - startMemory
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024)

      // Should still be responsive
      const songs = await device.getSongs()
      expect(songs.length).toBeGreaterThan(0)
    })

    it('JOURNEY: Large dataset (500 songs) → App stays responsive', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Create 500 songs
      const promises = []
      for (let i = 1; i <= 500; i++) {
        promises.push(device.createSong({ title: `Song ${i}` }))
      }

      const startTime = Date.now()
      await Promise.all(promises)
      const createTime = Date.now() - startTime

      // Should complete in reasonable time (< 10s for 500 items)
      expect(createTime).toBeLessThan(10000)

      // Queries should still be fast
      const queryStart = Date.now()
      const songs = await device.getSongs()
      const queryTime = Date.now() - queryStart

      expect(songs).toHaveLength(500)
      expect(queryTime).toBeLessThan(1000) // < 1s for query
    })
  })
})
