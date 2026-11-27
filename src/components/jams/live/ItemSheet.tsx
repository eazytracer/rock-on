/**
 * One song's actions (Jam Host 4c, desktop right-click): its parts to fill,
 * then the moves for its state. Opened by tapping or holding a row on phones,
 * right-click (as a menu) or the row's ⋯ on desktop.
 */
import React from 'react'
import {
  ArrowUpToLine,
  BellRing,
  Check,
  ListPlus,
  LogOut,
  Mic2,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { Sheet, SheetItem } from '../../ui'
import * as jams from '../../../services/api/jams'
import type { JamState } from '../../../services/api/jams'
import { partName, type JamItem } from '../../../hooks/useJam'
import { PartSlots } from './PartSlots'
import { gapParts, needsLine, type Slot } from './live'
import type { ConsoleActions } from './useConsoleActions'

export const ItemSheet: React.FC<{
  state: JamState
  item: JamItem
  actions: ConsoleActions
  at?: { x: number; y: number } | null
  onFill: (slot: Slot) => void
  onClose: () => void
}> = ({ state, item, actions, at, onFill, onClose }) => {
  const live = state.jam.status === 'live'
  const pos = state.queue.indexOf(item.id)
  const go = (f: () => unknown) => () => {
    onClose()
    void f()
  }
  const where =
    item.state === 'queued'
      ? pos === 0
        ? 'up next'
        : `#${pos + 1} in the queue`
      : item.state === 'pending'
        ? 'request'
        : item.state
  return (
    <Sheet
      onClose={onClose}
      at={at}
      width={300}
      title={item.title}
      sub={`${item.artist ? `${item.artist} · ` : ''}${needsLine(item)} · ${where}`}
      data-testid="queue-item-sheet"
    >
      {!at && (
        <div className="pb-3">
          <PartSlots
            item={item}
            people={state.people}
            onSlot={s => {
              onClose()
              onFill(s)
            }}
          />
        </div>
      )}
      <div className="pb-2">
        {item.state === 'pending' && (
          <>
            <SheetItem
              icon={<ThumbsUp />}
              label="Approve"
              hint="On the list"
              onClick={go(() => actions.approve(item))}
              data-testid="item-approve"
            />
            <SheetItem
              icon={<ThumbsDown />}
              label="Decline"
              onClick={go(() => actions.decline(item))}
              data-testid="item-decline"
            />
          </>
        )}
        {live && item.state !== 'stage' && pos !== 0 && (
          <SheetItem
            icon={<ArrowUpToLine />}
            label="Move up next"
            onClick={go(() => actions.makeUpNext(item))}
            data-testid="item-up-next"
          />
        )}
        {live && (item.state === 'open' || item.state === 'pending') && (
          <SheetItem
            icon={<ListPlus />}
            label="Add to the queue"
            hint="At the end"
            onClick={go(() => actions.queueIt(item))}
            data-testid="item-queue"
          />
        )}
        {live && item.state !== 'stage' && (
          <SheetItem
            icon={<Mic2 />}
            label="Call up now"
            onClick={go(() => actions.callUp(item))}
            data-testid="item-call-up"
          />
        )}
        {live &&
          gapParts(item).map(p => (
            <SheetItem
              key={`${p.key}-${p.label ?? ''}`}
              icon={<BellRing />}
              label={`Ask the room for ${partName(p).toLowerCase()}`}
              onClick={go(() =>
                actions.run(() => jams.askTheRoom(item.id, p), {
                  ok: `Asked the room for ${partName(p).toLowerCase()}`,
                })
              )}
              data-testid={`item-ask-${p.key}`}
            />
          ))}
        {live && (item.state === 'queued' || item.state === 'stage') && (
          <>
            <SheetItem
              icon={<Check />}
              label="Played"
              hint={
                item.state === 'queued' ? 'Went up without the app' : undefined
              }
              onClick={go(() => actions.clear(item, 'played'))}
              data-testid="item-played"
            />
            {item.state === 'queued' && (
              <SheetItem
                icon={<LogOut />}
                label="Left"
                hint="Went home"
                onClick={go(() => actions.clear(item, 'left'))}
                data-testid="item-left"
              />
            )}
          </>
        )}
        {item.state !== 'pending' && item.state !== 'stage' && (
          <SheetItem
            icon={<X />}
            label="Remove"
            hint="Drop the song"
            danger
            onClick={go(() => actions.clear(item, 'removed'))}
            data-testid="item-remove"
          />
        )}
      </div>
    </Sheet>
  )
}
