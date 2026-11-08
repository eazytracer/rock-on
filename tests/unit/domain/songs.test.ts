import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LIST_VIEW,
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
  it('newest and oldest', () => {
    expect(ids(sortSongs(songs, 'newest', 'asc'))).toBe('bca')
    expect(ids(sortSongs(songs, 'oldest', 'asc'))).toBe('acb')
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
    expect(filterSongs(songs, 'foo', null)).toHaveLength(1)
    expect(filterSongs(songs, 'ten', null)[0].id).toBe('Black')
  })
  it('narrows by tuning', () => {
    expect(filterSongs(songs, '', 'Drop D')[0].id).toBe('Everlong')
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
