/**
 * Tuning filter chips. The chip is the tuning (its colour and short name), not
 * a pill inside a chip. Phones scroll the row; desktop shows what fits on one
 * line and puts the rest behind "+N", which opens a sheet with every tuning.
 */
import React, { useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Chip, Sheet, SheetItem, TuningPill } from '../ui'
import { tuningColor, tuningLabel, tuningShortLabel } from '../../utils/tunings'

const TuningChip: React.FC<{
  tuning: string
  on: boolean
  onClick: () => void
  /** Copy in the hidden measuring row: not focusable, no testid. */
  measure?: boolean
}> = ({ tuning, on, onClick, measure }) => {
  const c = tuningColor(tuning)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Only ${tuningLabel(tuning)}`}
      onClick={onClick}
      tabIndex={measure ? -1 : undefined}
      data-testid={measure ? undefined : `song-tuning-filter-option-${tuning}`}
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

export const TuningFilter: React.FC<{
  tunings: string[]
  counts: Map<string, number>
  value: string | null
  onChange: (tuning: string | null) => void
  /** Desktop: fit to one line with "+N"; phones: horizontal scroll. */
  fit: boolean
}> = ({ tunings, counts, value, onChange, fit }) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(tunings.length)
  const [sheet, setSheet] = useState(false)

  // Count how many chips fit beside "All tunings" and a "+N" chip.
  useLayoutEffect(() => {
    if (!fit) return
    const row = rowRef.current
    const measure = measureRef.current
    if (!row || !measure) return
    const compute = () => {
      const items = [...measure.children] as HTMLElement[]
      const [all, more, ...chips] = items
      const gap = 8
      let used = all.offsetWidth
      let n = 0
      for (const chip of chips) {
        const rest = chips.length - (n + 1)
        const need =
          used + gap + chip.offsetWidth + (rest ? gap + more.offsetWidth : 0)
        if (need > row.clientWidth) break
        used += gap + chip.offsetWidth
        n++
      }
      setShown(n)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(row)
    return () => ro.disconnect()
  }, [fit, tunings])

  const toggle = (t: string) => onChange(value === t ? null : t)
  // The selected tuning always stays visible, even when it would overflow.
  let visible = fit ? tunings.slice(0, shown) : tunings
  if (fit && value && !visible.includes(value) && visible.length)
    visible = [...visible.slice(0, -1), value]
  const hidden = tunings.length - visible.length

  return (
    <div
      ref={rowRef}
      className={`relative flex items-center gap-2 min-w-0 ${
        fit ? 'overflow-hidden' : 'overflow-x-auto no-scrollbar -mx-4 px-4'
      }`}
      data-testid="song-tuning-filter"
    >
      <Chip
        on={!value}
        onClick={() => onChange(null)}
        className="shrink-0"
        data-testid="song-tuning-filter-all"
      >
        All tunings
      </Chip>
      {visible.map(t => (
        <TuningChip
          key={t}
          tuning={t}
          on={value === t}
          onClick={() => toggle(t)}
        />
      ))}
      {fit && hidden > 0 && (
        <Chip
          onClick={() => setSheet(true)}
          className="shrink-0 font-mono"
          data-testid="song-tuning-filter-more"
        >
          +{hidden}
        </Chip>
      )}

      {fit && (
        <div
          ref={measureRef}
          aria-hidden
          className="absolute left-0 top-0 flex gap-2 invisible pointer-events-none"
        >
          <Chip tabIndex={-1}>All tunings</Chip>
          <Chip tabIndex={-1} className="font-mono">
            +{tunings.length}
          </Chip>
          {tunings.map(t => (
            <TuningChip
              key={t}
              tuning={t}
              on={false}
              onClick={() => {}}
              measure
            />
          ))}
        </div>
      )}

      {sheet && (
        <Sheet
          onClose={() => setSheet(false)}
          title="Tuning"
          sub="Show only songs in one tuning"
          data-testid="song-tuning-sheet"
        >
          <div className="divide-y divide-divider max-h-[60vh] overflow-y-auto custom-scrollbar-thin pb-1">
            <SheetItem
              icon={
                value ? (
                  <span className="w-[19px]" />
                ) : (
                  <Check className="!text-accent" />
                )
              }
              label="All tunings"
              onClick={() => {
                onChange(null)
                setSheet(false)
              }}
            />
            {tunings.map(t => (
              <SheetItem
                key={t}
                icon={<TuningPill tuning={t} size="sm" />}
                label={tuningLabel(t)}
                hint={value === t ? 'Showing' : `${counts.get(t) ?? 0} songs`}
                onClick={() => {
                  toggle(t)
                  setSheet(false)
                }}
                data-testid={`song-tuning-sheet-${t}`}
              />
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
