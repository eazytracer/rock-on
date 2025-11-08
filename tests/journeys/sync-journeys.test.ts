/**
 * Offline/Online Sync Journey Tests
 *
 * Tests complete user journeys for offline/online sync scenarios.
 * Validates that data remains accessible offline and syncs correctly when back online.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDevice, TestScenario, expectNoDataLoss } from './helpers/testSetup'
import { db } from '../../src/services/database'

describe('Offline/Online Sync Journeys', () => {
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

  describe('Offline Data Access', () => {
    it('JOURNEY: User online → Creates data → Goes offline → Data still accessible', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // 1. User is online and creates songs
      await device.createSong({ title: 'Online Song 1' })
      await device.createSong({ title: 'Online Song 2' })
      await device.createSong({ title: 'Online Song 3' })

      const onlineSongs = await device.getSongs()
      expect(onlineSongs).toHaveLength(3)

      // 2. User goes offline (airplane mode, network failure, etc.)
      await device.goOffline()

      // 3. CRITICAL: Data should still be accessible
      const offlineSongs = await device.getSongs()
      expect(offlineSongs.length).toBeGreaterThanOrEqual(3)

      // Find our specific songs (order may vary)
      const song1 = offlineSongs.find(s => s.title === 'Online Song 1')
      const song2 = offlineSongs.find(s => s.title === 'Online Song 2')
      const song3 = offlineSongs.find(s => s.title === 'Online Song 3')
      expect(song1).toBeDefined()
      expect(song2).toBeDefined()
      expect(song3).toBeDefined()
    })

    it('JOURNEY: User offline → Views existing data → Edits data → Data updated locally', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Setup: Create song while online
      const song = await device.createSong({ title: 'Original Title' })

      // User goes offline
      await device.goOffline()

      // User can still view the song
      const songs = await device.getSongs()
      expect(songs).toHaveLength(1)

      // User edits the song offline
      await device.editSong(song.id, { title: 'Edited While Offline' })

      // Verify edit persisted locally
      const updatedSongs = await device.getSongs()
      expect(updatedSongs[0].title).toBe('Edited While Offline')
    })
  })

  describe('Offline Creation & Sync', () => {
    it('JOURNEY: User offline → Creates data → Goes online → Data syncs to cloud', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // 1. User goes offline
      await device.goOffline()

      // 2. User creates songs while offline
      await device.createSong({ title: 'Offline Song 1' })
      await device.createSong({ title: 'Offline Song 2' })

      const offlineSongs = await device.getSongs()
      expect(offlineSongs).toHaveLength(2)

      // 3. User goes back online
      await device.goOnline()

      // 4. Wait for sync to cloud
      await device.waitForSync(5000)

      // 5. Verify data synced (songs should still be in local DB)
      const syncedSongs = await device.getSongs()
      expect(syncedSongs).toHaveLength(2)

      // 6. NO DATA LOSS
      await expectNoDataLoss(offlineSongs.length, syncedSongs.length)
    })

    it('JOURNEY: User offline → Creates many items → Online → All sync correctly', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      await device.goOffline()

      // Create 10 songs offline
      const createdSongs = []
      for (let i = 1; i <= 10; i++) {
        const song = await device.createSong({ title: `Offline Song ${i}` })
        createdSongs.push(song)
      }

      expect(await device.getSongs()).toHaveLength(10)

      // Go online and sync
      await device.goOnline()
      await device.waitForSync(10000) // Longer timeout for 10 items

      // Verify all synced
      const syncedSongs = await device.getSongs()
      expect(syncedSongs).toHaveLength(10)

      // Verify no data loss
      await expectNoDataLoss(10, syncedSongs.length)
    })
  })

  describe('Offline Edits & Sync', () => {
    it('JOURNEY: User offline → Edits data → Goes online → Edits sync to cloud', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Setup: Create song while online
      const song = await device.createSong({ title: 'Original', artist: 'Original Artist' })

      // Go offline
      await device.goOffline()

      // Edit song offline
      await device.editSong(song.id, {
        title: 'Edited Offline',
        artist: 'Edited Artist'
      })

      const offlineVersion = (await device.getSongs())[0]
      expect(offlineVersion.title).toBe('Edited Offline')

      // Go online
      await device.goOnline()
      await device.waitForSync(5000)

      // Verify edit synced
      const syncedVersion = (await device.getSongs())[0]
      expect(syncedVersion.title).toBe('Edited Offline')
      expect(syncedVersion.artist).toBe('Edited Artist')
    })

    it('JOURNEY: User offline → Deletes data → Goes online → Deletion syncs', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Setup: Create songs while online
      const song1 = await device.createSong({ title: 'Keep This' })
      const song2 = await device.createSong({ title: 'Delete This' })

      expect(await device.getSongs()).toHaveLength(2)

      // Go offline
      await device.goOffline()

      // Delete song2 offline
      await device.deleteSong(song2.id)

      expect(await device.getSongs()).toHaveLength(1)

      // Go online
      await device.goOnline()
      await device.waitForSync(5000)

      // Verify deletion synced (should still be 1 song)
      const syncedSongs = await device.getSongs()
      expect(syncedSongs).toHaveLength(1)
      expect(syncedSongs[0].id).toBe(song1.id)
    })
  })

  describe('Network Interruption Recovery', () => {
    it('JOURNEY: User syncing → Network fails mid-sync → Reconnects → Sync resumes', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Create songs
      await device.createSong({ title: 'Song 1' })
      await device.createSong({ title: 'Song 2' })
      await device.createSong({ title: 'Song 3' })

      // Simulate network failure during sync
      await device.goOffline()

      // Try to create more songs (will queue)
      await device.createSong({ title: 'Song 4 (queued)' })
      await device.createSong({ title: 'Song 5 (queued)' })

      expect(await device.getSongs()).toHaveLength(5)

      // Network comes back
      await device.goOnline()

      // Sync should resume and complete
      await device.waitForSync(10000)

      // All songs should be present
      expect(await device.getSongs()).toHaveLength(5)
    })

    it('JOURNEY: User has queued changes → Network intermittent → Eventually syncs all', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Go offline
      await device.goOffline()

      // Create changes while offline
      const createdSongs = []
      for (let i = 1; i <= 5; i++) {
        const song = await device.createSong({ title: `Queued Song ${i}` })
        createdSongs.push(song)
      }

      // Simulate intermittent connection (on/off/on)
      await device.goOnline()
      await new Promise(resolve => setTimeout(resolve, 100))
      await device.goOffline()
      await new Promise(resolve => setTimeout(resolve, 100))
      await device.goOnline()

      // Eventually should sync all
      await device.waitForSync(15000) // Longer timeout for intermittent

      // Verify all synced
      const syncedSongs = await device.getSongs()
      expect(syncedSongs).toHaveLength(5)
      await expectNoDataLoss(5, syncedSongs.length)
    })
  })

  describe('Conflict Resolution (Last-Write-Wins)', () => {
    it('JOURNEY: Two devices offline → Edit same song → Both online → Last write wins', async () => {
      await scenario.setupDevices(['device1', 'device2'], testUserId, testBandId)
      const device1 = scenario.getDevice('device1')
      const device2 = scenario.getDevice('device2')

      // Setup: Create song on device1 while both online
      const song = await device1.createSong({ title: 'Original Title' })
      await scenario.waitForAllDevicesToSync()

      // Both devices should have the song
      expect(await device1.getSongs()).toHaveLength(1)
      expect(await device2.getSongs()).toHaveLength(1)

      // Both go offline
      await device1.goOffline()
      await device2.goOffline()

      // Device1 edits
      await device1.editSong(song.id, { title: 'Device 1 Edit' })

      // Device2 edits (conflict!)
      await device2.editSong(song.id, { title: 'Device 2 Edit' })

      // Device1 goes online first
      await device1.goOnline()
      await device1.waitForSync()

      // Then device2 goes online
      await device2.goOnline()
      await device2.waitForSync()

      // Last write wins (device2 was last)
      await scenario.waitForAllDevicesToSync()

      const device1Songs = await device1.getSongs()
      const device2Songs = await device2.getSongs()

      // Both should have same final state (device2's edit)
      expect(device1Songs[0].title).toBe('Device 2 Edit')
      expect(device2Songs[0].title).toBe('Device 2 Edit')
    })
  })
})
