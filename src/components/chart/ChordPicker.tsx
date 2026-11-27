/**
 * "Other chord…" keypad (Song Chart screen 7): root, then type, then an
 * optional bass note; the name builds as you tap. "Type it instead" accepts
 * text like "Fmaj7/A" and tidies it (`normalizeChord`). Returns a stored
 * (ASCII) chord name through `onUse`.
 *
 * Renders the sheet's body only: put it inside a `Sheet` (which owns closing).
 */
import React, { useState } from 'react'
import { Button } from '../ui'
import {
  CHORD_ROOTS,
  PICKER_QUALITIES,
  canonicalQuality,
  chordName,
  normalizeChord,
  parseChord,
  pitchClass,
  showChord,
} from '../../domain/chords'
import { ChordKey } from './ChordKey'

export interface ChordPickerProps {
  /** Chord to start from (e.g. the one being changed). */
  initial?: string
  onUse: (chord: string) => void
  'data-testid'?: string
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="font-mono text-[9.5px] tracking-[.1em] uppercase text-ink-4 mx-1 mb-1.5">
    {children}
  </div>
)

const Key: React.FC<{
  on: boolean
  onClick: () => void
  testId: string
  label?: string
  children: React.ReactNode
}> = ({ on, onClick, testId, label, children }) => (
  <ChordKey
    on={on}
    tone="accent"
    className="h-12 px-0"
    aria-label={label}
    onClick={onClick}
    data-testid={testId}
  >
    {children}
  </ChordKey>
)

const samePc = (a: string | null, b: string | null) =>
  a != null && b != null && pitchClass(a) === pitchClass(b)

export const ChordPicker: React.FC<ChordPickerProps> = ({
  initial,
  onUse,
  'data-testid': testId = 'chord-picker',
}) => {
  const start = initial ? parseChord(initial) : null
  const [root, setRoot] = useState<string | null>(start?.root ?? null)
  const [quality, setQuality] = useState(
    start ? canonicalQuality(start.quality) : ''
  )
  const [bass, setBass] = useState<string | null>(start?.bass ?? null)
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState(initial ?? '')

  const built = root
    ? chordName({ root, quality, bass: samePc(bass, root) ? null : bass })
    : null
  const result = typing ? normalizeChord(text) : built
  const use = () => result && onUse(result)

  return (
    <div data-testid={testId} className="pb-1">
      <div className="text-center mb-3">
        <div
          className="font-mono text-[34px] leading-tight font-bold text-chord min-h-[44px]"
          data-testid="chord-picker-name"
        >
          {result ? showChord(result) : '—'}
        </div>
        <small className="font-mono text-[10px] tracking-[.08em] text-ink-4">
          {typing
            ? text.trim() && !result
              ? 'not a chord yet'
              : 'tidied as you type'
            : 'builds as you tap'}
        </small>
      </div>

      {typing ? (
        <div className="mb-4">
          <label
            htmlFor="chord-picker-text"
            className="block font-mono text-[9.5px] tracking-[.1em] uppercase text-ink-4 mx-1 mb-1.5"
          >
            Chord name
          </label>
          <input
            id="chord-picker-text"
            name="chordName"
            data-testid="chord-picker-text-input"
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Fmaj7/A"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && use()}
            className="w-full h-12 px-4 rounded-xl bg-bg-3 text-ink-1 font-mono text-[16px] placeholder-ink-5 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      ) : (
        <>
          <Label>Root</Label>
          <div className="grid grid-cols-6 gap-1.5 mb-3">
            {CHORD_ROOTS.map(r => (
              <Key
                key={r}
                on={samePc(r, root)}
                onClick={() => setRoot(r)}
                testId={`chord-picker-root-${r}`}
              >
                {showChord(r)}
              </Key>
            ))}
          </div>
          <Label>Type</Label>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {PICKER_QUALITIES.map(q => {
              const value = canonicalQuality(q)
              return (
                <Key
                  key={q}
                  on={value === quality}
                  onClick={() => setQuality(value)}
                  testId={`chord-picker-quality-${q}`}
                >
                  <span className="text-[12.5px]">{q}</span>
                </Key>
              )
            })}
          </div>
          <Label>Bass note · optional</Label>
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            <Key
              on={!bass || samePc(bass, root)}
              onClick={() => setBass(null)}
              testId="chord-picker-bass-none"
              label="No bass note"
            >
              —
            </Key>
            {CHORD_ROOTS.map(r => (
              <Key
                key={r}
                on={samePc(r, bass) && !samePc(bass, root)}
                onClick={() => setBass(r)}
                testId={`chord-picker-bass-${r}`}
              >
                {showChord(r)}
              </Key>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          onClick={() => {
            if (!typing) setText(built ?? '')
            else {
              const c = result ? parseChord(result) : null
              if (c) {
                setRoot(c.root)
                setQuality(c.quality)
                setBass(c.bass)
              }
            }
            setTyping(!typing)
          }}
          data-testid="chord-picker-mode"
        >
          {typing ? 'Use the keypad' : 'Type it instead'}
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={!result}
          onClick={use}
          data-testid="chord-picker-use"
        >
          Use chord
        </Button>
      </div>
    </div>
  )
}
