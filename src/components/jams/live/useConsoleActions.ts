/**
 * The host console's queue moves, each with its toast and Undo: call up,
 * up next, skip, reorder, played / left / removed, pitches in and out.
 */
import { useMemo } from 'react'
import * as jams from '../../../services/api/jams'
import type { ItemState, JamState } from '../../../services/api/jams'
import type { JamItem } from '../../../hooks/useJam'
import { patches, useLiveRunner } from './live'

const DONE: Record<'played' | 'left' | 'removed', string> = {
  played: 'played',
  left: 'left',
  removed: 'removed',
}

export function useConsoleActions(state: JamState) {
  const { run } = useLiveRunner(state.jam.id)
  const eventId = state.jam.id
  const queue = state.queue
  const stage = state.stage

  return useMemo(() => {
    /** Where an item goes back to on Undo. */
    const restore = (item: JamItem, at: number) =>
      item.state === 'queued'
        ? jams.setQueueState(item.id, 'queued', at + 1)
        : item.state === 'stage'
          ? jams.setQueueState(item.id, 'stage')
          : jams.setQueueState(item.id, 'open')

    return {
      run,
      callUp: (item: JamItem) => {
        const at = queue.indexOf(item.id)
        return run(() => jams.callUp(item.id), {
          patch: patches.callUp(item.id),
          ok: `${item.title} is on stage`,
          undo: async r => {
            await restore(item, Math.max(0, at))
            if (r.previous) await jams.setQueueState(r.previous.id, 'stage')
          },
        })
      },
      makeUpNext: (item: JamItem) => {
        const at = queue.indexOf(item.id)
        return run(
          () =>
            item.state === 'queued'
              ? jams.makeUpNext(item.id)
              : jams.queuePitch(item.id, 1),
          {
            patch:
              item.state === 'queued' ? patches.move(item.id, 0) : undefined,
            ok: `${item.title} is up next`,
            undo: () =>
              at >= 0
                ? jams.moveQueueItem(item.id, at + 1)
                : jams.setQueueState(item.id, 'open'),
          }
        )
      },
      skip: (item: JamItem) =>
        run(() => jams.skipUpNext(eventId), {
          patch: patches.move(item.id, 1),
          ok: `${item.title} moved back one`,
          undo: () => jams.makeUpNext(item.id),
        }),
      move: (item: JamItem, to: number) =>
        run(() => jams.moveQueueItem(item.id, to + 1), {
          patch: patches.move(item.id, to),
        }),
      queueIt: (item: JamItem) =>
        run(() => jams.queuePitch(item.id), {
          ok: `${item.title} is in the queue`,
          undo: () => jams.setQueueState(item.id, 'open'),
        }),
      clear: (item: JamItem, to: 'played' | 'left' | 'removed') => {
        const at = queue.indexOf(item.id)
        return run(() => jams.setQueueState(item.id, to), {
          patch: patches.leaveQueue(item.id, to as ItemState),
          ok: `${item.title} · ${DONE[to]}`,
          undo: () => restore(item, Math.max(0, at)),
        })
      },
      markPlayed: () => {
        if (!stage) return
        return run(() => jams.setQueueState(stage, 'played'), {
          patch: patches.leaveQueue(stage, 'played'),
          ok: 'Marked played',
          undo: () => jams.setQueueState(stage, 'stage'),
        })
      },
      approve: (item: JamItem) =>
        run(() => jams.approvePitch(item.id), {
          ok: `${item.title} is on the list`,
        }),
      decline: (item: JamItem) =>
        run(() => jams.declinePitch(item.id), {
          ok: `Declined ${item.title}`,
        }),
    }
  }, [run, queue, stage, eventId])
}

export type ConsoleActions = ReturnType<typeof useConsoleActions>
