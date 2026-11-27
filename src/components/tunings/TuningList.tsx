/**
 * A tuning picker list (the song tuning sheet's look): colour dot, name, the
 * string names on wider screens, a check on the current one. The tuner uses it
 * in its phone sheet; `SongFacts` keeps its own copy for now (docs/redesign/12
 * · 2.6 moves that one here).
 */
import React from 'react'
import { Check } from 'lucide-react'
import { pitchNames } from '../../utils/tunings'

export interface TuningListItem {
  key: string
  name: string
  color: string
  pitches: number[]
}

export const TuningList: React.FC<{
  items: readonly TuningListItem[]
  value: string
  onPick: (key: string) => void
  'data-testid'?: string
}> = ({ items, value, onPick, 'data-testid': testId }) => (
  <div role="menu" data-testid={testId}>
    {items.map(t => {
      const on = t.key === value
      return (
        <button
          key={t.key}
          type="button"
          role="menuitemradio"
          aria-checked={on}
          onClick={() => onPick(t.key)}
          className={`w-full flex items-center gap-3 min-h-[48px] md:min-h-[40px] px-2.5 rounded-xl text-left hover:bg-bg-3 ${on ? 'bg-bg-3' : ''}`}
          data-testid={testId ? `${testId}-option-${t.key}` : undefined}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: t.color }}
          />
          <span className="flex-1 truncate text-[15px] md:text-[14px] font-semibold text-ink-1">
            {t.name}
          </span>
          <span className="font-mono text-[11px] text-ink-3">
            {pitchNames(t.pitches)}
          </span>
          {on && <Check size={16} className="text-accent shrink-0" />}
        </button>
      )
    })}
  </div>
)
