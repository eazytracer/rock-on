/**
 * One octave of large piano keys (Sound Tools 2): white keys with their
 * letter, C with its octave (C₄), the key note tagged KEY, the picked note in
 * accent. Silent: the caller plays what it wants on pick.
 */
import React from 'react'

const WHITE = [0, 2, 4, 5, 7, 9, 11]
/** Black keys and the white key they sit after. */
const BLACK: [number, number][] = [
  [1, 0],
  [3, 1],
  [6, 3],
  [8, 4],
  [10, 5],
]

export interface PianoProps {
  octave: number
  /** The picked MIDI note, or null. */
  value: number | null
  /** Pitch class of the key note (tagged KEY), or null. */
  keyPc: number | null
  /** Names for the 12 pitch classes, in the song's spelling. */
  names: readonly string[]
  onPick: (midi: number) => void
  testIdPrefix?: string
}

export const Piano: React.FC<PianoProps> = ({
  octave,
  value,
  keyPc,
  names,
  onPick,
  testIdPrefix = 'start-note-key',
}) => {
  const base = (octave + 1) * 12
  return (
    <div
      className="relative h-[150px] flex gap-[3px] select-none"
      role="group"
      aria-label={`Octave ${octave}`}
    >
      {WHITE.map(pc => {
        const on = value === base + pc
        return (
          <button
            key={pc}
            type="button"
            onClick={() => onPick(base + pc)}
            aria-pressed={on}
            aria-label={`${names[pc]}${octave}`}
            data-testid={`${testIdPrefix}-${pc}`}
            className={`relative flex-1 rounded-b-xl flex items-end justify-center pb-2.5 font-mono text-[12px] font-bold ${
              on ? 'bg-accent text-on-accent' : 'bg-[#ece6df] text-[#6b6158]'
            } ${pc === keyPc ? 'shadow-[inset_0_-4px_0_rgb(var(--chord-rgb))]' : ''}`}
          >
            {pc === keyPc && (
              <span
                className={`absolute inset-x-0 bottom-[30px] text-center text-[8.5px] tracking-[.08em] ${
                  on ? 'text-on-accent' : 'text-[#b84d00]'
                }`}
              >
                KEY
              </span>
            )}
            {names[pc]}
            {pc === 0 && (
              <sub
                className={`text-[9px] align-baseline ml-px ${on ? 'text-on-accent' : 'text-[#8a8178]'}`}
              >
                {octave}
              </sub>
            )}
          </button>
        )
      })}
      {BLACK.map(([pc, after]) => {
        const on = value === base + pc
        return (
          <button
            key={pc}
            type="button"
            onClick={() => onPick(base + pc)}
            aria-pressed={on}
            aria-label={`${names[pc]}${octave}`}
            data-testid={`${testIdPrefix}-${pc}`}
            style={{ left: `calc(${((after + 1) / 7) * 100}% - 18.5px)` }}
            className={`absolute top-0 w-[34px] h-[92px] rounded-b-[9px] z-[2] flex items-end justify-center pb-2 font-mono text-[9.5px] shadow-[0_0_0_2px_rgb(var(--bg-2-rgb))] ${
              on ? 'bg-accent text-on-accent' : 'bg-[#141210] text-[#8a8178]'
            } ${pc === keyPc && !on ? 'text-chord' : ''}`}
          >
            {names[pc]}
          </button>
        )
      })}
    </div>
  )
}
