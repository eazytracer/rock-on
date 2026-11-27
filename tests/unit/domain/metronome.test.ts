import { describe, it, expect } from 'vitest'
import {
  BPM_MAX,
  BPM_MIN,
  SIGNATURES,
  SUBS,
  addTap,
  beatSeconds,
  clampBpm,
  clickAt,
  clickTimes,
  cycleAccent,
  defaultAccents,
  marking,
  retime,
  tapTempo,
  type ClickGrid,
  type Click,
} from '../../../src/domain/metronome'

const grid = (over: Partial<ClickGrid> = {}): ClickGrid => ({
  anchor: 0.05,
  anchorIndex: 0,
  bpm: 124,
  sig: '4/4',
  sub: 1,
  accents: defaultAccents('4/4'),
  ...over,
})

/** Feed the grid the way the engine pump does: windows of jittery length. */
function pump(g: ClickGrid, seconds: number, gaps: () => number): Click[] {
  const out: Click[] = []
  let now = 0
  let scheduledUntil = 0
  while (now < seconds) {
    const until = Math.min(seconds, now + 1)
    const from = Math.max(scheduledUntil, now)
    out.push(...clickTimes(g, from, until))
    scheduledUntil = until
    now += gaps()
  }
  return out
}

describe('tempo', () => {
  it('clamps to 30–260 in one constant', () => {
    expect(BPM_MIN).toBe(30)
    expect(BPM_MAX).toBe(260)
    expect(clampBpm(10)).toBe(30)
    expect(clampBpm(999)).toBe(260)
    expect(clampBpm(123.6)).toBe(124)
    expect(clampBpm(NaN)).toBe(120)
  })

  it('markings', () => {
    expect(marking(40)).toBe('LARGO')
    expect(marking(70)).toBe('ADAGIO')
    expect(marking(90)).toBe('ANDANTE')
    expect(marking(124)).toBe('MODERATO')
    expect(marking(164)).toBe('ALLEGRO')
    expect(marking(180)).toBe('VIVACE')
    expect(marking(240)).toBe('PRESTO')
  })

  it('6/8 counts eighths', () => {
    expect(beatSeconds(120, '4/4')).toBe(0.5)
    expect(beatSeconds(120, '6/8')).toBe(0.25)
  })
})

describe('accents', () => {
  it('new signatures accent beat 1 (6/8: 1 and 4)', () => {
    expect(defaultAccents('4/4')).toEqual([
      'accent',
      'normal',
      'normal',
      'normal',
    ])
    expect(defaultAccents('3/4')).toHaveLength(3)
    expect(defaultAccents('6/8')).toEqual([
      'accent',
      'normal',
      'normal',
      'accent',
      'normal',
      'normal',
    ])
  })
  it('a tap cycles accent → normal → silent', () => {
    expect(cycleAccent('accent')).toBe('normal')
    expect(cycleAccent('normal')).toBe('mute')
    expect(cycleAccent('mute')).toBe('accent')
  })
  it('click kinds follow the accents and subdivisions', () => {
    const g = grid({ sub: 2, accents: ['accent', 'normal', 'mute', 'normal'] })
    expect(clickAt(g, 0).kind).toBe('accent')
    expect(clickAt(g, 1).kind).toBe('sub')
    expect(clickAt(g, 2).kind).toBe('beat')
    expect(clickAt(g, 4).kind).toBe('mute')
    expect(clickAt(g, 5).kind).toBe('mute')
    expect(clickAt(g, 8)).toMatchObject({ beat: 0, sub: 0, kind: 'accent' })
  })
})

describe('the click grid', () => {
  it('5 min at 60 / 124 / 260 BPM, every sig × sub: < 1 µs off the ideal grid', () => {
    for (const bpm of [60, 124, 260])
      for (const s of SIGNATURES)
        for (const sub of SUBS) {
          const g = grid({ bpm, sig: s.id, sub, accents: defaultAccents(s.id) })
          const clicks = clickTimes(g, 0, 300)
          const step = beatSeconds(bpm, s.id) / sub
          let worst = 0
          clicks.forEach((c, i) => {
            worst = Math.max(worst, Math.abs(c.when - (0.05 + i * step)))
            expect(c.n).toBe(i)
          })
          expect(worst).toBeLessThan(1e-6)
          expect(clicks.length).toBe(Math.ceil((300 - 0.05) / step - 1e-9))
        }
  })

  it('a pump fed jittery 10–80 ms gaps never skips or doubles a click', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (const bpm of [60, 124, 260]) {
      const g = grid({ bpm, sub: 4 })
      const got = pump(g, 120, () => 0.01 + rnd() * 0.07)
      const ideal = clickTimes(g, 0, 120)
      expect(got.map(c => c.n)).toEqual(ideal.map(c => c.n))
    }
  })

  it('a tempo change lands on the next click', () => {
    const g = grid({ bpm: 120 }) // clicks at 0.05, 0.55, 1.05, …
    const r = retime(g, 1.2, { bpm: 60 })
    expect(r.anchor).toBeCloseTo(1.55, 9)
    expect(r.anchorIndex).toBe(3)
    const after = clickTimes(r, 1.2, 4)
    expect(after.map(c => +c.when.toFixed(6))).toEqual([1.55, 2.55, 3.55])
    expect(after[0].beat).toBe(3)
    expect(after[1].beat).toBe(0)
  })

  it('a click exactly at now counts as heard', () => {
    const g = grid({ bpm: 120 })
    expect(retime(g, 0.55, { bpm: 90 }).anchorIndex).toBe(2)
  })

  it('a new subdivision waits for the next beat; a new signature starts a bar', () => {
    const g = grid({ bpm: 120, sub: 2 }) // clicks every 0.25 s
    const s = retime(g, 0.35, { sub: 3 }) // next click 0.55 is a beat (n = 2)
    expect(s.anchor).toBeCloseTo(0.55, 9)
    expect(s.anchorIndex).toBe(3) // beat 1 × 3
    expect(clickAt(s, s.anchorIndex)).toMatchObject({ beat: 1, sub: 0 })
    const t = retime(g, 0.6, { sig: '3/4', accents: defaultAccents('3/4') })
    expect(t.anchor).toBeCloseTo(1.05, 9)
    expect(clickAt(t, t.anchorIndex)).toMatchObject({ beat: 0, kind: 'accent' })
  })
})

describe('tap tempo', () => {
  it('averages the last 4 taps', () => {
    let taps: number[] = []
    for (const t of [0, 500, 1000, 1500, 2000, 2480]) taps = addTap(taps, t)
    expect(taps).toEqual([1000, 1500, 2000, 2480])
    expect(tapTempo(taps)).toBe(conv(1480 / 3))
  })
  it('resets after 2.5 s and needs two taps', () => {
    let taps = addTap([], 0)
    expect(tapTempo(taps)).toBeNull()
    taps = addTap(taps, 600)
    expect(tapTempo(taps)).toBe(100)
    taps = addTap(taps, 4000)
    expect(taps).toEqual([4000])
  })
  it('clamps', () => {
    expect(tapTempo([0, 100])).toBe(260)
    expect(tapTempo([0, 2400])).toBe(30)
  })
})

function conv(gapMs: number) {
  return Math.round(60000 / gapMs)
}
