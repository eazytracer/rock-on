/**
 * Journey Test Setup Utilities
 *
 * Provides helpers for setting up isolated test environments that simulate
 * real user journeys and edge cases.
 *
 * Philosophy: Test behavior, not implementation. Test what users do, not how code works.
 */

import { db } from '../../../src/services/database'
import { getSupabaseClient } from '../../../src/services/supabase/client'
import type { Song } from '../../../src/models/Song'
import type { Setlist } from '../../../src/models/Setlist'
import type { Show } from '../../../src/models/Show'
import type { PracticeSession } from '../../../src/models/PracticeSession'

/**
 * Test device represents a single user session (browser tab/device)
 * Used for multi-device sync testing and journey simulations
 */
export class TestDevice {
  name: string
  userId: string
  bandId: string
  isOnline: boolean = true
  private originalOnLine: boolean

  constructor(name: string, userId: string, bandId: string) {
    this.name = name
    this.userId = userId
    this.bandId = bandId
    this.originalOnLine = navigator.onLine
  }

  /**
   * Create a song on this device
   */
  async createSong(data: Partial<Song>): Promise<Song> {
    const song: Song = {
      id: crypto.randomUUID(),
      title: data.title || 'Test Song',
      artist: data.artist || 'Test Artist',
      contextType: 'band',
      contextId: this.bandId,
      createdBy: this.userId,
      visibility: 'band',
      createdDate: new Date(),
      confidenceLevel: data.confidenceLevel || 3,
      bpm: data.bpm,
      key: data.key,
      duration: data.duration,
      sections: data.sections || [],
      tags: data.tags || [],
      ...data
    }

    // Write to local DB
    await db.songs!.put(song)

    // If online, sync to cloud
    if (this.isOnline) {
      const supabase = getSupabaseClient()
      await supabase.from('songs').insert({
        id: song.id,
        title: song.title,
        artist: song.artist,
        context_type: song.contextType,
        context_id: song.contextId,
        created_by: song.createdBy,
        visibility: song.visibility,
        created_date: song.createdDate.toISOString(),
        confidence_level: song.confidenceLevel,
        tempo: song.bpm,
        key: song.key,
        duration: song.duration,
        sections: song.sections,
        tags: song.tags
      })
    }

    return song
  }

  /**
   * Edit a song on this device
   */
  async editSong(id: string, updates: Partial<Song>): Promise<Song> {
    const song = await db.songs!.get(id)
    if (!song) throw new Error(`Song ${id} not found`)

    const updated = { ...song, ...updates }
    await db.songs!.put(updated)

    if (this.isOnline) {
      const supabase = getSupabaseClient()
      await supabase.from('songs').update({
        title: updated.title,
        artist: updated.artist,
        tempo: updated.bpm,
        // ... other fields
      }).eq('id', id)
    }

    return updated
  }

  /**
   * Delete a song on this device
   */
  async deleteSong(id: string): Promise<void> {
    await db.songs!.delete(id)

    if (this.isOnline) {
      const supabase = getSupabaseClient()
      await supabase.from('songs').delete().eq('id', id)
    }
  }

  /**
   * Get all songs for this device's band
   */
  async getSongs(): Promise<Song[]> {
    return await db.songs!
      .where('contextId')
      .equals(this.bandId)
      .toArray()
  }

  /**
   * Simulate going offline
   */
  async goOffline(): Promise<void> {
    this.isOnline = false
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    })
    // Dispatch offline event
    window.dispatchEvent(new Event('offline'))
  }

  /**
   * Simulate going online
   */
  async goOnline(): Promise<void> {
    this.isOnline = true
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    })
    // Dispatch online event
    window.dispatchEvent(new Event('online'))
  }

  /**
   * Wait for sync to complete
   */
  async waitForSync(timeout: number = 5000): Promise<void> {
    const startTime = Date.now()

    // Wait for sync queue to be empty or timeout
    while (Date.now() - startTime < timeout) {
      const queueCount = await db.syncQueue?.count()
      if (queueCount === 0) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error(`Sync did not complete within ${timeout}ms`)
  }

  /**
   * Simulate session timeout
   */
  async simulateSessionTimeout(): Promise<void> {
    const supabase = getSupabaseClient()
    // Clear the session
    await supabase.auth.signOut()
  }

  /**
   * Cleanup device
   */
  async cleanup(): Promise<void> {
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: this.originalOnLine
    })
  }
}

/**
 * Test scenario manages multiple devices for testing sync scenarios
 */
export class TestScenario {
  devices: Map<string, TestDevice> = new Map()

  /**
   * Setup multiple test devices
   */
  async setupDevices(deviceNames: string[], userId: string, bandId: string): Promise<void> {
    for (const name of deviceNames) {
      const device = new TestDevice(name, userId, bandId)
      this.devices.set(name, device)
    }
  }

  /**
   * Get a specific device
   */
  getDevice(name: string): TestDevice {
    const device = this.devices.get(name)
    if (!device) throw new Error(`Device ${name} not found`)
    return device
  }

  /**
   * Wait for all devices to sync
   */
  async waitForAllDevicesToSync(timeout: number = 5000): Promise<void> {
    await Promise.all(
      Array.from(this.devices.values()).map(device => device.waitForSync(timeout))
    )
  }

  /**
   * Verify data consistency across all devices
   */
  async verifyDataConsistency(): Promise<boolean> {
    if (this.devices.size < 2) return true

    const devices = Array.from(this.devices.values())
    const firstDevice = devices[0]
    const firstSongs = await firstDevice.getSongs()

    for (let i = 1; i < devices.length; i++) {
      const songs = await devices[i].getSongs()

      if (songs.length !== firstSongs.length) {
        console.error(`Device ${devices[i].name} has ${songs.length} songs, expected ${firstSongs.length}`)
        return false
      }

      // Check each song ID exists
      const songIds = new Set(songs.map(s => s.id))
      for (const song of firstSongs) {
        if (!songIds.has(song.id)) {
          console.error(`Device ${devices[i].name} missing song ${song.id}`)
          return false
        }
      }
    }

    return true
  }

  /**
   * Cleanup all devices
   */
  async teardown(): Promise<void> {
    await Promise.all(
      Array.from(this.devices.values()).map(device => device.cleanup())
    )
    this.devices.clear()
  }
}

/**
 * Edge case simulation helpers
 */

export async function simulateNetworkFailure(duration: number): Promise<void> {
  // Simulate network failure for duration ms
  window.dispatchEvent(new Event('offline'))
  await new Promise(resolve => setTimeout(resolve, duration))
  window.dispatchEvent(new Event('online'))
}

export async function simulateSlowNetwork(latency: number): Promise<void> {
  // Mock fetch to add latency
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    await new Promise(resolve => setTimeout(resolve, latency))
    return originalFetch(...args)
  }
}

export async function simulateWebSocketDisconnect(): Promise<void> {
  // Trigger WebSocket disconnect
  window.dispatchEvent(new Event('offline'))
}

/**
 * Assertion helpers for journey tests
 */

export async function expectSyncedWithinTimeout(
  device1: TestDevice,
  device2: TestDevice,
  timeout: number = 1000
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const songs1 = await device1.getSongs()
    const songs2 = await device2.getSongs()

    if (songs1.length === songs2.length) {
      // Check IDs match
      const ids1 = new Set(songs1.map(s => s.id))
      const ids2 = new Set(songs2.map(s => s.id))

      if (ids1.size === ids2.size && [...ids1].every(id => ids2.has(id))) {
        return // Success!
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error(`Devices did not sync within ${timeout}ms`)
}

export async function expectDataConsistent(devices: TestDevice[]): Promise<void> {
  if (devices.length < 2) return

  const firstSongs = await devices[0].getSongs()

  for (let i = 1; i < devices.length; i++) {
    const songs = await devices[i].getSongs()

    if (songs.length !== firstSongs.length) {
      throw new Error(
        `Device ${devices[i].name} has ${songs.length} songs, expected ${firstSongs.length}`
      )
    }

    const songIds = new Set(songs.map(s => s.id))
    for (const song of firstSongs) {
      if (!songIds.has(song.id)) {
        throw new Error(`Device ${devices[i].name} missing song ${song.id}`)
      }
    }
  }
}

export async function expectNoDataLoss(
  beforeCount: number,
  afterCount: number
): Promise<void> {
  if (afterCount < beforeCount) {
    throw new Error(`Data loss detected: ${beforeCount} → ${afterCount}`)
  }
}
