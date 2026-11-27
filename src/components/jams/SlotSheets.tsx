/**
 * The sheets behind a lineup song's parts:
 * - CastSheet (host / co-host, one slot): accept a raised hand, put anyone in
 *   the jam on the part, or take the cast person off (set_cast).
 * - HandSheet (anyone joined, one song): raise or lower a hand per part; more
 *   hands than slots is fine, the host picks.
 * - ItemPartsSheet (host): the song's parts; a part added twice is a second
 *   slot ("Guitar 2"), custom parts are other + label (set_item_parts).
 */
import React, { useState } from 'react'
import { Hand, Plus, UserPlus, X } from 'lucide-react'
import { Button, Sheet } from '../ui'
import type { JamItem, JamPerson } from '../../hooks/useJam'
import { partName } from '../../hooks/useJam'
import type { JamState, Part } from '../../services/api/jams'
import { PartToggle } from './PartChip'
import {
  PART_KEYS,
  distinctParts,
  partId,
  partLabel,
  samePart,
  toPart,
} from './parts'

type Slot = JamItem['slots'][number]

const rowCls =
  'w-full flex items-center gap-3 min-h-[52px] px-2 rounded-xl text-left'
const groupLabel =
  'px-2 pt-3 pb-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3'

const partsOf = (p: JamPerson) =>
  p.parts.map(partLabel).join(', ') || (p.is_house ? 'House player' : '')

export const CastSheet: React.FC<{
  item: JamItem
  slot: Slot
  people: JamState['people']
  busy: boolean
  onCast: (participantId: string, on: boolean) => void
  onClose: () => void
}> = ({ item, slot, people, busy, onCast, onClose }) => {
  const pid = partId(slot)
  const onPart = new Set(
    item.hands
      .filter(h => h.status === 'accepted' && partId(h) === pid)
      .map(h => h.participant_id)
  )
  const raised = item.hands.filter(
    h => h.status === 'raised' && partId(h) === pid
  )
  const raisedIds = new Set(raised.map(h => h.participant_id))
  const rest = people.filter(
    p =>
      p.joined &&
      !onPart.has(p.participant_id) &&
      !raisedIds.has(p.participant_id)
  )
  // People who play this part first.
  rest.sort(
    (a, b) =>
      Number(b.parts.some(x => samePart(x, slot))) -
      Number(a.parts.some(x => samePart(x, slot)))
  )
  return (
    <Sheet
      onClose={onClose}
      title={`${partName(slot, slot.nth)} · ${item.title}`}
      sub={
        slot.cast
          ? `${slot.cast.name} is on this part.`
          : 'Open. Pick who plays it.'
      }
      data-testid="jam-cast-sheet"
    >
      <div className="pb-2 -mx-1">
        {slot.cast && (
          <div className={rowCls} data-testid="jam-cast-current">
            <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-ink-1">
              {slot.cast.name}
            </span>
            <Button
              disabled={busy}
              icon={<X size={16} />}
              onClick={() => onCast(slot.cast!.participant_id, false)}
              data-testid="jam-cast-remove"
            >
              Take off
            </Button>
          </div>
        )}
        {raised.length > 0 && (
          <p className={groupLabel}>Hands up · {raised.length}</p>
        )}
        {raised.map(h => (
          <div
            key={h.id}
            className={rowCls}
            data-testid={`jam-cast-hand-${h.participant_id}`}
          >
            <Hand size={17} className="text-accent-ink shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-ink-1">
              {h.name}
            </span>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => onCast(h.participant_id, true)}
              data-testid={`jam-cast-accept-${h.participant_id}`}
            >
              Accept
            </Button>
          </div>
        ))}
        {rest.length > 0 && <p className={groupLabel}>Anyone in the jam</p>}
        <div className="max-h-[40vh] overflow-y-auto custom-scrollbar-thin">
          {rest.map(p => (
            <button
              key={p.participant_id}
              type="button"
              disabled={busy}
              onClick={() => onCast(p.participant_id, true)}
              className={`${rowCls} hover:bg-bg-3 disabled:opacity-50`}
              data-testid={`jam-cast-person-${p.participant_id}`}
            >
              <UserPlus size={17} className="text-ink-3 shrink-0" />
              <span className="flex-1 min-w-0">
                <b className="block truncate text-[15px] text-ink-1">
                  {p.name}
                </b>
                <span className="block truncate text-[12.5px] text-ink-3">
                  {partsOf(p)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

export const HandSheet: React.FC<{
  item: JamItem
  busy: boolean
  onRaise: (part: Part) => void
  onLower: (handId: string) => void
  onClose: () => void
}> = ({ item, busy, onRaise, onLower, onClose }) => {
  const parts = distinctParts(item.slots)
  return (
    <Sheet
      onClose={onClose}
      title={item.title}
      sub={item.artist ?? undefined}
      data-testid="jam-hand-sheet"
    >
      <div className="pb-2">
        <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 pb-2">
          Raise your hand for
        </p>
        <div className="flex flex-col gap-1.5">
          {parts.map(p => {
            const id = partId(p)
            const mine = item.hands.find(h => h.mine && partId(h) === id)
            const cast = item.slots
              .filter(s => partId(s) === id && s.cast)
              .map(s => s.cast!.name.split(' ')[0])
            const up = item.hands.filter(
              h => h.status === 'raised' && partId(h) === id && !h.mine
            )
            const testId = `jam-hand-${p.label ? p.label.toLowerCase().replace(/\s+/g, '-') : p.key}`
            return (
              <div key={id} className="flex items-center gap-3 min-h-[48px]">
                <PartToggle
                  part={p}
                  on={!!mine}
                  onClick={() => {
                    if (busy) return
                    if (!mine) onRaise(p)
                    else if (mine.status === 'raised') onLower(mine.id)
                  }}
                  data-testid={testId}
                >
                  {mine?.status === 'accepted' ? (
                    ' · you’re on'
                  ) : mine ? (
                    <Hand size={14} />
                  ) : null}
                </PartToggle>
                <span className="flex-1 min-w-0 truncate text-[12.5px] text-ink-3">
                  {[
                    cast.length ? `On: ${cast.join(', ')}` : '',
                    up.length
                      ? `Up: ${up.map(h => h.name.split(' ')[0]).join(', ')}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || (mine ? 'Just you so far' : 'Nobody yet')}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-[12.5px] text-ink-3 pt-3">
          The host picks who plays. You'll see it here.
        </p>
        <Button
          size="lg"
          variant="primary"
          fullWidth
          className="mt-4"
          onClick={onClose}
          data-testid="jam-hand-done"
        >
          Done
        </Button>
      </div>
    </Sheet>
  )
}

export const ItemPartsSheet: React.FC<{
  item: JamItem
  busy: boolean
  onSave: (parts: Part[]) => void
  onClose: () => void
}> = ({ item, busy, onSave, onClose }) => {
  const [parts, setParts] = useState<Part[]>(() =>
    item.parts_needed.map(toPart)
  )
  const [custom, setCustom] = useState('')
  const counts = new Map<string, number>()
  const named = parts.map(p => {
    const n = (counts.get(partId(p)) ?? 0) + 1
    counts.set(partId(p), n)
    return partName(p, n)
  })
  const addCustom = () => {
    const l = custom.trim().slice(0, 30)
    if (l) setParts(ps => [...ps, { key: 'other', label: l }])
    setCustom('')
  }
  return (
    <Sheet
      onClose={onClose}
      title={`Parts · ${item.title}`}
      sub="Add a part twice for a second slot."
      data-testid="jam-parts-sheet"
    >
      <div className="pb-2">
        <div className="flex flex-wrap gap-1.5" data-testid="jam-parts-current">
          {named.map((name, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 h-[38px] pl-3 pr-1 rounded-full bg-bg-3 text-[13.5px] font-semibold text-ink-1"
            >
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => setParts(ps => ps.filter((_, j) => j !== i))}
                className="w-8 h-8 grid place-items-center rounded-full text-ink-3 hover:text-ink-1"
                data-testid={`jam-parts-remove-${i}`}
              >
                <X size={15} />
              </button>
            </span>
          ))}
          {!parts.length && (
            <span className="text-[13px] text-ink-3">No parts yet.</span>
          )}
        </div>
        <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 pt-4 pb-2">
          Add a part
        </p>
        <div className="flex flex-wrap gap-1.5">
          {distinctParts([...PART_KEYS.map(key => ({ key })), ...parts]).map(
            p => (
              <button
                key={partId(p)}
                type="button"
                onClick={() => setParts(ps => [...ps, p])}
                className="inline-flex items-center gap-1 h-[38px] px-3 rounded-full text-[13.5px] font-semibold text-ink-2 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]"
                data-testid={`jam-parts-add-${p.label ? p.label.toLowerCase().replace(/\s+/g, '-') : p.key}`}
              >
                <Plus size={14} /> {partLabel(p)}
              </button>
            )
          )}
        </div>
        <div className="flex gap-2 pt-3">
          <input
            id="jam-parts-custom"
            name="customPart"
            data-testid="jam-parts-custom-input"
            value={custom}
            maxLength={30}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="Other part, e.g. Harmonica"
            className="flex-1 min-w-0 h-11 px-4 rounded-full bg-bg-3 text-[14px] text-ink-1 outline-none placeholder:text-ink-4 focus:ring-2 focus:ring-accent/40"
          />
          <Button
            disabled={!custom.trim()}
            onClick={addCustom}
            data-testid="jam-parts-custom-add"
          >
            Add
          </Button>
        </div>
        <div className="flex gap-2 pt-5">
          <Button
            size="lg"
            className="flex-1"
            onClick={onClose}
            data-testid="jam-parts-cancel"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            variant="primary"
            className="flex-1"
            disabled={busy || !parts.length}
            onClick={() => onSave(parts)}
            data-testid="jam-parts-save"
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
