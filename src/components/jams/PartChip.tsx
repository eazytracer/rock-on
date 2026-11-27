/**
 * Part chips. A slot on a song: filled (initial · name), open (outlined, with
 * the hands up), yours (accent). `PartPicker` is the multi-select chip grid
 * (Vocals … Keys plus custom parts typed in) used by settings, the request
 * form, the parts editor and joining.
 */
import React, { useState } from 'react'
import { Hand, Plus } from 'lucide-react'
import type { JamItem } from '../../hooks/useJam'
import { PART_LABEL, partName } from '../../hooks/useJam'
import type { Part, PartKey } from '../../services/api/jams'
import { PART_COLOR, PART_KEYS, distinctParts, partId, samePart } from './parts'

type Slot = JamItem['slots'][number]

const firstName = (n: string) => n.split(' ')[0]

export const SlotChip: React.FC<{
  slot: Slot
  /** My participant id: my cast slot shows in the accent. */
  me?: string | null
  /** True when I have a hand up on this part. */
  raisedByMe?: boolean
  onClick?: () => void
  'data-testid'?: string
}> = ({ slot, me, raisedByMe, onClick, 'data-testid': testId }) => {
  const name = partName(slot, slot.nth)
  const cast = slot.cast
  const mine = !!cast && !!me && cast.participant_id === me
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={
        onClick
          ? (e: React.MouseEvent) => {
              e.stopPropagation()
              onClick()
            }
          : undefined
      }
      data-testid={testId}
      data-gap={slot.gap || undefined}
      data-mine={mine || raisedByMe || undefined}
      aria-label={
        cast
          ? `${name}: ${cast.name}`
          : `${name}: open, ${slot.raised} hands up`
      }
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap ${
        mine
          ? 'bg-accent text-on-accent'
          : cast
            ? 'bg-bg-3 text-ink-1'
            : raisedByMe
              ? 'text-accent-ink shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb))]'
              : 'text-ink-3 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))] border-dashed'
      } ${onClick ? 'hover:brightness-110' : ''}`}
    >
      {!mine && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: PART_COLOR[slot.key] }}
          aria-hidden
        />
      )}
      {name}
      {cast && <span className="font-normal">· {firstName(cast.name)}</span>}
      {!cast && slot.raised > 0 && (
        <span className="inline-flex items-center gap-0.5 font-mono text-[11px]">
          <Hand size={12} aria-hidden />
          {slot.raised}
        </span>
      )}
    </Tag>
  )
}

/** All the slots of a song, in order. */
export const SlotChips: React.FC<{
  item: JamItem
  me?: string | null
  onSlot?: (slot: Slot) => void
}> = ({ item, me, onSlot }) => {
  const mineUp = new Set(
    item.hands.filter(h => h.mine && h.status === 'raised').map(h => partId(h))
  )
  return (
    <span
      className="flex flex-wrap gap-1.5 pt-1"
      data-testid={`jam-item-parts-${item.id}`}
    >
      {item.slots.map((s, i) => (
        <SlotChip
          key={i}
          slot={s}
          me={me}
          raisedByMe={!s.cast && mineUp.has(partId(s))}
          onClick={onSlot ? () => onSlot(s) : undefined}
          data-testid={`jam-slot-${item.id}-${s.key}${s.label ? `-${s.label.toLowerCase()}` : ''}-${s.nth}`}
        />
      ))}
    </span>
  )
}

/**
 * Multi-select parts. `allowRepeat` (the per-song editor) makes each tap add
 * one more slot; otherwise a tap toggles the part.
 */
export const PartPicker: React.FC<{
  value: Part[]
  onChange: (parts: Part[]) => void
  /** Extra parts offered as chips (e.g. a jam's custom parts). */
  extra?: Part[]
  testId: string
  label?: string
}> = ({ value, onChange, extra = [], testId, label }) => {
  const [custom, setCustom] = useState<string | null>(null)
  const offered = distinctParts([
    ...PART_KEYS.map(key => ({ key })),
    ...extra,
    ...value,
  ])
  const on = (p: Part) => value.some(v => samePart(v, p))
  const toggle = (p: Part) =>
    onChange(on(p) ? value.filter(v => !samePart(v, p)) : [...value, p])
  const addCustom = () => {
    const l = custom?.trim()
    setCustom(null)
    if (!l) return
    const p: Part = { key: 'other', label: l.slice(0, 30) }
    if (!on(p)) onChange([...value, p])
  }
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-1.5"
      data-testid={testId}
    >
      {offered.map(p => (
        <PartToggle
          key={partId(p)}
          part={p}
          on={on(p)}
          onClick={() => toggle(p)}
          data-testid={`${testId}-${p.label ? p.label.toLowerCase().replace(/\s+/g, '-') : p.key}`}
        />
      ))}
      {custom === null ? (
        <button
          type="button"
          onClick={() => setCustom('')}
          className="inline-flex items-center gap-1 h-[38px] px-3 rounded-full text-[13.5px] font-semibold text-ink-2 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]"
          data-testid={`${testId}-custom`}
        >
          <Plus size={14} /> Other
        </button>
      ) : (
        <input
          id={`${testId}-custom-input`}
          name="customPart"
          data-testid={`${testId}-custom-input`}
          autoFocus
          value={custom}
          maxLength={30}
          onChange={e => setCustom(e.target.value)}
          onBlur={addCustom}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          placeholder="e.g. Harmonica"
          className="h-[38px] w-36 px-3 rounded-full bg-bg-3 text-[13.5px] text-ink-1 outline-none focus:ring-2 focus:ring-accent/40"
        />
      )}
    </div>
  )
}

export const PartToggle: React.FC<{
  part: { key: PartKey; label?: string | null }
  on: boolean
  onClick: () => void
  children?: React.ReactNode
  'data-testid'?: string
}> = ({ part, on, onClick, children, 'data-testid': testId }) => (
  <button
    type="button"
    aria-pressed={on}
    onClick={onClick}
    data-testid={testId}
    className={`inline-flex items-center gap-1.5 h-[38px] px-3 rounded-full text-[13.5px] font-semibold whitespace-nowrap ${
      on
        ? 'bg-ink-1 text-bg-1'
        : 'text-ink-2 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'
    }`}
  >
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: PART_COLOR[part.key] }}
      aria-hidden
    />
    {part.label || PART_LABEL[part.key]}
    {children}
  </button>
)
