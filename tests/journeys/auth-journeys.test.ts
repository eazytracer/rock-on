/**
 * Authentication Journey Tests
 *
 * Tests complete user journeys involving authentication, including edge cases
 * like session timeout, multi-tab scenarios, and session persistence.
 *
 * These tests validate BEHAVIOR, not implementation details.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TestDevice, TestScenario } from './helpers/testSetup'
import { db } from '../../src/services/database'
import { getSupabaseClient } from '../../src/services/supabase/client'

describe('Authentication Journeys', () => {
  let scenario: TestScenario
  const testUserId = 'test-user-1'
  const testBandId = 'test-band-1'

  beforeEach(async () => {
    scenario = new TestScenario()
    // Clear database
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await scenario.teardown()
  })

  describe('Session Timeout Edge Case', () => {
    it('JOURNEY: User creates song → Session expires → Re-auth → Song syncs', async () => {
      // Setup device
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // 1. User creates a song while authenticated
      const song = await device.createSong({
        title: 'Pre-Timeout Song',
        artist: 'Test Artist'
      })

      expect(song).toBeDefined()
      expect(song.id).toBeDefined()

      // 2. Verify song is in local DB
      const localSongs = await device.getSongs()
      expect(localSongs).toHaveLength(1)
      expect(localSongs[0].title).toBe('Pre-Timeout Song')

      // 3. Simulate session timeout
      await device.simulateSessionTimeout()

      // 4. User tries to create another song (should fail gracefully)
      try {
        await device.createSong({
          title: 'Post-Timeout Song',
          artist: 'Test Artist'
        })
      } catch (error) {
        // Expected: Should show auth error, not crash
        expect(error).toBeDefined()
      }

      // 5. Verify local data is still accessible (CRITICAL!)
      const localSongsAfterTimeout = await device.getSongs()
      expect(localSongsAfterTimeout.length).toBeGreaterThanOrEqual(1)
      const preTimeoutSong = localSongsAfterTimeout.find(s => s.title === 'Pre-Timeout Song')
      expect(preTimeoutSong).toBeDefined()
      expect(preTimeoutSong?.title).toBe('Pre-Timeout Song')

      // 6. User re-authenticates
      // TODO: Add actual re-auth logic when available

      // 7. After re-auth, song should sync to cloud
      // TODO: Verify sync after re-auth
    })

    it('JOURNEY: Session expires during sync → Shows error → Preserves local data', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // 1. User creates multiple songs
      await device.createSong({ title: 'Song 1' })
      await device.createSong({ title: 'Song 2' })
      await device.createSong({ title: 'Song 3' })

      const beforeCount = (await device.getSongs()).length
      expect(beforeCount).toBe(3)

      // 2. Simulate session timeout mid-sync
      await device.simulateSessionTimeout()

      // 3. Try to sync (should fail gracefully)
      try {
        await device.waitForSync(1000)
      } catch (error) {
        // Expected: Sync timeout or auth error
      }

      // 4. CRITICAL: Local data should be preserved
      const afterCount = (await device.getSongs()).length
      expect(afterCount).toBe(beforeCount)

      // 5. User should see auth error (not crash)
      // TODO: Verify error state is shown to user
    })
  })

  describe('Multi-Tab Scenarios', () => {
    it('JOURNEY: User opens two tabs → Logs out in one → Other tab handles it', async () => {
      // Setup two devices (tabs)
      await scenario.setupDevices(['tab1', 'tab2'], testUserId, testBandId)
      const tab1 = scenario.getDevice('tab1')
      const tab2 = scenario.getDevice('tab2')

      // 1. Create song in tab1
      await tab1.createSong({ title: 'Test Song' })

      // 2. Verify appears in both tabs
      await scenario.waitForAllDevicesToSync()
      expect(await tab1.getSongs()).toHaveLength(1)
      expect(await tab2.getSongs()).toHaveLength(1)

      // 3. Logout in tab1
      await tab1.simulateSessionTimeout()

      // 4. Tab2 should detect logout and handle gracefully
      // TODO: Verify tab2 shows "logged out" state

      // 5. Both tabs should still have local data accessible
      expect(await tab1.getSongs()).toHaveLength(1)
      expect(await tab2.getSongs()).toHaveLength(1)
    })

    it('JOURNEY: User creates data in multiple tabs → All tabs stay synced', async () => {
      await scenario.setupDevices(['tab1', 'tab2', 'tab3'], testUserId, testBandId)
      const tab1 = scenario.getDevice('tab1')
      const tab2 = scenario.getDevice('tab2')
      const tab3 = scenario.getDevice('tab3')

      // Each tab creates a song
      await tab1.createSong({ title: 'Song from Tab 1' })
      await tab2.createSong({ title: 'Song from Tab 2' })
      await tab3.createSong({ title: 'Song from Tab 3' })

      // Wait for sync
      await scenario.waitForAllDevicesToSync(3000)

      // All tabs should have all 3 songs
      expect(await tab1.getSongs()).toHaveLength(3)
      expect(await tab2.getSongs()).toHaveLength(3)
      expect(await tab3.getSongs()).toHaveLength(3)

      // Verify data consistency
      const consistent = await scenario.verifyDataConsistency()
      expect(consistent).toBe(true)
    })
  })

  describe('Session Persistence', () => {
    it('JOURNEY: User logs in → Closes tab → Reopens → Session persists', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device1 = scenario.getDevice('device1')

      // 1. User creates song while logged in
      await device1.createSong({ title: 'Test Song' })
      const beforeSongs = await device1.getSongs()
      expect(beforeSongs).toHaveLength(1)

      // 2. Simulate closing tab (cleanup device)
      await device1.cleanup()

      // 3. Simulate reopening tab (create new device with same IDs)
      const device2 = new TestDevice('device1-reopened', testUserId, testBandId)

      // 4. Session should persist - data should still be accessible
      const afterSongs = await device2.getSongs()
      expect(afterSongs).toHaveLength(1)
      expect(afterSongs[0].title).toBe('Test Song')

      await device2.cleanup()
    })

    it('JOURNEY: Quick login (dev mode) → Works immediately', async () => {
      // This test would validate the quick login feature
      // Placeholder for now - needs actual quick login implementation

      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // Quick login should work
      expect(device.userId).toBe(testUserId)

      // Should be able to create data immediately
      await device.createSong({ title: 'Quick Login Test' })
      const songs = await device.getSongs()
      expect(songs).toHaveLength(1)
    })
  })

  describe('Authentication Error Recovery', () => {
    it('JOURNEY: Auth error → User re-authenticates → Operations resume', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // 1. Create initial song
      await device.createSong({ title: 'Before Error' })

      // 2. Simulate auth error
      await device.simulateSessionTimeout()

      // 3. User re-authenticates (simulated)
      // TODO: Add actual re-auth flow

      // 4. After re-auth, should be able to create new songs
      // TODO: Verify can create songs after re-auth

      // 5. Previous local data should still be accessible
      const songs = await device.getSongs()
      expect(songs.length).toBeGreaterThanOrEqual(1)
    })

    it('JOURNEY: Invalid token → Prompts re-login → Doesn\'t lose data', async () => {
      await scenario.setupDevices(['device1'], testUserId, testBandId)
      const device = scenario.getDevice('device1')

      // 1. Create data with valid token
      await device.createSong({ title: 'Valid Token Song' })
      const beforeCount = (await device.getSongs()).length

      // 2. Simulate invalid token (expired, revoked, etc.)
      await device.simulateSessionTimeout()

      // 3. CRITICAL: Should not lose local data
      const afterCount = (await device.getSongs()).length
      expect(afterCount).toBe(beforeCount)

      // 4. Should show re-login prompt (not crash)
      // TODO: Verify UI shows re-login prompt
    })
  })
})
