import { describe, it, expect } from 'vitest'
import { getPracticeSessionStatus } from '../../../src/utils/dateHelpers'

/**
 * Canonical practice status derivation. Key invariant: 'cancelled' is ONLY ever
 * a user-set status and is NEVER auto-derived from timing.
 */
describe('getPracticeSessionStatus', () => {
  const base = {
    scheduledDate: new Date(),
    duration: 60,
    startTime: null as Date | null,
    endTime: null as Date | null,
  }

  it("honors an explicitly user-set 'cancelled'", () => {
    expect(getPracticeSessionStatus({ ...base, status: 'cancelled' })).toBe(
      'cancelled'
    )
  })

  it("user-set 'cancelled' wins even for a future practice", () => {
    const future = new Date(Date.now() + 86_400_000)
    expect(
      getPracticeSessionStatus({
        ...base,
        scheduledDate: future,
        status: 'cancelled',
      })
    ).toBe('cancelled')
  })

  it("returns 'completed' when the session has an endTime", () => {
    expect(getPracticeSessionStatus({ ...base, endTime: new Date() })).toBe(
      'completed'
    )
  })

  it("returns 'in-progress' when started but not ended", () => {
    expect(getPracticeSessionStatus({ ...base, startTime: new Date() })).toBe(
      'in-progress'
    )
  })

  it("returns 'scheduled' while still within the effective window", () => {
    // Started 10 min ago, 60-min duration → still inside the window.
    const start = new Date(Date.now() - 10 * 60_000)
    expect(
      getPracticeSessionStatus({ ...base, scheduledDate: start, duration: 60 })
    ).toBe('scheduled')
  })

  it("stays 'scheduled' for a future practice", () => {
    const future = new Date(Date.now() + 86_400_000)
    expect(getPracticeSessionStatus({ ...base, scheduledDate: future })).toBe(
      'scheduled'
    )
  })

  it("returns 'completed' (NOT 'cancelled') for a past, never-started practice", () => {
    // Started 5h ago, 60-min duration → ended 4h ago, never started/ended.
    const longAgo = new Date(Date.now() - 5 * 60 * 60 * 1000)
    expect(
      getPracticeSessionStatus({
        ...base,
        scheduledDate: longAgo,
        duration: 60,
      })
    ).toBe('completed')
  })
})
