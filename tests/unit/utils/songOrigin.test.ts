import { describe, it, expect } from 'vitest'
import {
  parseOrigin,
  formatOrigin,
  originLabel,
  originHref,
  songHref,
  stepIn,
} from '../../../src/utils/songOrigin'

describe('parseOrigin', () => {
  it('defaults to Songs when absent', () => {
    expect(parseOrigin('')).toEqual({ kind: 'songs' })
    expect(parseOrigin(null)).toEqual({ kind: 'songs' })
    expect(parseOrigin('?edit=band')).toEqual({ kind: 'songs' })
    expect(parseOrigin('?from=songs')).toEqual({ kind: 'songs' })
  })

  it('reads setlist, show and practice ids', () => {
    expect(parseOrigin('?from=setlist:abc-123')).toEqual({
      kind: 'setlist',
      id: 'abc-123',
    })
    expect(parseOrigin('?from=show:s1')).toEqual({ kind: 'show', id: 's1' })
    expect(parseOrigin('practice:p1')).toEqual({ kind: 'practice', id: 'p1' })
  })

  it('reads a search query, colons and spaces included', () => {
    expect(parseOrigin('?from=search%3Afoo%20bar')).toEqual({
      kind: 'search',
      q: 'foo bar',
    })
    expect(parseOrigin('search:a:b')).toEqual({ kind: 'search', q: 'a:b' })
  })

  it('falls back to Songs on garbage', () => {
    for (const bad of [
      '?from=nope',
      '?from=setlist:',
      '?from=setlist',
      '?from=show:<script>',
      '?from=search:',
      '?from=search:%20%20',
      '?from=:',
    ])
      expect(parseOrigin(bad)).toEqual({ kind: 'songs' })
  })
})

describe('formatOrigin / songHref', () => {
  it('round-trips through the URL', () => {
    for (const o of [
      { kind: 'songs' as const },
      { kind: 'setlist' as const, id: 'x1' },
      { kind: 'show' as const, id: 'y' },
      { kind: 'practice' as const, id: 'z' },
      { kind: 'search' as const, q: 'hey & you?' },
    ]) {
      const href = songHref('s9', o)
      expect(href.startsWith('/songs/s9?')).toBe(true)
      expect(parseOrigin(href.slice(href.indexOf('?')))).toEqual(o)
      expect(parseOrigin(formatOrigin(o))).toEqual(o)
    }
  })
})

describe('originLabel', () => {
  it('names each origin', () => {
    expect(originLabel({ kind: 'songs' })).toBe('Songs')
    expect(originLabel({ kind: 'setlist', id: 'a' }, 'Fall Set')).toBe(
      'Fall Set'
    )
    expect(originLabel({ kind: 'setlist', id: 'a' })).toBe('Setlist')
    expect(originLabel({ kind: 'show', id: 'a' }, 'The Croc')).toBe('The Croc')
    expect(originLabel({ kind: 'practice', id: 'a' })).toBe('Practice')
    expect(originLabel({ kind: 'search', q: 'wonder' })).toBe('Search "wonder"')
  })
})

describe('originHref', () => {
  it('links back with the song selected', () => {
    expect(originHref({ kind: 'songs' }, 's1')).toBe('/songs?selected=s1')
    expect(originHref({ kind: 'songs' })).toBe('/songs')
    expect(originHref({ kind: 'setlist', id: 'L' }, 's1')).toBe(
      '/setlists/L?selected=s1'
    )
    expect(originHref({ kind: 'show', id: 'S' }, 's1')).toBe('/shows/S')
    expect(originHref({ kind: 'practice', id: 'P' })).toBe('/practices/P')
    expect(originHref({ kind: 'search', q: 'a b' })).toBe('/?search=a%20b')
  })
})

describe('stepIn', () => {
  const ids = ['a', 'b', 'c']
  it('finds prev and next', () => {
    expect(stepIn(ids, 'b')).toEqual({
      index: 1,
      total: 3,
      prev: 'a',
      next: 'c',
    })
  })
  it('has no prev at the start and no next at the end', () => {
    expect(stepIn(ids, 'a')).toMatchObject({ prev: undefined, next: 'b' })
    expect(stepIn(ids, 'c')).toMatchObject({ prev: 'b', next: undefined })
  })
  it('returns null when the song is not in the list', () => {
    expect(stepIn(ids, 'zz')).toBeNull()
    expect(stepIn([], 'a')).toBeNull()
  })
})
