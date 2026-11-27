/**
 * Tonight (Jam Live 1–3, 6): the live jam for app users who aren't running
 * it, rendered by `/jam/:id` while the jam is live. On stage and up next; my
 * hands and when I'm up; people who know my songs (tap one to compare); songs
 * the room can cover, most covered first, with a hand button each; Pitch a
 * song; the Ask-the-room nudge for people who play that part; Leave jam.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, Hand as HandIcon, LogOut, Music, Plus } from 'lucide-react'
import { Button } from '../../ui'
import { DockAction } from '../../layout/PhoneDock'
import { ConfirmDialog } from '../../common/ConfirmDialog'
import { SlotChips } from '../PartChip'
import { useConfirm } from '../../../hooks/useConfirm'
import {
  partName,
  useJamChannel,
  useWhoKnowsYourSongs,
  type JamItem,
  type JamNudge,
} from '../../../hooks/useJam'
import * as jams from '../../../services/api/jams'
import type { JamState } from '../../../services/api/jams'
import { castLine, firstName, samePart, useLiveRunner } from './live'
import { CompareSheet, PitchSheet, RaiseHandSheet } from './TonightSheets'

const label =
  'flex items-center px-6 pt-3 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3'
const group =
  'mx-3 mb-2.5 rounded-[20px] overflow-hidden bg-bg-2 shadow-group divide-y divide-divider'

const OPEN_STATES = ['pending', 'open', 'queued', 'stage']

export const JamTonight: React.FC<{ state: JamState }> = ({ state }) => {
  const navigate = useNavigate()
  const { run } = useLiveRunner(state.jam.id)
  const { confirm, dialogProps } = useConfirm()
  const overlap = useWhoKnowsYourSongs(state.jam.id)
  const [nudge, setNudge] = useState<JamNudge | null>(null)
  const [raise, setRaise] = useState<string | null>(null)
  const [pitch, setPitch] = useState<
    { title: string; artist?: string | null; songId?: string } | null | false
  >(false)
  const [compare, setCompare] = useState<{
    participant_id: string
    name: string
  } | null>(null)

  const me = state.me
  const myParts = me?.parts ?? []
  useJamChannel(state.jam.short_code, {
    onNudge: n => {
      if (myParts.some(p => samePart(p, n.part))) setNudge(n)
    },
  })

  const items = new Map(state.items.map(i => [i.id, i]))
  const stage = state.stage ? items.get(state.stage) : undefined
  const upNext = state.up_next ? items.get(state.up_next) : undefined
  const where = (i: JamItem) => {
    if (i.state === 'stage') return 'On stage now'
    const at = state.queue.indexOf(i.id)
    if (at === 0) return "You're up next"
    if (at > 0) return `${at} ${at === 1 ? 'song' : 'songs'} before yours`
    if (i.state === 'pending') return 'Waiting for the host'
    return 'Not in the queue yet'
  }
  const mine = state.items
    .filter(i => OPEN_STATES.includes(i.state) && i.hands.some(h => h.mine))
    .sort((a, b) => {
      const qa = a.state === 'stage' ? -1 : state.queue.indexOf(a.id)
      const qb = b.state === 'stage' ? -1 : state.queue.indexOf(b.id)
      return (qa < -1 ? 999 : qa) - (qb < -1 ? 999 : qb)
    })
  const cover = state.items
    .filter(i => i.state !== 'stage' && OPEN_STATES.includes(i.state))
    .sort(
      (a, b) =>
        b.covered / Math.max(1, b.total) - a.covered / Math.max(1, a.total) ||
        a.position - b.position
    )
  const nudgeItem = nudge ? items.get(nudge.item_id) : undefined
  const raiseItem = raise ? items.get(raise) : undefined
  const canPitch = state.jam.requests_open || !!me?.is_manager

  const leave = async () => {
    const ok = await confirm({
      title: 'Leave the jam?',
      message:
        'Your hands come down and you leave the list. You can join again with the code.',
      confirmLabel: 'Leave',
      variant: 'danger',
    })
    if (!ok) return
    const r = await run(() => jams.leaveJam(state.jam.id).then(() => true), {
      ok: `You left ${state.jam.name}`,
    })
    if (r) navigate('/jam')
  }

  const card = (
    kicker: string,
    item: JamItem | undefined,
    testId: string,
    accent?: boolean
  ) => (
    <div
      className={`flex items-center gap-3 rounded-[18px] bg-bg-2 px-4 min-h-16 py-2 ${
        accent ? 'shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]' : ''
      }`}
      data-testid={testId}
    >
      <Music size={18} className="text-ink-3 shrink-0" />
      <span className="flex-1 min-w-0">
        <small className="block font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3">
          {kicker}
        </small>
        <b className="block text-[16px] text-ink-1 truncate">
          {item ? item.title : 'Nobody yet'}
        </b>
        {item && castLine(item) && (
          <small className="block text-[12.5px] text-ink-3 truncate">
            {castLine(item)}
          </small>
        )}
      </span>
    </div>
  )

  return (
    <div className="md:max-w-[860px]" data-testid="jam-tonight">
      {nudge && nudgeItem && (
        <div
          className="mx-3 mb-3 rounded-[20px] bg-bg-2 p-4 shadow-[inset_0_0_0_2px_rgb(var(--type-jam-rgb))] flex gap-3"
          role="status"
          data-testid="tonight-nudge"
        >
          <BellRing size={22} className="text-type-jam shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            <b className="block text-[16px] text-ink-1">
              {nudge.title} needs {partName(nudge.part).toLowerCase()}
            </b>
            <small className="block text-[13px] text-ink-2">
              You play {partName(nudge.part).toLowerCase()}.{' '}
              {castLine(nudgeItem) &&
                `${castLine(nudgeItem)} ${nudgeItem.slots.filter(s => s.cast).length === 1 ? 'is' : 'are'} ready.`}
            </small>
            <span className="flex gap-2 mt-2.5">
              <Button
                variant="primary"
                icon={<HandIcon size={17} />}
                onClick={() => {
                  const n = nudge
                  setNudge(null)
                  void run(() => jams.raiseHand(n.item_id, [n.part]), {
                    ok: `Hand up on ${n.title}`,
                  })
                }}
                data-testid="nudge-in"
              >
                I'm in
              </Button>
              <Button
                onClick={() => setNudge(null)}
                data-testid="nudge-dismiss"
              >
                Not now
              </Button>
            </span>
          </span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-2 px-3">
        {card('On stage', stage, 'tonight-on-stage')}
        {card('Up next', upNext, 'tonight-up-next', true)}
      </div>

      {canPitch && (
        <div className="md:px-3 md:pt-3 md:max-w-[260px]">
          <DockAction>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<Plus size={18} />}
              onClick={() => setPitch(null)}
              data-testid="tonight-pitch"
            >
              Pitch a song
            </Button>
          </DockAction>
        </div>
      )}

      {mine.length > 0 && (
        <section data-testid="tonight-my-hands">
          <div className={label}>My hands · {mine.length}</div>
          <ul className={group}>
            {mine.map(i => {
              const hands = i.hands.filter(h => h.mine)
              const on = hands.filter(h => h.status === 'accepted')
              return (
                <li
                  key={i.id}
                  className="flex items-center gap-3 min-h-16 pl-4 pr-2 py-2"
                  data-testid={`tonight-hand-${i.id}`}
                >
                  <HandIcon
                    size={18}
                    className={
                      on.length
                        ? 'text-accent-ink shrink-0'
                        : 'text-ink-3 shrink-0'
                    }
                  />
                  <span className="flex-1 min-w-0">
                    <b className="block text-[15.5px] text-ink-1 truncate">
                      {i.title}
                    </b>
                    <small className="block text-[12.5px] text-ink-3 truncate">
                      {on.length
                        ? `You're on ${on.map(h => partName(h).toLowerCase()).join(', ')} · ${where(i)}`
                        : `Hand up: ${hands.map(h => partName(h).toLowerCase()).join(', ')} · ${where(i)}`}
                    </small>
                  </span>
                  <Button
                    onClick={() => setRaise(i.id)}
                    data-testid={`tonight-hand-edit-${i.id}`}
                  >
                    Change
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section data-testid="tonight-people">
        <div className={label}>
          {overlap.data?.length
            ? `${overlap.data.length} ${overlap.data.length === 1 ? 'person here knows' : 'people here know'} your songs`
            : 'Who knows your songs'}
        </div>
        {overlap.isLoading ? null : !overlap.data?.length ? (
          <p className="px-6 pb-3 text-[13.5px] text-ink-3">
            {me?.share_songs === false
              ? "You're not sharing your jam songs tonight."
              : 'No one here shares your jam songs yet. Tag songs “jam” in My Songs to match.'}
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto custom-scrollbar-thin px-3 pb-2">
            {overlap.data.map(p => {
              const person = state.people.find(
                x => x.participant_id === p.participant_id
              )
              return (
                <button
                  key={p.participant_id}
                  type="button"
                  onClick={() =>
                    setCompare({
                      participant_id: p.participant_id,
                      name: p.name,
                    })
                  }
                  className="shrink-0 w-[132px] min-h-[120px] rounded-[18px] bg-bg-2 shadow-group p-3 text-left hover:bg-bg-3"
                  data-testid={`tonight-person-${p.participant_id}`}
                >
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-bg-3 text-[14px] font-bold mb-2">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <b className="block text-[15px] truncate">
                    {firstName(p.name)}
                  </b>
                  <small className="block text-[12px] text-ink-3 truncate">
                    {(person?.parts ?? []).map(x => partName(x)).join(', ')}
                  </small>
                  <em className="block not-italic font-mono text-[10px] tracking-[.08em] text-accent-ink mt-1">
                    {p.common_count} IN COMMON
                  </em>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section data-testid="tonight-songs">
        <div className={label}>Songs the room can cover</div>
        {cover.length === 0 ? (
          <p className="px-6 pb-3 text-[13.5px] text-ink-3">
            Nothing on the list yet. Pitch a song.
          </p>
        ) : (
          <ul className={group}>
            {cover.map(i => {
              const up = i.hands.some(h => h.mine)
              const gaps = i.slots.filter(s => s.gap).length
              return (
                <li
                  key={i.id}
                  className="flex items-center gap-3 min-h-16 pl-4 pr-2 py-2"
                  data-testid={`tonight-song-${i.id}`}
                >
                  <span className="flex-1 min-w-0">
                    <b className="block text-[15.5px] text-ink-1 truncate">
                      {i.title}
                    </b>
                    <small className="block text-[12.5px] text-ink-3 truncate">
                      {[
                        i.artist,
                        i.state === 'pending'
                          ? 'request'
                          : i.state === 'queued'
                            ? 'in the queue'
                            : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                    <SlotChips item={i} me={me?.participant_id} />
                    {gaps === 1 && (
                      <small className="block font-mono text-[10px] tracking-[.08em] text-warn mt-1">
                        ONE PLAYER AWAY · NEEDS{' '}
                        {partName(i.slots.find(s => s.gap)!).toUpperCase()}
                      </small>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={
                      up
                        ? `Your hand is up on ${i.title}`
                        : `Raise your hand on ${i.title}`
                    }
                    aria-pressed={up}
                    onClick={() => setRaise(i.id)}
                    className={`w-14 h-14 grid place-items-center rounded-full shrink-0 ${
                      up
                        ? 'bg-accent text-on-accent'
                        : 'bg-bg-3 text-ink-1 hover:bg-bg-4'
                    }`}
                    data-testid={`tonight-raise-${i.id}`}
                  >
                    <HandIcon size={22} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="px-3 pt-2 pb-6 flex">
        <Button
          variant="text"
          icon={<LogOut size={17} />}
          onClick={() => void leave()}
          data-testid="tonight-leave"
        >
          Leave jam
        </Button>
      </div>

      {raiseItem && (
        <RaiseHandSheet
          state={state}
          item={raiseItem}
          run={run}
          onClose={() => setRaise(null)}
        />
      )}
      {pitch !== false && (
        <PitchSheet
          state={state}
          run={run}
          initial={pitch ?? undefined}
          onClose={() => setPitch(false)}
        />
      )}
      {compare && (
        <CompareSheet
          state={state}
          other={compare}
          onPitch={s => {
            setCompare(null)
            setPitch(s)
          }}
          onClose={() => setCompare(null)}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

export default JamTonight
