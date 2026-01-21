import { describe, test, expect } from 'vitest'
import {
  parseDate,
  mapAuditToSong,
  mapAuditToSetlist,
  mapAuditToShow,
  mapAuditToPractice,
  extractItemName,
} from '../../../../src/services/data/auditMappers'

describe('auditMappers', () => {
  describe('parseDate', () => {
    test('parses valid ISO date string', () => {
      const isoDate = '2026-01-15T10:30:00.000Z'
      const result = parseDate(isoDate)
      expect(result).toBeInstanceOf(Date)
      expect(result.toISOString()).toBe(isoDate)
    })

    test('returns default date for null input', () => {
      const result = parseDate(null)
      expect(result).toBeInstanceOf(Date)
      // Should be roughly now
      expect(Date.now() - result.getTime()).toBeLessThan(1000)
    })

    test('returns default date for undefined input', () => {
      const result = parseDate(undefined)
      expect(result).toBeInstanceOf(Date)
    })

    test('returns custom default date when provided', () => {
      const defaultDate = new Date('2020-01-01T00:00:00.000Z')
      const result = parseDate(null, defaultDate)
      expect(result).toEqual(defaultDate)
    })

    test('returns default for invalid date string', () => {
      const result = parseDate('not-a-date')
      expect(result).toBeInstanceOf(Date)
      // Should be roughly now
      expect(Date.now() - result.getTime()).toBeLessThan(1000)
    })

    test('handles date-only strings', () => {
      const result = parseDate('2026-01-15')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2026)
    })
  })

  describe('mapAuditToSong', () => {
    const sampleAuditSong = {
      id: 'song-123',
      title: 'Wonderwall',
      artist: 'Oasis',
      album: 'Whats the Story Morning Glory',
      key: 'F#m',
      tempo: 87, // Note: Supabase uses 'tempo'
      duration: 258,
      difficulty: 3,
      guitar_tuning: 'Standard',
      structure: ['Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus'],
      lyrics: 'Today is gonna be the day...',
      chords: ['F#m', 'A', 'E', 'B'],
      notes: 'Classic acoustic intro',
      reference_links: [
        { url: 'https://youtube.com/watch?v=123', label: 'Tutorial' },
      ],
      tags: ['acoustic', '90s'],
      created_date: '2026-01-10T09:00:00.000Z',
      last_practiced: '2026-01-14T15:30:00.000Z',
      confidence_level: 4,
      context_type: 'band',
      context_id: 'band-abc',
      created_by: 'user-456',
      visibility: 'band',
      song_group_id: 'group-789',
      linked_from_song_id: null,
      version: 2,
      last_modified_by: 'user-789',
    }

    test('maps all fields correctly from snake_case to camelCase', () => {
      const song = mapAuditToSong(sampleAuditSong)

      expect(song.id).toBe('song-123')
      expect(song.title).toBe('Wonderwall')
      expect(song.artist).toBe('Oasis')
      expect(song.album).toBe('Whats the Story Morning Glory')
      expect(song.key).toBe('F#m')
      expect(song.bpm).toBe(87) // tempo → bpm
      expect(song.duration).toBe(258)
      expect(song.difficulty).toBe(3)
      expect(song.guitarTuning).toBe('Standard')
      expect(song.structure).toEqual([
        'Verse',
        'Chorus',
        'Verse',
        'Chorus',
        'Bridge',
        'Chorus',
      ])
      expect(song.lyrics).toBe('Today is gonna be the day...')
      expect(song.chords).toEqual(['F#m', 'A', 'E', 'B'])
      expect(song.notes).toBe('Classic acoustic intro')
      expect(song.referenceLinks).toEqual([
        { url: 'https://youtube.com/watch?v=123', label: 'Tutorial' },
      ])
      expect(song.tags).toEqual(['acoustic', '90s'])
      expect(song.createdDate).toEqual(new Date('2026-01-10T09:00:00.000Z'))
      expect(song.lastPracticed).toEqual(new Date('2026-01-14T15:30:00.000Z'))
      expect(song.confidenceLevel).toBe(4)
      expect(song.contextType).toBe('band')
      expect(song.contextId).toBe('band-abc')
      expect(song.createdBy).toBe('user-456')
      expect(song.visibility).toBe('band')
      expect(song.songGroupId).toBe('group-789')
      expect(song.linkedFromSongId).toBeUndefined()
      expect(song.version).toBe(2)
      expect(song.lastModifiedBy).toBe('user-789')
    })

    test('provides defaults for missing optional fields', () => {
      const minimalSong = {
        id: 'song-min',
        created_date: '2026-01-10T09:00:00.000Z',
      }

      const song = mapAuditToSong(minimalSong)

      expect(song.id).toBe('song-min')
      expect(song.title).toBe('')
      expect(song.artist).toBe('')
      expect(song.album).toBeUndefined()
      expect(song.key).toBe('')
      expect(song.bpm).toBe(120) // Default
      expect(song.duration).toBe(0)
      expect(song.difficulty).toBe(1) // Default
      expect(song.notes).toBe('')
      expect(song.referenceLinks).toEqual([])
      expect(song.tags).toEqual([])
      expect(song.confidenceLevel).toBe(1)
      expect(song.visibility).toBe('band')
      expect(song.version).toBe(0)
    })

    test('handles null lastPracticed', () => {
      const song = mapAuditToSong({
        id: 'song-1',
        last_practiced: null,
      })
      expect(song.lastPracticed).toBeUndefined()
    })
  })

  describe('mapAuditToSetlist', () => {
    const sampleAuditSetlist = {
      id: 'setlist-123',
      name: 'Summer Tour 2026',
      band_id: 'band-abc',
      items: [
        { type: 'song', songId: 'song-1', notes: '' },
        { type: 'break', duration: 15 },
        { type: 'song', songId: 'song-2', notes: '' },
      ],
      status: 'active',
      created_date: '2026-01-05T12:00:00.000Z',
      last_modified: '2026-01-15T18:30:00.000Z',
      version: 5,
      last_modified_by: 'user-123',
    }

    test('maps all fields correctly', () => {
      const setlist = mapAuditToSetlist(sampleAuditSetlist)

      expect(setlist.id).toBe('setlist-123')
      expect(setlist.name).toBe('Summer Tour 2026')
      expect(setlist.bandId).toBe('band-abc')
      expect(setlist.items).toEqual([
        { type: 'song', songId: 'song-1', notes: '' },
        { type: 'break', duration: 15 },
        { type: 'song', songId: 'song-2', notes: '' },
      ])
      expect(setlist.totalDuration).toBe(0) // Calculated separately
      expect(setlist.status).toBe('active')
      expect(setlist.createdDate).toEqual(new Date('2026-01-05T12:00:00.000Z'))
      expect(setlist.lastModified).toEqual(new Date('2026-01-15T18:30:00.000Z'))
      expect(setlist.version).toBe(5)
      expect(setlist.lastModifiedBy).toBe('user-123')
    })

    test('provides defaults for missing fields', () => {
      const minimalSetlist = {
        id: 'setlist-min',
        created_date: '2026-01-01T00:00:00.000Z',
        last_modified: '2026-01-01T00:00:00.000Z',
      }

      const setlist = mapAuditToSetlist(minimalSetlist)

      expect(setlist.name).toBe('')
      expect(setlist.items).toEqual([])
      expect(setlist.status).toBe('draft')
      expect(setlist.version).toBe(0)
    })
  })

  describe('mapAuditToShow', () => {
    const sampleAuditShow = {
      id: 'show-123',
      name: 'New Years Eve Gig',
      venue: 'The Blue Note',
      scheduled_date: '2026-12-31T21:00:00.000Z',
      duration: 180,
      band_id: 'band-abc',
      setlist_id: 'setlist-456',
      status: 'upcoming',
      notes: 'Big crowd expected',
      created_date: '2026-01-10T08:00:00.000Z',
      updated_date: '2026-01-20T14:00:00.000Z',
      version: 3,
      last_modified_by: 'user-123',
    }

    test('maps all fields correctly', () => {
      const show = mapAuditToShow(sampleAuditShow)

      expect(show.id).toBe('show-123')
      expect(show.name).toBe('New Years Eve Gig')
      expect(show.venue).toBe('The Blue Note')
      expect(show.scheduledDate).toEqual(new Date('2026-12-31T21:00:00.000Z'))
      expect(show.duration).toBe(180)
      expect(show.bandId).toBe('band-abc')
      expect(show.setlistId).toBe('setlist-456')
      expect(show.status).toBe('upcoming')
      expect(show.notes).toBe('Big crowd expected')
      expect(show.createdDate).toEqual(new Date('2026-01-10T08:00:00.000Z'))
      expect(show.updatedDate).toEqual(new Date('2026-01-20T14:00:00.000Z'))
      expect(show.version).toBe(3)
      expect(show.lastModifiedBy).toBe('user-123')
    })

    test('provides defaults for missing fields', () => {
      const minimalShow = {
        id: 'show-min',
        scheduled_date: '2026-06-15T20:00:00.000Z',
        created_date: '2026-01-01T00:00:00.000Z',
        updated_date: '2026-01-01T00:00:00.000Z',
      }

      const show = mapAuditToShow(minimalShow)

      expect(show.name).toBe('')
      expect(show.venue).toBe('')
      expect(show.duration).toBe(120) // Default
      expect(show.status).toBe('upcoming')
      expect(show.notes).toBe('')
      expect(show.setlistId).toBeUndefined()
      expect(show.version).toBe(0)
    })
  })

  describe('mapAuditToPractice', () => {
    const sampleAuditPractice = {
      id: 'practice-123',
      scheduled_date: '2026-01-25T19:00:00.000Z',
      start_time: '2026-01-25T19:15:00.000Z',
      end_time: '2026-01-25T21:30:00.000Z',
      duration: 135,
      location: 'Garage Studio',
      type: 'rehearsal',
      objectives: ['Learn new song', 'Practice transitions'],
      completed_objectives: ['Learn new song'],
      songs: ['song-1', 'song-2', 'song-3'],
      band_id: 'band-abc',
      setlist_id: 'setlist-789',
      notes: 'Focus on timing',
      attendees: ['user-1', 'user-2'],
      created_date: '2026-01-20T10:00:00.000Z',
      version: 1,
      last_modified_by: 'user-1',
    }

    test('maps all fields correctly', () => {
      const practice = mapAuditToPractice(sampleAuditPractice)

      expect(practice.id).toBe('practice-123')
      expect(practice.scheduledDate).toEqual(
        new Date('2026-01-25T19:00:00.000Z')
      )
      expect(practice.startTime).toEqual(new Date('2026-01-25T19:15:00.000Z'))
      expect(practice.endTime).toEqual(new Date('2026-01-25T21:30:00.000Z'))
      expect(practice.duration).toBe(135)
      expect(practice.location).toBe('Garage Studio')
      expect(practice.type).toBe('rehearsal')
      expect(practice.status).toBe('scheduled') // Always 'scheduled' in IndexedDB
      expect(practice.objectives).toEqual([
        'Learn new song',
        'Practice transitions',
      ])
      expect(practice.completedObjectives).toEqual(['Learn new song'])
      expect(practice.songs).toEqual(['song-1', 'song-2', 'song-3'])
      expect(practice.bandId).toBe('band-abc')
      expect(practice.setlistId).toBe('setlist-789')
      expect(practice.notes).toBe('Focus on timing')
      expect(practice.attendees).toEqual(['user-1', 'user-2'])
      expect(practice.createdDate).toEqual(new Date('2026-01-20T10:00:00.000Z'))
      expect(practice.version).toBe(1)
      expect(practice.lastModifiedBy).toBe('user-1')
    })

    test('provides defaults for missing fields', () => {
      const minimalPractice = {
        id: 'practice-min',
        scheduled_date: '2026-02-01T18:00:00.000Z',
        created_date: '2026-01-15T12:00:00.000Z',
      }

      const practice = mapAuditToPractice(minimalPractice)

      expect(practice.startTime).toBeUndefined()
      expect(practice.endTime).toBeUndefined()
      expect(practice.duration).toBe(120) // Default
      expect(practice.location).toBe('')
      expect(practice.type).toBe('rehearsal')
      expect(practice.status).toBe('scheduled')
      expect(practice.objectives).toEqual([])
      expect(practice.completedObjectives).toEqual([])
      expect(practice.songs).toEqual([])
      expect(practice.notes).toBe('')
      expect(practice.attendees).toEqual([])
      expect(practice.version).toBe(0)
    })

    test('handles null start_time and end_time', () => {
      const practice = mapAuditToPractice({
        id: 'practice-1',
        scheduled_date: '2026-01-01T00:00:00.000Z',
        created_date: '2026-01-01T00:00:00.000Z',
        start_time: null,
        end_time: null,
      })
      expect(practice.startTime).toBeUndefined()
      expect(practice.endTime).toBeUndefined()
    })
  })

  describe('extractItemName', () => {
    test('uses title for songs', () => {
      const name = extractItemName('songs', 'UPDATE', null, {
        title: 'Wonderwall',
        artist: 'Oasis',
      })
      expect(name).toBe('Wonderwall')
    })

    test('uses name for setlists', () => {
      const name = extractItemName('setlists', 'INSERT', null, {
        name: 'Summer Tour 2026',
      })
      expect(name).toBe('Summer Tour 2026')
    })

    test('uses name for shows', () => {
      const name = extractItemName('shows', 'UPDATE', null, {
        name: 'New Years Eve Gig',
        venue: 'The Blue Note',
      })
      expect(name).toBe('New Years Eve Gig')
    })

    test('uses scheduled_date for practice_sessions', () => {
      const name = extractItemName('practice_sessions', 'INSERT', null, {
        scheduled_date: '2026-01-25T19:00:00.000Z',
        location: 'Studio',
      })
      expect(name).toBe('2026-01-25T19:00:00.000Z')
    })

    test('uses old_values for DELETE actions', () => {
      const name = extractItemName(
        'songs',
        'DELETE',
        { title: 'Deleted Song' },
        null
      )
      expect(name).toBe('Deleted Song')
    })

    test('uses new_values for INSERT actions', () => {
      const name = extractItemName('songs', 'INSERT', null, {
        title: 'New Song',
      })
      expect(name).toBe('New Song')
    })

    test('uses new_values for UPDATE actions', () => {
      const name = extractItemName(
        'songs',
        'UPDATE',
        { title: 'Old Title' },
        { title: 'New Title' }
      )
      expect(name).toBe('New Title')
    })

    test('returns "item" when values are null', () => {
      const name = extractItemName('songs', 'DELETE', null, null)
      expect(name).toBe('item')
    })

    test('returns "item" when name fields are missing', () => {
      const name = extractItemName('songs', 'UPDATE', null, {
        id: 'song-1',
        artist: 'Unknown',
      })
      expect(name).toBe('item')
    })

    test('returns "item" for empty values object', () => {
      const name = extractItemName('setlists', 'UPDATE', null, {})
      expect(name).toBe('item')
    })
  })
})
