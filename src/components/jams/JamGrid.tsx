/**
 * Grid view (decision 13): songs × parts over jam_state. Each cell is the
 * accepted name, a hand count, or a highlighted gap; a part a song doesn't
 * need is blank. Tapping a cell hands the slot back to the page (the planned
 * jam and the host console open their cast sheet). Columns are the jam's
 * parts in slot order ("Guitar", "Guitar 2", custom parts last as they come).
 */
import React, { useMemo } from 'react'
import { Hand } from 'lucide-react'
import type { JamItem } from '../../hooks/useJam'
import { partName } from '../../hooks/useJam'
import type { JamState } from '../../services/api/jams'
import { PART_COLOR, partId } from './parts'

type Slot = JamItem['slots'][number]

export interface JamGridProps {
  /** The songs to show, in order (the caller picks lineup / queue / requests). */
  items: JamItem[]
  state: Pick<JamState, 'me'>
  /** Omit for a read-only grid. */
  onCell?: (item: JamItem, slot: Slot) => void
  'data-testid'?: string
}

const colKey = (s: { key: string; label?: string | null; nth: number }) =>
  `${partId(s as Slot)}#${s.nth}`

export const JamGrid: React.FC<JamGridProps> = ({
  items,
  state,
  onCell,
  'data-testid': testId = 'jam-grid',
}) => {
  const cols = useMemo(() => {
    const seen = new Map<string, Slot>()
    for (const it of items)
      for (const s of it.slots) if (!seen.has(colKey(s))) seen.set(colKey(s), s)
    const order = ['vox', 'guitar', 'bass', 'drums', 'keys', 'other']
    return [...seen.values()].sort(
      (a, b) =>
        order.indexOf(a.key) - order.indexOf(b.key) ||
        (a.label ?? '').localeCompare(b.label ?? '') ||
        a.nth - b.nth
    )
  }, [items])
  const me = state.me?.participant_id

  if (!items.length) return null
  return (
    <div
      className="overflow-x-auto custom-scrollbar-thin rounded-[20px] bg-bg-2 shadow-group"
      data-testid={testId}
    >
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left">
            <th className="sticky left-0 z-10 bg-bg-2 px-3 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3 min-w-[150px]">
              Song
            </th>
            {cols.map(c => (
              <th
                key={colKey(c)}
                className="px-2 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[.1em] text-ink-3 whitespace-nowrap"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                  style={{ background: PART_COLOR[c.key] }}
                  aria-hidden
                />
                {partName(c, c.nth)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {items.map(it => {
            const bySlot = new Map(it.slots.map(s => [colKey(s), s]))
            return (
              <tr key={it.id} data-testid={`jam-grid-row-${it.id}`}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-bg-2 px-3 py-2 text-left font-semibold text-ink-1 max-w-[200px] truncate"
                >
                  {it.title}
                </th>
                {cols.map(c => {
                  const s = bySlot.get(colKey(c))
                  if (!s) return <td key={colKey(c)} className="px-2 py-2" />
                  const mine = !!me && s.cast?.participant_id === me
                  const body = s.cast ? (
                    s.cast.name.split(' ')[0]
                  ) : s.raised > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Hand size={13} aria-hidden /> {s.raised}
                    </span>
                  ) : (
                    'Open'
                  )
                  const cls = `w-full min-w-[76px] h-9 px-2 rounded-xl text-[12.5px] font-semibold whitespace-nowrap ${
                    mine
                      ? 'bg-accent text-on-accent'
                      : s.cast
                        ? 'bg-bg-3 text-ink-1'
                        : s.raised > 0
                          ? 'text-ink-1 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'
                          : 'bg-warn/15 text-warn shadow-[inset_0_0_0_1.5px_rgb(var(--warn-rgb)/.5)]'
                  }`
                  const cellId = `jam-grid-cell-${it.id}-${s.key}${s.label ? `-${s.label.toLowerCase()}` : ''}-${s.nth}`
                  return (
                    <td key={colKey(c)} className="px-1.5 py-1.5">
                      {onCell ? (
                        <button
                          type="button"
                          onClick={() => onCell(it, s)}
                          className={`${cls} hover:brightness-110`}
                          data-testid={cellId}
                          data-gap={s.gap || undefined}
                        >
                          {body}
                        </button>
                      ) : (
                        <span
                          className={`${cls} grid place-items-center`}
                          data-testid={cellId}
                          data-gap={s.gap || undefined}
                        >
                          {body}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
