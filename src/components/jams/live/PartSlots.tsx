/**
 * A song's parts as the console's stage-grade grid (64 px): who's on each, or
 * open with how many hands are up; tap one to fill it. Lists use the plan's
 * small `SlotChips`.
 */
import React from 'react'
import { Hand as HandIcon } from 'lucide-react'
import type { JamItem, JamPerson } from '../../../hooks/useJam'
import { firstName, type Slot } from './live'

const SHORT: Record<string, string> = {
  vox: 'VOX',
  guitar: 'GTR',
  bass: 'BASS',
  drums: 'DRUMS',
  keys: 'KEYS',
}

const shortName = (item: JamItem, slot: Slot) => {
  const base = slot.label
    ? slot.label.toUpperCase()
    : (SHORT[slot.key] ?? 'OTHER')
  const many = item.slots.filter(
    s => s.key === slot.key && (s.label ?? '') === (slot.label ?? '')
  ).length
  return many > 1 ? `${base} ${slot.nth}` : base
}

const Initial: React.FC<{ name: string; house?: boolean }> = ({
  name,
  house,
}) => (
  <span
    className={`grid place-items-center w-7 h-7 shrink-0 rounded-full text-[11px] font-bold ${
      house ? 'bg-accent text-on-accent' : 'bg-bg-1 text-ink-1'
    }`}
  >
    {name.slice(0, 1).toUpperCase()}
  </span>
)

export const PartSlots: React.FC<{
  item: JamItem
  people?: JamPerson[]
  /** Tap a slot (open or filled) to fill / change it. */
  onSlot?: (slot: Slot) => void
  'data-testid'?: string
}> = ({ item, people = [], onSlot, 'data-testid': testId }) => {
  const house = new Set(
    people.filter(p => p.is_house).map(p => p.participant_id)
  )
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid={testId}>
      {item.slots.map((s, i) => {
        const isHouse = !!s.cast && house.has(s.cast.participant_id)
        const body = (
          <>
            <small className="flex items-center gap-1 font-mono text-[10px] tracking-[.08em] text-ink-3 truncate">
              {shortName(item, s)}
              {isHouse && <span className="text-accent-ink">· HOUSE</span>}
            </small>
            <span className="flex items-center gap-1.5 min-w-0 w-full">
              {s.cast ? (
                <>
                  <Initial name={s.cast.name} house={isHouse} />
                  <span className="truncate">{firstName(s.cast.name)}</span>
                </>
              ) : (
                <>
                  <span className="text-ink-3">Open</span>
                  {s.raised > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[12px] text-ink-2">
                      <HandIcon size={13} />
                      {s.raised}
                    </span>
                  )}
                  {onSlot && (
                    <em className="ml-auto not-italic text-[13px] text-accent-ink">
                      Fill
                    </em>
                  )}
                </>
              )}
            </span>
          </>
        )
        const cls = `flex flex-col justify-center items-start gap-0.5 min-h-16 rounded-2xl px-3 py-1.5 text-[16px] font-bold min-w-0 ${
          s.cast
            ? isHouse
              ? 'bg-accent/15'
              : 'bg-bg-3'
            : 'shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'
        }`
        return onSlot ? (
          <button
            key={i}
            type="button"
            onClick={() => onSlot(s)}
            className={`${cls} text-left hover:bg-bg-4`}
            data-testid={`slot-${s.key}${s.label ? `-${s.label.toLowerCase()}` : ''}-${s.nth}`}
            data-gap={s.gap || undefined}
          >
            {body}
          </button>
        ) : (
          <div key={i} className={cls} data-gap={s.gap || undefined}>
            {body}
          </div>
        )
      })}
    </div>
  )
}
