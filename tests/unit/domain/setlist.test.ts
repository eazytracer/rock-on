import { describe, it, expect } from 'vitest'
import {
  setlistStats,
  retuneCount,
  indexTotals,
  previewTitles,
  sortSetlistIndex,
  nextShowSetId,
  showLine,
  type IndexRow,
} from '../../../src/domain/setlist'

describe('setlistStats', () => {
  it('counts songs and adds song and break lengths', () => {
    const durations: Record<string, number> = { a: 200, b: 100 }
    expect(
      setlistStats(
        [
          { type: 'section' },
          { type: 'song', songId: 'a' },
          { type: 'break', breakDuration: 5 },
          { type: 'song', songId: 'b' },
          { type: 'song', songId: 'missing' },
        ],
        id => durations[id]
      )
    ).toEqual({ songCount: 3, seconds: 600 })
  })
})

const row = (over: Partial<IndexRow>): IndexRow => ({
  id: 'x',
  name: 'Set',
  lastModified: '2026-11-01T00:00:00Z',
  showId: null,
  showName: null,
  showVenue: null,
  showAt: null,
  songs: [],
  breakMinutes: 0,
  ...over,
})

describe('retuneCount', () => {
  it('counts adjacent tuning changes, matching spellings', () => {
    expect(retuneCount(['Standard', 'Drop D', 'drop-d', 'Standard'])).toBe(2)
    expect(retuneCount([null, 'Standard'])).toBe(0)
    expect(retuneCount([])).toBe(0)
  })
})

describe('indexTotals / previewTitles', () => {
  const r = row({
    songs: [
      { title: 'A', tuning: 'Standard', seconds: 170 },
      { title: 'B', tuning: 'Drop D', seconds: 230 },
      { title: 'C', tuning: 'Drop D', seconds: 0 },
    ],
    breakMinutes: 15,
  })
  it('songs, minutes (songs + breaks, rounded) and retunes', () => {
    expect(indexTotals(r)).toEqual({ songs: 3, minutes: 22, retunes: 1 })
  })
  it('joins the first titles', () => {
    expect(previewTitles(r, 2)).toBe('A · B')
  })
})

describe('sortSetlistIndex', () => {
  const now = new Date(2026, 10, 8, 20, 0)
  const rows = [
    row({ id: 'z', name: 'Zed', lastModified: '2026-11-05T00:00:00Z' }),
    row({
      id: 'late',
      name: 'Late',
      showAt: new Date(2026, 10, 20).toISOString(),
    }),
    row({
      id: 'soon',
      name: 'Soon',
      showAt: new Date(2026, 10, 8, 9).toISOString(),
    }),
    row({
      id: 'past',
      name: 'Alpha',
      showAt: new Date(2026, 9, 1).toISOString(),
    }),
  ]
  it('next show: upcoming soonest first (today counts), then by name', () => {
    expect(sortSetlistIndex(rows, 'nextShow', now).map(r => r.id)).toEqual([
      'soon',
      'late',
      'past',
      'z',
    ])
    expect(nextShowSetId(rows, now)).toBe('soon')
  })
  it('name and updated', () => {
    expect(sortSetlistIndex(rows, 'name', now).map(r => r.id)).toEqual([
      'past',
      'late',
      'soon',
      'z',
    ])
    expect(sortSetlistIndex(rows, 'updated', now)[0].id).toBe('z')
  })
  it('no upcoming show → no next-show set', () => {
    expect(nextShowSetId([rows[0], rows[3]], now)).toBeNull()
  })
})

describe('showLine', () => {
  it('venue (or show name) and the date', () => {
    const at = new Date(2026, 10, 7, 21).toISOString()
    expect(
      showLine(row({ showAt: at, showVenue: 'The Crocodile', showName: 'Gig' }))
    ).toBe('The Crocodile · Sat, Nov 7')
    expect(showLine(row({ showAt: at, showName: 'Gig' }))).toBe(
      'Gig · Sat, Nov 7'
    )
    expect(showLine(row({}))).toBeNull()
  })
})
