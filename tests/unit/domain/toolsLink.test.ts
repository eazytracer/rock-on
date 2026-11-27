import { describe, it, expect } from 'vitest'
import {
  isToolsTab,
  parseToolsParams,
  toolsHref,
} from '../../../src/domain/toolsLink'

describe('toolsHref', () => {
  it('builds each tab with its params', () => {
    expect(toolsHref('tuner')).toBe('/tools/tuner')
    expect(toolsHref('tuner', { tuning: 'drop-d', prev: 'standard' })).toBe(
      '/tools/tuner?tuning=drop-d&prev=standard'
    )
    expect(toolsHref('metronome', { song: 'abc-123' })).toBe(
      '/tools/metronome?song=abc-123'
    )
    expect(toolsHref('metronome', { bpm: 124 })).toBe(
      '/tools/metronome?bpm=124'
    )
    expect(toolsHref('chords', { chord: 'G7' })).toBe('/tools/chords?chord=G7')
  })
  it('skips empty values and encodes labels', () => {
    expect(toolsHref('tuner', { tuning: '', prev: undefined })).toBe(
      '/tools/tuner'
    )
    expect(toolsHref('tuner', { tuning: 'Open C' })).toBe(
      '/tools/tuner?tuning=Open+C'
    )
  })
})

describe('parseToolsParams', () => {
  it('round-trips every param', () => {
    const p = {
      tuning: 'Open C',
      prev: 'drop-d',
      song: 'a1-b2',
      bpm: 124,
      chord: 'F#m7',
    }
    const href = toolsHref('tuner', p)
    expect(parseToolsParams(href.split('?')[1])).toEqual(p)
  })
  it('drops garbage', () => {
    expect(
      parseToolsParams(
        `?bpm=999&song=${encodeURIComponent('<script>')}&chord=H7&tuning=${'x'.repeat(81)}`
      )
    ).toEqual({})
    expect(parseToolsParams('?bpm=12.5')).toEqual({})
    expect(parseToolsParams('?bpm=29')).toEqual({})
    expect(parseToolsParams('?bpm=30')).toEqual({ bpm: 30 })
    expect(parseToolsParams('?tuning=%20%20')).toEqual({})
    expect(parseToolsParams('')).toEqual({})
  })
  it('isToolsTab', () => {
    expect(isToolsTab('tuner')).toBe(true)
    expect(isToolsTab('metronome')).toBe(true)
    expect(isToolsTab('chords')).toBe(true)
    expect(isToolsTab('drums')).toBe(false)
    expect(isToolsTab(undefined)).toBe(false)
  })
})
