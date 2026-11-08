import { describe, it, expect } from 'vitest'
import { setlistStats } from '../../../src/domain/setlist'

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
