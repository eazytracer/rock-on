import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LIST_VIEW,
  catalogList,
  commitTitle,
  filterSongs,
  linkCategory,
  noteMark,
  readListView,
  sortSongs,
  tuningsInUse,
  usageSummary,
} from '../../../src/domain/songs'
import type { Song } from '../../../src/models/Song'

const song = (id: string, over: Partial<Song> = {}): Song =>
  ({
    id,
    title: id,
    artist: '',
    createdDate: new Date('2026-01-01'),
    guitarTuning: 'Standard',
    ...over,
  }) as Song

describe('readListView', () => {
  it('fills missing and wrong-typed fields from the default', () => {
    const v = readListView({ density: 'compact', bpm: 'yes' })
    expect(v.density).toBe('compact')
    expect(v.bpm).toBe(DEFAULT_LIST_VIEW.bpm)
    expect(readListView(null)).toEqual(DEFAULT_LIST_VIEW)
  })
  it('moves the old Newest / Oldest sorts to Date added with a direction', () => {
    expect(readListView({ sort: 'newest', dir: 'asc' })).toMatchObject({
      sort: 'added',
      dir: 'desc',
    })
    expect(readListView({ sort: 'oldest' })).toMatchObject({
      sort: 'added',
      dir: 'asc',
    })
    expect(readListView({ sort: 'bogus' }).sort).toBe('title')
  })
})

describe('sortSongs', () => {
  const songs = [
    song('b', { artist: 'Zed', createdDate: new Date('2026-03-01') }),
    song('a', { artist: 'Amy', createdDate: new Date('2026-01-01') }),
    song('c', { artist: 'Amy', createdDate: new Date('2026-02-01') }),
  ]
  const ids = (s: Song[]) => s.map(x => x.id).join('')

  it('title both ways', () => {
    expect(ids(sortSongs(songs, 'title', 'asc'))).toBe('abc')
    expect(ids(sortSongs(songs, 'title', 'desc'))).toBe('cba')
  })
  it('artist, then title', () => {
    expect(ids(sortSongs(songs, 'artist', 'asc'))).toBe('acb')
  })
  it('date added both ways', () => {
    expect(ids(sortSongs(songs, 'added', 'desc'))).toBe('bca')
    expect(ids(sortSongs(songs, 'added', 'asc'))).toBe('acb')
  })
  it('next show puts unscheduled songs last', () => {
    const at = new Map([
      ['c', 1],
      ['b', 2],
    ])
    expect(ids(sortSongs(songs, 'nextShow', 'asc', at))).toBe('cba')
    expect(ids(sortSongs(songs, 'nextShow', 'desc', at))).toBe('bca')
  })
})

describe('filterSongs', () => {
  const songs = [
    song('Everlong', { artist: 'Foo Fighters', guitarTuning: 'Drop D' }),
    song('Black', { artist: 'Pearl Jam', album: 'Ten' }),
  ]
  it('matches title, artist or album', () => {
    expect(filterSongs(songs, 'foo')).toHaveLength(1)
    expect(filterSongs(songs, 'ten')[0].id).toBe('Black')
  })
  it('narrows by tuning', () => {
    expect(filterSongs(songs, '', ['Drop D'])[0].id).toBe('Everlong')
  })
})

describe('small helpers', () => {
  it('link categories', () => {
    expect(linkCategory({ icon: 'spotify' })).toBe('audio')
    expect(linkCategory({ icon: 'dropbox' })).toBe('cloud')
    expect(linkCategory({ icon: 'other' })).toBe('link')
  })
  it('note marks', () => {
    expect(noteMark(true, true)).toBe('both')
    expect(noteMark(false, true)).toBe('mine')
    expect(noteMark(false, false)).toBe('none')
  })
  it('tunings in use, most common first', () => {
    expect(
      tuningsInUse([
        song('a', { guitarTuning: 'Drop D' }),
        song('b'),
        song('c', { guitarTuning: 'Drop D' }),
      ])
    ).toEqual(['Drop D', 'Standard'])
  })
  it('usage summary', () => {
    expect(
      usageSummary([
        { kind: 'setlist', name: 'Fall Set' },
        { kind: 'show', name: 'Gig' },
      ])
    ).toBe('Used in Fall Set and 1 show')
    expect(usageSummary([])).toBe('')
  })
})

describe('catalogList', () => {
  const songs = [
    song('Black', { artist: 'Pearl Jam' }),
    song('Everlong', { artist: 'Foo Fighters', guitarTuning: 'Drop D' }),
    song('Alive', { artist: 'Pearl Jam' }),
    song('Hidden', { guitarTuning: 'Drop D' }),
  ]
  const hidden = new Set(['Hidden'])
  const ids = (l: Song[]) => l.map(s => s.id)

  it('sorts, filters and drops hidden songs like the Songs list', () => {
    const view = {
      ...DEFAULT_LIST_VIEW,
      sort: 'title' as const,
      dir: 'asc' as const,
    }
    expect(
      ids(catalogList(songs, view, hidden, { query: '', tunings: [] }))
    ).toEqual(['Alive', 'Black', 'Everlong'])
    expect(
      ids(catalogList(songs, view, hidden, { query: 'pearl', tunings: [] }))
    ).toEqual(['Alive', 'Black'])
    expect(
      ids(catalogList(songs, view, hidden, { query: '', tunings: ['Drop D'] }))
    ).toEqual(['Everlong'])
  })

  it('keeps hidden songs when Show hidden is on', () => {
    const view = {
      ...DEFAULT_LIST_VIEW,
      sort: 'title' as const,
      dir: 'desc' as const,
      showHidden: true,
    }
    expect(
      ids(catalogList(songs, view, hidden, { query: '', tunings: ['Drop D'] }))
    ).toEqual(['Hidden', 'Everlong'])
  })
})

describe('commitTitle', () => {
  it('reverts an empty title to the old one', () => {
    expect(commitTitle('   ', 'Everlong')).toEqual({
      title: 'Everlong',
      reverted: true,
      changed: false,
    })
  })
  it('trims and reports a change', () => {
    expect(commitTitle('  Monkey Wrench ', 'Everlong')).toEqual({
      title: 'Monkey Wrench',
      reverted: false,
      changed: true,
    })
    expect(commitTitle('Everlong', 'Everlong').changed).toBe(false)
  })
})
