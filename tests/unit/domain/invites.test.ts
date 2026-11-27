import { describe, it, expect } from 'vitest'
import {
  expiresIn,
  inviteLink,
  parseInviteCode,
} from '../../../src/domain/invites'

describe('invites', () => {
  it('builds the /j link', () => {
    expect(inviteLink('ROCK2025', 'https://rockon.band')).toBe(
      'https://rockon.band/j/ROCK2025'
    )
  })

  it('takes a code or a pasted link', () => {
    expect(parseInviteCode(' rock-2025 ')).toBe('ROCK2025')
    expect(parseInviteCode('https://rockon.band/j/ab12cd34?x=1')).toBe(
      'AB12CD34'
    )
  })

  it('counts down in hours, then minutes, then expires', () => {
    const now = Date.parse('2026-11-18T12:00:00Z')
    const at = (min: number) => new Date(now + min * 60_000).toISOString()
    expect(expiresIn(at(23 * 60 + 30), now)).toBe('Expires in 23 h')
    expect(expiresIn(at(40), now)).toBe('Expires in 40 min')
    expect(expiresIn(at(-1), now)).toBeNull()
    expect(expiresIn(null, now)).toBe('No expiry')
  })
})
