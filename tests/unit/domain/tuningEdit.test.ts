import { describe, it, expect } from 'vitest'
import {
  STRING_COUNTS,
  TUNING_SWATCHES,
  autoColour,
  bassEquivalent,
  canStepAll,
  customColour,
  firstFreeSwatch,
  matchTuning,
  okhex,
  standardFor,
  stepAll,
  stepString,
  stringWidths,
  themedSwatch,
} from '../../../src/domain/tuningEdit'
import { BUILTIN_TUNINGS } from '../../../src/utils/tunings'

const E6 = [40, 45, 50, 55, 59, 64]

describe('standardFor', () => {
  it('has a standard for every string count the editor offers', () => {
    for (const inst of ['guitar', 'bass'] as const)
      for (const n of STRING_COUNTS[inst]) {
        const std = standardFor(inst, n)!
        expect(std).toHaveLength(n)
        // Matches the built-in standard with that count.
        expect(
          BUILTIN_TUNINGS.some(
            t =>
              t.instrument === inst &&
              t.pitches.length === n &&
              t.pitches.every((p, i) => p === std[i])
          )
        ).toBe(true)
      }
  })

  it('is null outside decision 6', () => {
    expect(standardFor('guitar', 12)).toBeNull()
    expect(standardFor('bass', 3)).toBeNull()
  })
})

describe('stepString', () => {
  it('moves one string a half step', () => {
    expect(stepString(E6, E6, 0, -1)).toEqual([39, 45, 50, 55, 59, 64])
    expect(stepString(E6, E6, 5, 1)).toEqual([40, 45, 50, 55, 59, 65])
  })

  it('stops an octave down and 7 half steps up from standard', () => {
    const low = stepString([28, 45, 50, 55, 59, 64], E6, 0, -1)
    expect(low[0]).toBe(28)
    const high = stepString([47, 45, 50, 55, 59, 64], E6, 0, 1)
    expect(high[0]).toBe(47)
    expect(stepString([29, 45, 50, 55, 59, 64], E6, 0, -1)[0]).toBe(28)
  })
})

describe('stepAll', () => {
  it('moves every string together', () => {
    expect(stepAll(E6, E6, -1)).toEqual([39, 44, 49, 54, 58, 63])
  })

  it('stops if any string would pass its limit', () => {
    const p = [40, 45, 50, 55, 59, 71] // high E at +7
    expect(canStepAll(p, E6, 1)).toBe(false)
    expect(stepAll(p, E6, 1)).toBe(p)
    expect(canStepAll(p, E6, -1)).toBe(true)
  })
})

describe('matchTuning', () => {
  const builtins = BUILTIN_TUNINGS.map(t => ({ ...t }))
  it('finds a built-in with the same strings', () => {
    expect(
      matchTuning([38, 45, 50, 55, 59, 64], 'guitar', builtins)?.name
    ).toBe('Drop D')
    expect(matchTuning([28, 33, 38, 43], 'bass', builtins)?.slug).toBe(
      'bass-standard'
    )
  })

  it('respects the instrument and skips the excluded tuning', () => {
    const mine = {
      name: 'Mine',
      instrument: 'guitar' as const,
      pitches: [36, 43, 48, 55, 60, 64],
    }
    expect(matchTuning(mine.pitches, 'bass', [mine])).toBeNull()
    expect(matchTuning(mine.pitches, 'guitar', [mine])).toBe(mine)
    expect(matchTuning(mine.pitches, 'guitar', [mine], mine)).toBeNull()
  })

  it('returns null for a new set of strings', () => {
    expect(matchTuning([36, 43, 48, 55, 60, 64], 'guitar', builtins)).toBeNull()
  })
})

describe('colours', () => {
  it('ports the kit okhex / customTuning maths', () => {
    // Values from design/source/kit/rock.js run in the browser.
    expect(autoColour([36, 43, 48, 55, 60, 64], E6)).toEqual({
      dark: '#01cce8',
      light: '#017f90',
    })
    expect(autoColour(E6, E6)).toEqual({ dark: '#5be79d', light: '#12935a' })
    expect(okhex(0.66, 0.16, 345)).toBe('#d465a8')
  })

  it('has the 12 Custom Tuning swatches', () => {
    expect(TUNING_SWATCHES).toHaveLength(12)
    expect(TUNING_SWATCHES[0]).toEqual({ dark: '#d465a8', light: '#91256c' })
    expect(TUNING_SWATCHES[11]).toEqual({ dark: '#dee053', light: '#8c8c01' })
  })

  it('opens on the first swatch not used in the context', () => {
    expect(firstFreeSwatch([])).toBe('#d465a8')
    expect(firstFreeSwatch(['#D465A8', null])).toBe(TUNING_SWATCHES[1].dark)
  })

  it('shows a swatch in the theme shade, other colours as stored', () => {
    expect(themedSwatch('#d465a8', 'light')).toBe('#91256c')
    expect(themedSwatch('#ff0000', 'light')).toBe('#ff0000')
  })

  it('custom colour falls back to automatic', () => {
    expect(
      customColour({ instrument: 'guitar', pitches: E6, color: null })
    ).toBe('#5be79d')
    expect(
      customColour({ instrument: 'guitar', pitches: E6, color: '#d465a8' })
    ).toBe('#d465a8')
  })
})

describe('stringWidths', () => {
  it('draws strings thinner from low to high', () => {
    for (const inst of ['guitar', 'bass'] as const)
      for (const n of STRING_COUNTS[inst]) {
        const w = stringWidths(inst, n)
        expect(w).toHaveLength(n)
        for (let i = 1; i < n; i++) expect(w[i]).toBeLessThan(w[i - 1])
      }
  })
})

describe('bassEquivalent', () => {
  it('takes the four lowest strings an octave down', () => {
    expect(bassEquivalent(E6)).toEqual([28, 33, 38, 43])
  })
})
