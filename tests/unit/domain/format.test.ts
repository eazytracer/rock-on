import { describe, it, expect } from 'vitest'
import { formatSeconds, splitMatch } from '../../../src/domain/format'

describe('formatSeconds', () => {
  it('formats minutes and padded seconds', () => {
    expect(formatSeconds(258)).toBe('4:18')
    expect(formatSeconds(60)).toBe('1:00')
    expect(formatSeconds(5)).toBe('0:05')
  })
  it('is empty for missing values', () => {
    expect(formatSeconds(null)).toBe('')
    expect(formatSeconds(undefined)).toBe('')
  })
})

describe('splitMatch', () => {
  it('marks every case-insensitive match', () => {
    expect(splitMatch('Everybody Ever', 'ever')).toEqual([
      { text: 'Ever', match: true },
      { text: 'ybody ', match: false },
      { text: 'Ever', match: true },
    ])
  })
  it('returns the whole text when the query is empty', () => {
    expect(splitMatch('Black', ' ')).toEqual([{ text: 'Black', match: false }])
  })
})
