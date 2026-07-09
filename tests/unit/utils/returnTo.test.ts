import { describe, it, expect } from 'vitest'
import { sanitizeReturnTo, encodeReturnTo } from '../../../src/utils/returnTo'

describe('sanitizeReturnTo', () => {
  it('accepts a simple same-origin path', () => {
    expect(sanitizeReturnTo('/events')).toBe('/events')
  })

  it('accepts a same-origin path with query string', () => {
    expect(sanitizeReturnTo('/events?join=ABC123')).toBe('/events?join=ABC123')
  })

  it('decodes an encoded relative path', () => {
    const encoded = encodeReturnTo('/events?join=ABC123')
    expect(sanitizeReturnTo(encoded)).toBe('/events?join=ABC123')
  })

  it('returns null for null/undefined/empty', () => {
    expect(sanitizeReturnTo(null)).toBeNull()
    expect(sanitizeReturnTo(undefined)).toBeNull()
    expect(sanitizeReturnTo('')).toBeNull()
  })

  it('rejects absolute http(s) URLs (open redirect)', () => {
    expect(sanitizeReturnTo('https://evil.example/phish')).toBeNull()
    expect(sanitizeReturnTo('http://evil.example')).toBeNull()
  })

  it('rejects the encoded form of an absolute URL', () => {
    expect(
      sanitizeReturnTo(encodeURIComponent('https://evil.example'))
    ).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeReturnTo('//evil.example')).toBeNull()
    expect(sanitizeReturnTo(encodeURIComponent('//evil.example'))).toBeNull()
  })

  it('rejects backslash tricks that browsers treat as host separators', () => {
    expect(sanitizeReturnTo('/\\evil.example')).toBeNull()
    expect(sanitizeReturnTo('/\\/evil.example')).toBeNull()
  })

  it('rejects paths that do not start with a slash', () => {
    expect(sanitizeReturnTo('events')).toBeNull()
    expect(sanitizeReturnTo('javascript:alert(1)')).toBeNull()
  })

  it('rejects malformed percent-encoding', () => {
    expect(sanitizeReturnTo('%')).toBeNull()
  })
})
