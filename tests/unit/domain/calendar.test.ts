import { describe, it, expect } from 'vitest'
import {
  buildAgenda,
  copiedLine,
  copyEdited,
  countdown,
  defaultPracticeDate,
  defaultShowDate,
  deleteShowMessage,
  durationWords,
  endOptions,
  formatPay,
  hoursMinutes,
  isDraftShow,
  parsePay,
  practiceStatus,
  practiceTitle,
  showTitle,
  untilLine,
  weekLater,
  type AgendaSource,
} from '../../../src/domain/calendar'

// Local times throughout, so the tests hold in any timezone.
const at = (d: number, h = 0, m = 0) => new Date(2026, 10, d, h, m)
const iso = (d: Date) => d.toISOString()

const src = (over: Partial<AgendaSource>): AgendaSource => ({
  type: 'show',
  id: 'x',
  name: '',
  venue: null,
  at: iso(at(10, 20)),
  minutes: 45,
  cancelled: false,
  confirmed: false,
  startedAt: null,
  endedAt: null,
  songsTotal: 0,
  songsDone: 0,
  ...over,
})

describe('titles', () => {
  it('a show falls back to its venue, then "New show"', () => {
    expect(showTitle('Fall Kickoff', 'The Crocodile')).toBe('Fall Kickoff')
    expect(showTitle('  ', 'The Crocodile')).toBe('The Crocodile')
    expect(showTitle(null, null)).toBe('New show')
  })
  it('a practice falls back to its weekday', () => {
    expect(practiceTitle('Thursday run', at(12))).toBe('Thursday run')
    expect(practiceTitle(null, at(12))).toBe('Thursday practice')
  })
})

describe('hoursMinutes', () => {
  it('formats minutes as h:mm', () => {
    expect(hoursMinutes(112)).toBe('1:52')
    expect(hoursMinutes(5)).toBe('0:05')
    expect(hoursMinutes(-3)).toBe('0:00')
  })
})

describe('buildAgenda', () => {
  const now = at(8, 12)
  const sources = [
    src({ id: 'later', at: iso(at(20, 20)) }),
    src({ id: 'soon', at: iso(at(10, 20)) }),
    src({ id: 'old', at: iso(at(1, 20)) }),
    src({
      id: 'p',
      type: 'practice',
      name: '',
      at: iso(at(5, 19)),
      minutes: 120,
      startedAt: iso(at(5, 19)),
      endedAt: iso(at(5, 20, 52)),
      songsTotal: 6,
      songsDone: 5,
    }),
  ]
  const jams = [
    {
      id: 'j',
      name: 'Open jam',
      scheduledDate: at(9, 18),
      status: 'scheduled',
    },
  ]

  it('splits upcoming (soonest first) from past (latest first)', () => {
    const { upcoming, past } = buildAgenda(sources, jams, 'all', now)
    expect(upcoming.map(r => r.id)).toEqual(['j', 'soon', 'later'])
    expect(past.map(r => r.id)).toEqual(['p', 'old'])
  })

  it('filters by type', () => {
    const { upcoming, past } = buildAgenda(sources, jams, 'practice', now)
    expect(upcoming).toEqual([])
    expect(past.map(r => r.id)).toEqual(['p'])
  })

  it('keeps a row upcoming until it ends', () => {
    const during = at(10, 20, 30)
    const { upcoming } = buildAgenda(sources, [], 'show', during)
    expect(upcoming[0].id).toBe('soon')
  })

  it('a played practice reads time played and songs reached', () => {
    const { past } = buildAgenda(sources, [], 'practice', now)
    expect(past[0].sub).toBe('1:52 played · 5 of 6 songs')
    expect(past[0].title).toBe('Thursday practice')
    expect(past[0].to).toBe('/practices/p')
  })
})

describe('countdown', () => {
  const now = at(8, 9)
  it('uses calendar days', () => {
    expect(countdown(at(8, 23), now)).toBe('Tonight')
    expect(countdown(at(9, 1), now)).toBe('Tomorrow')
    expect(countdown(at(14, 20), now)).toBe('In 6 days')
    expect(countdown(at(7, 20), now)).toBe('Yesterday')
    expect(countdown(at(5, 20), now)).toBe('3 days ago')
  })
})

describe('default dates', () => {
  it('a new show is next Saturday at 8 PM', () => {
    expect(defaultShowDate(at(8, 10))).toEqual(at(14, 20)) // Sun → Sat
    expect(defaultShowDate(at(14, 10))).toEqual(at(21, 20)) // Sat → next Sat
  })
  it('a new practice is next Thursday at 7 PM', () => {
    expect(defaultPracticeDate(at(8, 10))).toEqual(at(12, 19))
    expect(defaultPracticeDate(at(12, 10))).toEqual(at(19, 19))
  })
  it('duplicating keeps the time a week later', () => {
    expect(weekLater(at(12, 19, 30))).toEqual(at(19, 19, 30))
  })
})

describe('show rules', () => {
  it('a show with no name or venue is a draft', () => {
    expect(isDraftShow({ name: '', venue: ' ' })).toBe(true)
    expect(isDraftShow({ name: '', venue: 'The Crocodile' })).toBe(false)
  })

  it('formats and parses pay in cents', () => {
    expect(formatPay(30000)).toBe('$300')
    expect(formatPay(31250)).toBe('$312.50')
    expect(formatPay(null)).toBe('')
    expect(parsePay('$1,200')).toBe(120000)
    expect(parsePay('312.50')).toBe(31250)
    expect(parsePay(' ')).toBeNull()
    expect(parsePay('lots')).toBeNaN()
    expect(parsePay('-5')).toBeNaN()
  })

  it('names where a set copy came from', () => {
    expect(
      copiedLine({
        name: 'Fall Set',
        sourceSetlistId: 's',
        copiedAt: at(28, 12).toISOString(),
      })
    ).toMatch(/^Copied from Fall Set · Nov 28$/)
    expect(copiedLine({ name: 'Fall Set', sourceSetlistId: null })).toBeNull()
  })

  it('treats a copy as edited only after it changed', () => {
    const t = at(8, 12)
    expect(copyEdited({ copiedAt: t, lastModified: t })).toBe(false)
    expect(
      copyEdited({ copiedAt: t, lastModified: new Date(t.getTime() + 60000) })
    ).toBe(true)
  })

  it('the delete confirm says the source is untouched', () => {
    expect(deleteShowMessage('Fall Set')).toContain(
      'Fall Set itself is untouched.'
    )
    expect(deleteShowMessage(null)).not.toContain('untouched')
  })
})

describe('practices', () => {
  it('status comes from the time', () => {
    const start = at(10, 19)
    expect(practiceStatus(start, 120, at(10, 18))).toBe('upcoming')
    expect(practiceStatus(start, 120, at(10, 20))).toBe('now')
    expect(practiceStatus(start, 120, at(10, 22))).toBe('done')
  })

  it('words the length', () => {
    expect(durationWords(120)).toBe('2 hours')
    expect(durationWords(60)).toBe('1 hour')
    expect(durationWords(150)).toBe('2½ hours')
    expect(durationWords(90)).toBe('1½ hours')
    expect(durationWords(45)).toBe('45 min')
    expect(durationWords(100)).toBe('100 min')
    expect(untilLine(at(10, 19), 120)).toBe('2 hours · until 9:00 PM')
  })

  it('offers end times every 15 minutes with their length', () => {
    const opts = endOptions(at(10, 21))
    expect(opts[0]).toEqual({ minutes: 15, label: '9:15 PM (15 mins)' })
    expect(opts[3]).toEqual({ minutes: 60, label: '10:00 PM (1 hr)' })
    expect(opts[7].label).toBe('11:00 PM (2 hrs)')
    expect(opts).toHaveLength(96)
  })
})
