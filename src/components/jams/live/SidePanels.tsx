/**
 * The console's lists beside the queue: pitches ranked by coverage (approve /
 * decline the pending ones live, queue the rest) and hands up on what's coming
 * (Add puts that person on the part).
 */
import React from 'react'
import { Check, Hand as HandIcon, ListPlus, X } from 'lucide-react'
import { Button } from '../../ui'
import * as jams from '../../../services/api/jams'
import type { JamState } from '../../../services/api/jams'
import { partName, type JamItem } from '../../../hooks/useJam'
import { SlotChips } from '../PartChip'
import { asPart, firstName, needsLine } from './live'
import type { ConsoleActions } from './useConsoleActions'

const label =
  'flex items-center px-6 pt-3 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3'
const group =
  'mx-3 mb-2.5 rounded-[20px] overflow-hidden bg-bg-2 shadow-group divide-y divide-divider'
const round =
  'w-12 h-12 grid place-items-center rounded-full shrink-0 disabled:opacity-40'

export const PitchesPanel: React.FC<{
  state: JamState
  actions: ConsoleActions
  onOpen: (item: JamItem) => void
}> = ({ state, actions, onOpen }) => {
  const pitches = state.items
    .filter(i => i.state === 'pending' || i.state === 'open')
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
  const pending = pitches.filter(i => i.state === 'pending').length
  return (
    <section data-testid="console-pitches">
      <div className={label}>
        Pitches · {pitches.length}
        {pending > 0 && (
          <span className="ml-auto text-accent-ink">{pending} to approve</span>
        )}
      </div>
      {pitches.length === 0 ? (
        <p className="px-6 pb-3 text-[13.5px] text-ink-3">
          No pitches waiting. People pitch from their phones or the counter.
        </p>
      ) : (
        <ul className={group}>
          {pitches.map((i, n) => (
            <li
              key={i.id}
              className="flex items-center gap-2 min-h-16 pl-4 pr-2 py-2"
              data-testid={`pitch-${i.id}`}
            >
              <span className="w-5 font-mono text-[12px] text-ink-3 shrink-0">
                {n + 1}
              </span>
              <button
                type="button"
                onClick={() => onOpen(i)}
                className="flex-1 min-w-0 text-left"
                data-testid="pitch-open"
              >
                <b className="flex items-center gap-1.5 text-[15.5px] text-ink-1">
                  <span className="truncate">{i.title}</span>
                  {i.state === 'pending' && (
                    <span className="font-mono text-[9.5px] tracking-[.08em] px-1.5 py-0.5 rounded-md bg-accent/20 text-accent-ink shrink-0">
                      REQUEST
                    </span>
                  )}
                </b>
                <small className="block text-[12.5px] text-ink-3 truncate">
                  {[
                    i.pitched_by_name &&
                      `${firstName(i.pitched_by_name)}'s pitch`,
                    `${i.covered}/${i.total}`,
                    needsLine(i),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
                <SlotChips item={i} me={state.me?.participant_id} />
              </button>
              {i.state === 'pending' ? (
                <>
                  <button
                    type="button"
                    aria-label={`Decline ${i.title}`}
                    title="Decline"
                    onClick={() => void actions.decline(i)}
                    className={`${round} bg-bg-3 text-ink-2 hover:text-danger`}
                    data-testid="pitch-decline"
                  >
                    <X size={19} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Approve ${i.title}`}
                    title="Approve"
                    onClick={() => void actions.approve(i)}
                    className={`${round} bg-accent text-on-accent`}
                    data-testid="pitch-approve"
                  >
                    <Check size={19} />
                  </button>
                </>
              ) : (
                state.jam.status === 'live' && (
                  <Button
                    size="lg"
                    icon={<ListPlus size={17} />}
                    onClick={() => void actions.queueIt(i)}
                    data-testid="pitch-queue"
                  >
                    Queue
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const HandsPanel: React.FC<{
  state: JamState
  actions: ConsoleActions
}> = ({ state, actions }) => {
  const coming = [
    ...state.queue,
    ...state.items
      .filter(i => i.state === 'pending' || i.state === 'open')
      .map(i => i.id),
  ]
  const rows = coming.flatMap(id => {
    const item = state.items.find(i => i.id === id)
    if (!item) return []
    return item.hands
      .filter(h => h.status === 'raised')
      .map(h => ({ item, hand: h }))
  })
  return (
    <section data-testid="console-hands">
      <div className={label}>Hands up · {rows.length}</div>
      {rows.length === 0 ? (
        <p className="px-6 pb-3 text-[13.5px] text-ink-3">No hands up.</p>
      ) : (
        <ul className={group}>
          {rows.map(({ item, hand }) => (
            <li
              key={hand.id}
              className="flex items-center gap-3 min-h-16 pl-4 pr-2"
              data-testid={`hand-${hand.id}`}
            >
              <HandIcon size={18} className="text-accent-ink shrink-0" />
              <span className="flex-1 min-w-0">
                <b className="block text-[15px] text-ink-1 truncate">
                  {firstName(hand.name)} · {partName(hand)}
                </b>
                <small className="block text-[12.5px] text-ink-3 truncate">
                  {item.title}
                </small>
              </span>
              <Button
                size="lg"
                onClick={() =>
                  void actions.run(
                    () =>
                      jams.setCast(item.id, asPart(hand), hand.participant_id),
                    {
                      ok: `${firstName(hand.name)} on ${partName(hand).toLowerCase()}`,
                      undo: () =>
                        jams.setCast(
                          item.id,
                          asPart(hand),
                          hand.participant_id,
                          false
                        ),
                    }
                  )
                }
                data-testid="hand-add"
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
