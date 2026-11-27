/**
 * The console's people: who's here, house players, lock joining; a person's
 * menu makes them a house player or removes them (confirm names what goes).
 * The join code and QR show only when anyone with the code can join.
 */
import React, { Suspense, lazy, useState } from 'react'
import { Lock, MoreHorizontal, Star, UserMinus } from 'lucide-react'
import { Sheet, SheetItem, Switch } from '../../ui'
import { ConfirmDialog } from '../../common/ConfirmDialog'
import { useConfirm } from '../../../hooks/useConfirm'
import * as jams from '../../../services/api/jams'
import type { JamState } from '../../../services/api/jams'
import { formatCode, partName, type JamPerson } from '../../../hooks/useJam'
import { jamLink } from '../parts'
import type { useLiveRunner } from './live'

const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(m => ({ default: m.QRCodeSVG }))
)

const VIA: Record<JamPerson['via'], string> = {
  app: 'APP',
  web: 'WEB',
  walkup: 'WALK-UP',
  kiosk: 'KIOSK',
}

const Tag: React.FC<{ children: React.ReactNode; accent?: boolean }> = ({
  children,
  accent,
}) => (
  <span
    className={`font-mono text-[9.5px] tracking-[.08em] px-1.5 py-0.5 rounded-md ${
      accent ? 'bg-accent text-on-accent' : 'bg-bg-3 text-ink-3'
    }`}
  >
    {children}
  </span>
)

/** Code + QR, code mode only. */
export const JoinCode: React.FC<{ state: JamState; qr?: boolean }> = ({
  state,
  qr = true,
}) => {
  if (state.jam.who_can_join !== 'code') return null
  const code = formatCode(state.jam.short_code)
  return (
    <div
      className="mx-3 mb-2.5 rounded-[20px] bg-bg-2 shadow-group p-4 flex items-center gap-4"
      data-testid="console-join-code"
    >
      {qr && (
        <span className="bg-white p-2 rounded-xl shrink-0">
          <Suspense fallback={<span className="block w-[88px] h-[88px]" />}>
            <QRCodeSVG value={jamLink(state.jam.short_code)} size={88} />
          </Suspense>
        </span>
      )}
      <span className="min-w-0">
        <small className="block font-mono text-[10.5px] tracking-[.12em] text-ink-3">
          {state.jam.joining_locked
            ? 'JOINING LOCKED'
            : 'SCAN OR TYPE THE CODE'}
        </small>
        <b
          className="block font-mono text-[24px] tracking-[.14em] text-ink-1"
          data-testid="console-code"
        >
          {code}
        </b>
        <small className="block text-[12.5px] text-ink-3 truncate">
          {jamLink(state.jam.short_code).replace(/^https?:\/\//, '')}
        </small>
      </span>
    </div>
  )
}

export const PeoplePanel: React.FC<{
  state: JamState
  run: ReturnType<typeof useLiveRunner>['run']
}> = ({ state, run }) => {
  const [menu, setMenu] = useState<JamPerson | null>(null)
  const { confirm, dialogProps } = useConfirm()
  const people = state.people.filter(p => p.joined)
  const imHost = !!state.me?.is_host
  const canRemove = (p: JamPerson) =>
    p.tier !== 'host' && (p.tier !== 'cohost' || imHost)
  const appCount = people.filter(p => p.has_account).length

  const remove = async (p: JamPerson) => {
    setMenu(null)
    const ok = await confirm({
      title: `Remove ${p.name.split(' ')[0]}?`,
      message: `${p.name.split(' ')[0]} leaves the jam: their hands go, and so do songs they asked for that nobody else is on.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    void run(() => jams.removePerson(p.participant_id), {
      ok: `${p.name.split(' ')[0]} removed`,
    })
  }

  return (
    <section data-testid="console-people">
      <div className="mx-3 mb-2.5 rounded-[20px] bg-bg-2 shadow-group flex items-center gap-3 min-h-16 px-4">
        <Lock size={18} className="text-ink-3 shrink-0" />
        <span className="flex-1 min-w-0">
          <b className="block text-[15px] text-ink-1">Lock joining</b>
          <small className="block text-[12.5px] text-ink-3">
            {state.jam.joining_locked
              ? 'No one new can join. Walk-ups still work.'
              : 'New people can join with the code'}
          </small>
        </span>
        <Switch
          checked={state.jam.joining_locked}
          onChange={on =>
            void run(() => jams.lockJoining(state.jam.id, on), {
              ok: on ? 'Joining locked' : 'Joining open',
            })
          }
          label="Lock joining"
          data-testid="console-lock-joining"
        />
      </div>
      <div className="flex items-center px-6 pt-3 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3">
        People · {people.length}
        <span className="ml-auto">
          {appCount} on the app · {people.length - appCount} without
        </span>
      </div>
      <ul className="mx-3 mb-2.5 rounded-[20px] overflow-hidden bg-bg-2 shadow-group divide-y divide-divider">
        {people.map(p => (
          <li
            key={p.participant_id}
            className="flex items-center gap-3 min-h-16 pl-4 pr-2"
            data-testid={`person-${p.participant_id}`}
          >
            <span className="grid place-items-center w-9 h-9 rounded-full bg-bg-3 text-[13px] font-bold text-ink-1 shrink-0">
              {p.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 min-w-0">
              <b className="flex items-center gap-1.5 text-[15px] text-ink-1">
                <span className="truncate">{p.name}</span>
                {p.tier === 'host' && <Tag>HOST</Tag>}
                {p.tier === 'cohost' && <Tag>CO-HOST</Tag>}
                {p.is_house && <Tag accent>HOUSE</Tag>}
              </b>
              <small className="block text-[12.5px] text-ink-3 truncate">
                {[p.parts.map(x => partName(x)).join(', '), VIA[p.via]]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </span>
            <button
              type="button"
              aria-label={`${p.name} options`}
              onClick={() => setMenu(p)}
              className="w-12 h-12 grid place-items-center rounded-full text-ink-2 hover:bg-bg-3"
              data-testid={`person-menu-${p.participant_id}`}
            >
              <MoreHorizontal size={19} />
            </button>
          </li>
        ))}
      </ul>
      {menu && (
        <Sheet
          onClose={() => setMenu(null)}
          title={menu.name}
          sub={menu.parts.map(x => partName(x)).join(', ') || undefined}
          data-testid="person-sheet"
        >
          <div className="pb-2">
            <SheetItem
              icon={<Star />}
              label={menu.is_house ? 'Not a house player' : 'House player'}
              hint={menu.is_house ? undefined : 'On call to fill parts'}
              onClick={() => {
                const p = menu
                setMenu(null)
                void run(
                  () => jams.markHousePlayer(p.participant_id, !p.is_house),
                  {
                    ok: p.is_house
                      ? `${p.name.split(' ')[0]} is off house duty`
                      : `${p.name.split(' ')[0]} is a house player`,
                  }
                )
              }}
              data-testid="person-house"
            />
            {canRemove(menu) && (
              <SheetItem
                icon={<UserMinus />}
                label="Remove from the jam"
                danger
                onClick={() => void remove(menu)}
                data-testid="person-remove"
              />
            )}
          </div>
        </Sheet>
      )}
      <ConfirmDialog {...dialogProps} />
    </section>
  )
}
