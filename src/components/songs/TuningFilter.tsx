/**
 * Tuning filter (docs/redesign/10 · 1.6). Desktop: one "Tuning" chip that
 * opens an anchored multi-select menu in pitch order; the chip names the
 * selection ("Tuning", "D DROP", "2 tunings"). Phones keep the scrolling row
 * of tuning-coloured chips, one tuning at a time.
 */
import React, { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Chip, Sheet } from '../ui'
import {
  canonicalTuningId,
  tuningColor,
  tuningLabel,
  tuningOrderIndex,
  tuningShortLabel,
} from '../../utils/tunings'

const TuningChip: React.FC<{
  tuning: string
  on: boolean
  onClick: () => void
}> = ({ tuning, on, onClick }) => {
  const c = tuningColor(tuning)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Only ${tuningLabel(tuning)}`}
      onClick={onClick}
      data-testid={`song-tuning-filter-option-${tuning}`}
      className="shrink-0 inline-flex items-center h-[38px] px-3.5 rounded-full font-mono text-[12.5px] font-bold tracking-[.03em] whitespace-nowrap"
      style={
        on
          ? { background: c, color: 'var(--bg-1)' }
          : {
              color: c,
              background: `color-mix(in oklch, ${c} 12%, transparent)`,
              boxShadow: `inset 0 0 0 1.5px color-mix(in oklch, ${c} 35%, transparent)`,
            }
      }
    >
      {tuningShortLabel(tuning)}
    </button>
  )
}

/** Pitch order (built-ins), then anything custom by name. */
const byPitch = (a: string, b: string) =>
  tuningOrderIndex(canonicalTuningId(a)) -
    tuningOrderIndex(canonicalTuningId(b)) || a.localeCompare(b)

export const TuningFilter: React.FC<{
  tunings: string[]
  counts: Map<string, number>
  value: string[]
  onChange: (tunings: string[]) => void
  /** Desktop: one chip with a menu; phones: a scrolling row of chips. */
  menu: boolean
}> = ({ tunings, counts, value, onChange, menu }) => {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  if (!menu)
    return (
      <div
        className="relative flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar -mx-4 px-4"
        data-testid="song-tuning-filter"
      >
        <Chip
          on={!value.length}
          onClick={() => onChange([])}
          className="shrink-0"
          data-testid="song-tuning-filter-all"
        >
          All tunings
        </Chip>
        {tunings.map(t => {
          const on = value.length === 1 && value[0] === t
          return (
            <TuningChip
              key={t}
              tuning={t}
              on={on}
              onClick={() => onChange(on ? [] : [t])}
            />
          )
        })}
      </div>
    )

  const sorted = [...tunings].sort(byPitch)
  const label =
    value.length === 0
      ? 'Tuning'
      : value.length === 1
        ? tuningShortLabel(value[0])
        : `${value.length} tunings`
  const toggle = (t: string) =>
    onChange(value.includes(t) ? value.filter(x => x !== t) : [...value, t])

  return (
    <>
      <Chip
        on={value.length > 0}
        onClick={e => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setAt({ x: r.left, y: r.bottom + 8 })
        }}
        className={`shrink-0 ${value.length === 1 ? 'font-mono' : ''}`}
        aria-haspopup="menu"
        aria-expanded={!!at}
        data-testid="song-tuning-filter"
      >
        {label}
        <ChevronDown size={15} className="opacity-70" />
      </Chip>
      {at && (
        <Sheet
          onClose={() => setAt(null)}
          at={at}
          width={280}
          data-testid="song-tuning-menu"
        >
          <div role="menu" aria-label="Tuning">
            {sorted.map(t => {
              const on = value.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => toggle(t)}
                  className="w-full flex items-center gap-3 min-h-[40px] px-2.5 rounded-xl text-left hover:bg-bg-3"
                  data-testid={`song-tuning-filter-option-${t}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: tuningColor(t) }}
                  />
                  <span className="flex-1 truncate text-[14px] font-semibold text-ink-1">
                    {tuningLabel(t)}
                  </span>
                  <span className="font-mono text-[11.5px] text-ink-3">
                    {counts.get(t) ?? 0}
                  </span>
                  <span className="w-4">
                    {on && <Check size={16} className="text-accent" />}
                  </span>
                </button>
              )
            })}
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onChange([])
                  setAt(null)
                }}
                className="w-full mt-1 min-h-[40px] px-2.5 rounded-xl text-left text-[14px] font-semibold text-accent-ink hover:bg-bg-3"
                data-testid="song-tuning-filter-clear"
              >
                All tunings
              </button>
            )}
          </div>
        </Sheet>
      )}
    </>
  )
}
