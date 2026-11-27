import { describe, it, expect } from 'vitest'
import { defaultDir, dirLabel, flipDir } from '../../../src/domain/sort'

describe('sort direction', () => {
  it('starts dates newest first, the rest ascending', () => {
    expect(defaultDir('date')).toBe('desc')
    expect(defaultDir('text')).toBe('asc')
    expect(defaultDir('upcoming')).toBe('asc')
  })
  it('names the order for each kind', () => {
    expect(dirLabel('text', 'asc')).toBe('A–Z')
    expect(dirLabel('text', 'desc')).toBe('Z–A')
    expect(dirLabel('date', 'desc')).toBe('Newest')
    expect(dirLabel('date', 'asc')).toBe('Oldest')
    expect(dirLabel('upcoming', 'asc')).toBe('Soonest')
    expect(dirLabel('upcoming', 'desc')).toBe('Latest')
  })
  it('flips', () => {
    expect(flipDir('asc')).toBe('desc')
    expect(flipDir('desc')).toBe('asc')
  })
})
