import { describe, it, expect } from 'vitest'
import {
  setlistStats,
  retuneCount,
  indexTotals,
  previewTitles,
  sortSetlistIndex,
  nextShowSetId,
  showLine,
  deleteSetlistMessage,
  editorRows,
  editorTotals,
  nextSectionLabel,
  moveTarget,
  moveItem,
  startOffsets,
  showStartMinutes,
  railLabel,
  songLength,
  type IndexRow,
  type EditorItem,
  type RowSong,
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
  showMinutes: null,
  showSetTime: null,
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
      { id: 'a', title: 'A', tuning: 'Standard', seconds: 170 },
      { id: 'b', title: 'B', tuning: 'Drop D', seconds: 230 },
      { id: 'c', title: 'C', tuning: 'Drop D', seconds: 0 },
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

describe('deleteSetlistMessage', () => {
  it('names the show that loses its set', () => {
    expect(deleteSetlistMessage('The Crocodile · Sat, Nov 7')).toContain(
      'The Crocodile · Sat, Nov 7 will have no set'
    )
    expect(deleteSetlistMessage(null)).toBe(
      "Songs stay in your catalog. This can't be undone."
    )
  })
})

const songs: Record<string, RowSong> = {
  a: { title: 'About A Girl', tuning: 'Standard', seconds: 168 },
  b: { title: 'Monkey Wrench', tuning: 'Drop D', seconds: 231 },
  c: { id: 'everlong', title: 'Everlong', tuning: 'drop-d', seconds: 250 },
  d: { id: 'black', title: 'Black', tuning: null, seconds: 343 },
}
const items: EditorItem[] = [
  { id: 's1', type: 'section', sectionTitle: 'Set 1' },
  { id: '1', type: 'song', songId: 'a' },
  { id: '2', type: 'song', songId: 'b' },
  { id: '3', type: 'song', songId: 'c' },
  { id: 'br', type: 'break', breakDuration: 15 },
  { id: '4', type: 'song', songId: 'd' },
]

describe('editorRows', () => {
  const rows = editorRows(items, id => songs[id])
  it('numbers songs only', () => {
    expect(rows.map(r => (r.kind === 'song' ? r.number : r.kind))).toEqual([
      'section',
      1,
      2,
      3,
      'break',
      4,
    ])
  })
  it('puts a retune on the song that needs it, across a break', () => {
    expect(rows.map(r => (r.kind === 'song' ? r.retuneFrom : '-'))).toEqual([
      '-',
      null,
      'Standard',
      null,
      '-',
      'drop-d',
    ])
  })
  it('a missing song still takes a number', () => {
    const r = editorRows(
      [{ id: 'x', type: 'song', songId: 'gone' }],
      () => undefined
    )
    expect(r[0]).toMatchObject({ kind: 'song', song: null, number: 1 })
  })
})

describe('editorTotals', () => {
  const rows = editorRows(items, id => songs[id])
  it('adds songs and breaks, counts retunes', () => {
    expect(editorTotals(rows, null)).toEqual({
      songs: 4,
      minutes: 32,
      retunes: 2,
      slot: null,
      over: false,
    })
  })
  it('warns over the show slot', () => {
    expect(editorTotals(rows, 31)).toMatchObject({ slot: 31, over: true })
    expect(editorTotals(rows, 45)).toMatchObject({ slot: 45, over: false })
  })
})

describe('editing helpers', () => {
  it('nextSectionLabel counts sections', () => {
    expect(nextSectionLabel(items)).toBe('Set 2')
    expect(nextSectionLabel([])).toBe('Set 1')
  })
  it('moveTarget: up / down / top, null when it would not move', () => {
    expect(moveTarget(items, '2', 'up')).toBe(1)
    expect(moveTarget(items, '2', 'down')).toBe(3)
    expect(moveTarget(items, '2', 'top')).toBe(0)
    expect(moveTarget(items, 's1', 'up')).toBeNull()
    expect(moveTarget(items, 's1', 'top')).toBeNull()
    expect(moveTarget(items, '4', 'down')).toBeNull()
  })
  it('moveItem matches move_setlist_item', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveItem(['a', 'b'], 0, 99)).toEqual(['b', 'a'])
  })
})

describe('timeline', () => {
  const rows = editorRows(items, id => songs[id])
  it('startOffsets: each row starts when the one before ends', () => {
    expect(startOffsets(rows)).toEqual([0, 0, 168, 399, 649, 1549])
  })
  it('showStartMinutes reads the set time, else the show time', () => {
    expect(showStartMinutes(null, '8:30 PM')).toBe(20 * 60 + 30)
    expect(showStartMinutes(null, '12:05 am')).toBe(5)
    expect(showStartMinutes(null, '20:30')).toBe(20 * 60 + 30)
    expect(
      showStartMinutes(new Date(2026, 10, 7, 21, 0).toISOString(), null)
    ).toBe(21 * 60)
    expect(showStartMinutes(null, null)).toBeNull()
  })
  it('railLabel: set time from the top, or clock time', () => {
    expect(railLabel(0, null)).toBe('0:00')
    expect(railLabel(649, null)).toBe('10:49')
    expect(railLabel(3790, null)).toBe('1:03:10')
    expect(railLabel(0, 20 * 60 + 30)).toBe('8:30')
    expect(railLabel(1549, 23 * 60 + 50)).toBe('12:15')
  })
  it('songLength', () => {
    expect(songLength(250)).toBe('4:10')
    expect(songLength(0)).toBe('')
  })
})
