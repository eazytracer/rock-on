/**
 * The metronome drift test (docs/redesign/12 · 3.4; 05-plan "< 1 ms over 5
 * minutes"). The real engine renders into an OfflineAudioContext, pumped every
 * 25 ms of audio time via suspend() exactly as live; the clicks' onsets in the
 * rendered audio are compared with the ideal grid. Plus a 10 s real-time
 * smoke (worker pump, live context) for the wiring the offline run can't see.
 *
 * Needs no login: /dev/audio-harness is a dev-only page outside the layout.
 */
import { test, expect, type Page } from '@playwright/test'

type Offline = {
  clicks: number
  expected: number
  maxErrorMs: number
  changedAt: number | null
}

async function harness(page: Page) {
  await page.goto('/dev/audio-harness')
  await expect(page.getByTestId('dev-audio-harness-page')).toHaveAttribute(
    'data-ready',
    'true'
  )
}

const offline = (page: Page, args: Record<string, unknown>) =>
  page.evaluate(
    a => window.__runMetronome!(a as never),
    args
  ) as Promise<Offline>

test.describe('Metronome drift', () => {
  test('300 s at 124 BPM 4/4: every click within 1 ms of the grid', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await harness(page)
    const r = await offline(page, {
      bpm: 124,
      sig: '4/4',
      sub: 1,
      seconds: 300,
    })
    expect(r.expected).toBeGreaterThan(600)
    expect(r.clicks).toBe(r.expected)
    expect(r.maxErrorMs).toBeLessThan(1)
  })

  test('260 BPM sixteenths, and 6/8 triplets', async ({ page }) => {
    test.setTimeout(120_000)
    await harness(page)
    const fast = await offline(page, {
      bpm: 260,
      sig: '4/4',
      sub: 4,
      seconds: 60,
    })
    expect(fast.expected).toBeGreaterThan(1000)
    expect(fast.clicks).toBe(fast.expected)
    expect(fast.maxErrorMs).toBeLessThan(1)
    const six = await offline(page, {
      bpm: 90,
      sig: '6/8',
      sub: 3,
      seconds: 30,
    })
    expect(six.clicks).toBe(six.expected)
    expect(six.maxErrorMs).toBeLessThan(1)
  })

  test('a tempo change mid-run lands on the next click', async ({ page }) => {
    await harness(page)
    const r = await offline(page, {
      bpm: 100,
      sig: '4/4',
      sub: 1,
      seconds: 40,
      changeAt: { time: 20.1, bpm: 150 },
    })
    expect(r.changedAt).not.toBeNull()
    expect(r.clicks).toBe(r.expected)
    expect(r.maxErrorMs).toBeLessThan(1)
  })

  test('10 s real-time smoke: the worker pump keeps the queue ahead', async ({
    page,
  }) => {
    await harness(page)
    const r = await page.evaluate(() =>
      window.__runRealMetronome!({ bpm: 124, seconds: 10 })
    )
    expect(r.state).toBe('running')
    // ~10 s plus the 1 s lookahead already queued at the end.
    expect(r.scheduled).toBeGreaterThanOrEqual(20)
    expect(r.scheduled).toBeLessThanOrEqual(25)
    expect(r.maxSpacingErrorMs).toBeLessThan(0.001)
    // Each click was queued well before it played (lookahead ~1 s).
    expect(r.minLeadMs).toBeGreaterThan(500)
  })
})
