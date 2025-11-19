import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LocalRepository } from '../../../../src/services/data/LocalRepository'
import { db } from '../../../../src/services/database'
import { Song } from '../../../../src/models/Song'

describe('LocalRepository - Songs', () => {
  let repository: LocalRepository
  const testSong: Song = {
    id: 'test-song-1',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 180,
    key: 'C',
    bpm: 120,
    difficulty: 3,
    structure: [],
    chords: ['C', 'G', 'Am', 'F'],
    referenceLinks: [],
    tags: ['rock'],
    contextType: 'band',
    contextId: 'test-band-1',
    createdBy: 'test-user-1',
    visibility: 'band_only',
    confidenceLevel: 3,
    createdDate: new Date()
  }

  beforeEach(async () => {
    repository = new LocalRepository()
    await db.songs.clear()
  })

  afterEach(async () => {
    await db.songs.clear()
  })

  it('should add a song', async () => {
    const result = await repository.addSong(testSong)

    expect(result).toMatchObject({
      title: 'Test Song',
      artist: 'Test Artist'
    })
    expect(result.id).toBeDefined()

    const stored = await db.songs.get(result.id)
    expect(stored).toBeDefined()
    expect(stored?.title).toBe('Test Song')
  })

  it('should get songs by filter', async () => {
    await db.songs.add(testSong)
    await db.songs.add({
      ...testSong,
      id: 'test-song-2',
      contextId: 'other-band'
    })

    const results = await repository.getSongs({
      contextType: 'band',
      contextId: 'test-band-1'
    })

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('test-song-1')
  })

  it('should update a song', async () => {
    await db.songs.add(testSong)

    const updated = await repository.updateSong('test-song-1', {
      title: 'Updated Title',
      confidenceLevel: 5
    })

    expect(updated.title).toBe('Updated Title')
    expect(updated.confidenceLevel).toBe(5)
  })

  it('should delete a song', async () => {
    await db.songs.add(testSong)

    await repository.deleteSong('test-song-1')

    const stored = await db.songs.get('test-song-1')
    expect(stored).toBeUndefined()
  })

  it('should handle non-existent song gracefully', async () => {
    const result = await repository.getSong('non-existent')
    expect(result).toBeNull()
  })

  it('should get all songs when no filter is provided', async () => {
    await db.songs.add(testSong)
    await db.songs.add({
      ...testSong,
      id: 'test-song-2',
      contextId: 'other-band'
    })

    const results = await repository.getSongs()
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it('should filter by createdBy', async () => {
    await db.songs.add(testSong)
    await db.songs.add({
      ...testSong,
      id: 'test-song-2',
      createdBy: 'other-user'
    })

    const results = await repository.getSongs({
      createdBy: 'test-user-1'
    })

    expect(results).toHaveLength(1)
    expect(results[0].createdBy).toBe('test-user-1')
  })

  it('should filter by songGroupId', async () => {
    await db.songs.add({
      ...testSong,
      songGroupId: 'group-1'
    })
    await db.songs.add({
      ...testSong,
      id: 'test-song-2',
      songGroupId: 'group-2'
    })

    const results = await repository.getSongs({
      songGroupId: 'group-1'
    })

    expect(results).toHaveLength(1)
    expect(results[0].songGroupId).toBe('group-1')
  })

  it('should generate ID if not provided', async () => {
    const songWithoutId = { ...testSong }
    delete (songWithoutId as any).id

    const result = await repository.addSong(songWithoutId)
    expect(result.id).toBeDefined()
    expect(typeof result.id).toBe('string')
  })
})

describe('LocalRepository - Bands', () => {
  let repository: LocalRepository

  beforeEach(async () => {
    repository = new LocalRepository()
    await db.bands.clear()
    await db.bandMemberships.clear()
  })

  afterEach(async () => {
    await db.bands.clear()
    await db.bandMemberships.clear()
  })

  it('should add a band', async () => {
    const band = {
      id: 'test-band-1',
      name: 'Test Band',
      description: 'A test band',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    }

    const result = await repository.addBand(band)
    expect(result.name).toBe('Test Band')
    expect(result.id).toBe('test-band-1')
  })

  it('should get bands for a user', async () => {
    // Add bands
    await db.bands.add({
      id: 'band-1',
      name: 'Band 1',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    })
    await db.bands.add({
      id: 'band-2',
      name: 'Band 2',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    })

    // Add memberships
    await db.bandMemberships.add({
      id: 'mem-1',
      userId: 'user-1',
      bandId: 'band-1',
      role: 'admin',
      status: 'active',
      joinedDate: new Date(),
      permissions: ['admin']
    })

    const bands = await repository.getBandsForUser('user-1')
    expect(bands).toHaveLength(1)
    expect(bands[0].id).toBe('band-1')
  })

  it('should get a single band by id', async () => {
    await db.bands.add({
      id: 'band-1',
      name: 'Band 1',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    })

    const band = await repository.getBand('band-1')
    expect(band).toBeDefined()
    expect(band?.name).toBe('Band 1')
  })

  it('should return null for non-existent band', async () => {
    const band = await repository.getBand('non-existent')
    expect(band).toBeNull()
  })

  it('should update a band', async () => {
    await db.bands.add({
      id: 'band-1',
      name: 'Band 1',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    })

    const updated = await repository.updateBand('band-1', {
      name: 'Updated Band Name'
    })

    expect(updated.name).toBe('Updated Band Name')
  })

  it('should delete a band', async () => {
    await db.bands.add({
      id: 'band-1',
      name: 'Band 1',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    })

    await repository.deleteBand('band-1')

    const band = await db.bands.get('band-1')
    expect(band).toBeUndefined()
  })

  it('should filter bands by userId using getBands', async () => {
    await db.bands.add({
      id: 'band-1',
      name: 'Band 1',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    })

    await db.bandMemberships.add({
      id: 'mem-1',
      userId: 'user-1',
      bandId: 'band-1',
      role: 'admin',
      status: 'active',
      joinedDate: new Date(),
      permissions: ['admin']
    })

    const bands = await repository.getBands({ userId: 'user-1' })
    expect(bands).toHaveLength(1)
    expect(bands[0].id).toBe('band-1')
  })

  it('should generate ID for band if not provided', async () => {
    const bandWithoutId = {
      name: 'Test Band',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    }

    const result = await repository.addBand(bandWithoutId as any)
    expect(result.id).toBeDefined()
    expect(typeof result.id).toBe('string')
  })
})
