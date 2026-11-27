/**
 * The console's top: one quiet On stage line (Mark played), the Up next card
 * (big parts, Open: … with From hands / House player / Ask the room, Call up
 * anyway or Call them up, Skip), and the quiet-stage card when nothing's next.
 */
import React from 'react'
import { ArrowRight, BellRing, Check, Music, SkipForward } from 'lucide-react'
import { Button } from '../../ui'
import * as jams from '../../../services/api/jams'
import type { JamState } from '../../../services/api/jams'
import { partName, type JamItem } from '../../../hooks/useJam'
import { PartSlots } from './PartSlots'
import { ago, castLine, gapParts, type Slot } from './live'
import type { ConsoleActions } from './useConsoleActions'

const kicker = 'font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3'

export const OnStage: React.FC<{
  item: JamItem | null
  lastPlayed: JamItem | null
  actions: ConsoleActions
  now: number
}> = ({ item, lastPlayed, actions, now }) => {
  const shown = item ?? lastPlayed
  return (
    <div
      className={`flex items-center gap-3 rounded-[18px] bg-bg-2 px-4 min-h-16 py-2 ${item ? '' : 'opacity-75'}`}
      data-testid="console-on-stage"
    >
      <Music size={20} className="text-ink-3 shrink-0" />
      <span className="flex-1 min-w-0">
        <small className={`block ${kicker}`}>
          {item
            ? `On stage · ${ago(item.called_at, now)}`
            : lastPlayed
              ? `Last called · ${ago(lastPlayed.called_at, now)}`
              : 'On stage'}
        </small>
        <b
          className="block text-[17px] text-ink-1 truncate"
          data-testid="console-on-stage-title"
        >
          {shown ? shown.title : 'Nobody yet'}
        </b>
        {shown && castLine(shown) && (
          <small className="block text-[12.5px] text-ink-3 truncate">
            {castLine(shown)}
          </small>
        )}
      </span>
      {item && (
        <Button
          size="lg"
          icon={<Check size={18} />}
          onClick={() => void actions.markPlayed()}
          aria-label="Mark played"
          className="!h-16"
          data-testid="console-mark-played"
        >
          <span className="hidden sm:inline">Mark played</span>
        </Button>
      )}
    </div>
  )
}

export const UpNextCard: React.FC<{
  state: JamState
  item: JamItem
  then: JamItem[]
  actions: ConsoleActions
  onFill: (item: JamItem, slot: Slot) => void
}> = ({ state, item, then, actions, onFill }) => {
  const gaps = gapParts(item)
  const firstGap = item.slots.find(s => s.gap)
  const handGap = item.slots.find(s => s.gap && s.raised > 0)
  const hasHouse = state.people.some(p => p.is_house)
  const askAll = () =>
    actions.run(() => Promise.all(gaps.map(p => jams.askTheRoom(item.id, p))), {
      ok: `Asked the room for ${gaps.map(p => partName(p).toLowerCase()).join(' + ')}`,
    })
  return (
    <div
      className="rounded-[24px] bg-bg-2 p-4 md:p-5 shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]"
      data-testid="console-up-next"
      data-item-id={item.id}
    >
      <div className={`flex justify-between ${kicker} !text-accent-ink`}>
        <span>
          Up next
          {item.pitched_by_name
            ? ` · ${item.pitched_by_name.split(' ')[0]}'s pitch`
            : ''}
        </span>
        <span>
          {item.covered}/{item.total} parts
        </span>
      </div>
      <h2
        className="font-display font-extrabold uppercase text-[36px] md:text-[44px] leading-[.92] mt-1.5 text-ink-1 break-words"
        data-testid="console-up-next-title"
      >
        {item.title}
      </h2>
      <div className="text-[14px] text-ink-2 mt-1">
        {[
          item.artist,
          then.length
            ? `then ${then
                .slice(0, 2)
                .map(t => t.title)
                .join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </div>
      <div className="my-3">
        <PartSlots
          item={item}
          people={state.people}
          onSlot={s => onFill(item, s)}
          data-testid="console-up-next-slots"
        />
      </div>
      {gaps.length > 0 && firstGap && (
        <div
          className="grid grid-cols-3 md:flex md:flex-wrap items-center gap-2 mb-3"
          data-testid="console-open-parts"
        >
          <span className="col-span-3 text-[14px] text-ink-2 mr-1">
            Open:{' '}
            <b className="text-ink-1">
              {gaps.map(p => partName(p)).join(', ')}
            </b>
          </span>
          <Button
            size="lg"
            disabled={!handGap}
            onClick={() => onFill(item, handGap ?? firstGap)}
            className="!px-2 md:!px-[22px] !text-[13.5px] md:!text-[15px]"
            data-testid="console-from-hands"
          >
            From hands
          </Button>
          {hasHouse && (
            <Button
              size="lg"
              onClick={() => onFill(item, firstGap)}
              className="!px-2 md:!px-[22px] !text-[13.5px] md:!text-[15px]"
              data-testid="console-house-player"
            >
              House player
            </Button>
          )}
          <Button
            size="lg"
            icon={<BellRing size={17} className="hidden md:block" />}
            onClick={() => void askAll()}
            className="!px-2 md:!px-[22px] !text-[13.5px] md:!text-[15px]"
            data-testid="console-ask-room"
          >
            Ask the room
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="xl"
          fullWidth
          icon={<ArrowRight size={20} />}
          onClick={() => void actions.callUp(item)}
          className="!h-16 !text-[18px]"
          data-testid="console-call-up"
        >
          {gaps.length ? 'Call up anyway' : 'Call them up'}
        </Button>
        <Button
          size="xl"
          onClick={() => void actions.skip(item)}
          disabled={then.length === 0}
          aria-label="Skip"
          title="Skip: move behind the next song"
          className="!h-16 !w-16 md:!w-auto !px-0 md:!px-6 shrink-0"
          data-testid="console-skip"
        >
          <SkipForward size={20} />
          <span className="hidden md:inline">Skip</span>
        </Button>
      </div>
    </div>
  )
}

/** Live 5: nothing up next. Songs one player away, each with Ask. */
export const QuietStage: React.FC<{
  state: JamState
  actions: ConsoleActions
}> = ({ state, actions }) => {
  const close = state.items
    .filter(i => ['open', 'pending', 'queued'].includes(i.state))
    .map(i => ({ item: i, gaps: gapParts(i) }))
    .filter(x => x.gaps.length === 1)
  const ask = (item: JamItem, p: jams.Part) =>
    actions.run(() => jams.askTheRoom(item.id, p), {
      ok: `Asked the room for ${partName(p).toLowerCase()}`,
    })
  return (
    <div
      className="rounded-[24px] bg-bg-2 p-5 shadow-[inset_0_0_0_2px_rgb(var(--type-jam-rgb))]"
      data-testid="console-quiet-stage"
    >
      <div className={`${kicker} !text-type-jam`}>Stage is quiet</div>
      <b className="block text-[22px] text-ink-1 mt-1">No one's up next</b>
      <p className="text-[14px] text-ink-2 mt-1">
        {close.length
          ? `${close.length} ${close.length === 1 ? 'song is' : 'songs are'} one player away. Ask the room, and people who play that part get a nudge.`
          : 'Queue a pitch from the list, or add a walk-up.'}
      </p>
      {close.length > 0 && (
        <ul className="mt-3 divide-y divide-divider">
          {close.slice(0, 5).map(({ item, gaps }) => (
            <li key={item.id} className="flex items-center gap-3 min-h-16">
              <span className="flex-1 min-w-0">
                <b className="block text-[15.5px] text-ink-1 truncate">
                  {item.title} needs {partName(gaps[0]).toLowerCase()}
                </b>
              </span>
              <Button
                size="lg"
                icon={<BellRing size={17} />}
                onClick={() => void ask(item, gaps[0])}
                data-testid={`quiet-ask-${item.id}`}
              >
                Ask
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
