/**
 * Host console, `/jam/:id/live` (Jam Host 1–5, Jam Live 4–5, desktop
 * console): a full-window stage screen for the host and co-hosts; everyone
 * else goes to `/jam/:id`. On stage, Up next (fill a part, Ask the room, Call
 * up anyway, Skip), the queue (swipe / hold on phones; hover, right-click,
 * drag on desktop; Undo on every move), pitches ranked by coverage, hands up,
 * walk-ups, people (house players, remove, lock joining), a Grid view, the
 * join code in code mode, and End jam. The screen stays awake.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  MoreHorizontal,
  Play,
  Plus,
  Power,
  QrCode,
  Users,
  X,
} from 'lucide-react'
import {
  Button,
  RetryCard,
  Segmented,
  Sheet,
  SheetItem,
  SkeletonRow,
} from '../../components/ui'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { JamGrid } from '../../components/jams/JamGrid'
import { OpenTvButton } from '../../components/jams/guest/OpenTvButton'
import {
  KioskSheet,
  StartKioskButton,
} from '../../components/jams/guest/StartKioskButton'
import { FillPartSheet } from '../../components/jams/live/FillPartSheet'
import { ItemSheet } from '../../components/jams/live/ItemSheet'
import { JoinCode, PeoplePanel } from '../../components/jams/live/PeoplePanel'
import { QueueList } from '../../components/jams/live/QueueList'
import { HandsPanel, PitchesPanel } from '../../components/jams/live/SidePanels'
import {
  OnStage,
  QuietStage,
  UpNextCard,
} from '../../components/jams/live/StageCards'
import { WalkupSheet } from '../../components/jams/live/WalkupSheet'
import { useConsoleActions } from '../../components/jams/live/useConsoleActions'
import { byId, type Slot } from '../../components/jams/live/live'
import { useConfirm } from '../../hooks/useConfirm'
import { useJamState, type JamItem } from '../../hooks/useJam'
import { useMediaQuery } from '../../hooks/useResponsive'
import { useWakeLock } from '../../hooks/useWakeLock'
import * as jams from '../../services/api/jams'
import type { JamState } from '../../services/api/jams'

type View = 'console' | 'grid'

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="fixed inset-0 z-[55] bg-bg-1 text-ink-1 flex flex-col"
    data-testid="jam-console-page"
  >
    {children}
  </div>
)

export const JamConsolePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>()
  const q = useJamState(id)
  useWakeLock()

  if (q.isLoading)
    return (
      <Shell>
        <div className="p-4 space-y-2" data-testid="console-loading">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </Shell>
    )
  if (q.error || !q.data)
    return (
      <Shell>
        <div className="m-auto w-full max-w-md">
          <RetryCard
            message="Couldn't load the jam."
            onRetry={() => void q.refetch()}
          />
        </div>
      </Shell>
    )
  const state = q.data
  if (
    !state.me?.is_manager ||
    state.jam.status === 'completed' ||
    state.jam.status === 'cancelled'
  )
    return <Navigate to={`/jam/${id}`} replace />
  return <Console state={state} />
}

const Console: React.FC<{ state: JamState }> = ({ state }) => {
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const actions = useConsoleActions(state)
  const { run } = actions
  const { confirm, dialogProps } = useConfirm()
  const [view, setView] = useState<View>('console')
  const [fill, setFill] = useState<{ item: string; slot: Slot } | null>(null)
  const [open, setOpen] = useState<{
    item: string
    at?: { x: number; y: number } | null
  } | null>(null)
  const [walkup, setWalkup] = useState(false)
  const [menu, setMenu] = useState(false)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [kiosk, setKiosk] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const items = useMemo(() => byId(state), [state])
  const live = state.jam.status === 'live'
  const stage = state.stage ? (items.get(state.stage) ?? null) : null
  const queue = state.queue.map(i => items.get(i)).filter(Boolean) as JamItem[]
  const upNext = queue[0] ?? null
  const after = queue.slice(1)
  const lastPlayed =
    state.items
      .filter(i => i.state === 'played' && i.called_at)
      .sort((a, b) => b.called_at!.localeCompare(a.called_at!))[0] ?? null
  const here = state.people.filter(p => p.joined).length
  const handsUp = state.items
    .filter(i => !['played', 'left', 'removed'].includes(i.state))
    .reduce((n, i) => n + i.hands.filter(h => h.status === 'raised').length, 0)
  const codeMode = state.jam.who_can_join === 'code'
  const exit = () => navigate(`/jam/${state.jam.id}`)

  const onFill = (item: JamItem, slot: Slot) => setFill({ item: item.id, slot })
  const onOpen = (item: JamItem, at?: { x: number; y: number } | null) =>
    setOpen({ item: item.id, at })

  const goLive = async () => {
    const ok = await confirm({
      title: 'Go live?',
      message: `${state.items.filter(i => i.state === 'open').length} songs go into the queue, in lineup order. People can keep pitching.`,
      confirmLabel: 'Go live',
    })
    if (ok) void run(() => jams.goLive(state.jam.id), { ok: "You're live" })
  }

  const endJam = async () => {
    setMenu(false)
    const played =
      state.items.filter(i => i.state === 'played').length + (stage ? 1 : 0)
    const ok = await confirm({
      title: 'End the jam?',
      message: `${played} ${played === 1 ? 'song' : 'songs'} played stay. Hands, the queue and everyone without an account go, and the code stops working.`,
      confirmLabel: 'End jam',
      variant: 'danger',
    })
    if (!ok) return
    const r = await run(() => jams.endJam(state.jam.id))
    if (r) navigate(`/jam/${state.jam.id}`, { replace: true })
  }

  const lockLabel = state.jam.joining_locked ? 'Open joining' : 'Lock joining'
  const toggleLock = () => {
    setMenu(false)
    void run(() => jams.lockJoining(state.jam.id, !state.jam.joining_locked), {
      ok: state.jam.joining_locked ? 'Joining open' : 'Joining locked',
    })
  }

  const header = (
    <header className="flex items-center gap-2 px-3 md:px-5 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 border-b border-divider">
      <button
        type="button"
        onClick={exit}
        aria-label="Close the console"
        title="Back to the jam"
        className="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-bg-3 hover:bg-bg-4"
        data-testid="console-close"
      >
        <X size={20} />
      </button>
      <span className="flex-1 min-w-0 px-1">
        <b
          className="block text-[17px] md:text-[20px] truncate"
          data-testid="console-title"
        >
          {state.jam.name}
        </b>
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3">
          {live ? (
            <span className="inline-flex items-center gap-1 text-danger">
              <i className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              Live
            </span>
          ) : (
            <span>Planned</span>
          )}
          · {here} here · {handsUp} {handsUp === 1 ? 'hand' : 'hands'}
          {state.jam.joining_locked && ' · locked'}
        </span>
      </span>
      {desktop && (
        <>
          {live && (
            <Button
              icon={<Plus size={18} />}
              onClick={() => setWalkup(true)}
              data-testid="console-walkup"
            >
              Walk-up
            </Button>
          )}
          {codeMode && <OpenTvButton code={state.jam.short_code} />}
          {codeMode && <StartKioskButton eventId={state.jam.id} />}
          {live && (
            <Button
              variant="outline"
              icon={<Power size={17} />}
              onClick={() => void endJam()}
              data-testid="console-end"
            >
              End jam
            </Button>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => setMenu(true)}
        aria-label="More"
        className="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-bg-3 hover:bg-bg-4"
        data-testid="console-more"
      >
        <MoreHorizontal size={20} />
      </button>
    </header>
  )

  const viewToggle = (
    <div className="max-w-[280px]">
      <Segmented
        label="View"
        value={view}
        onChange={setView}
        options={[
          { value: 'console', label: 'Console' },
          { value: 'grid', label: 'Grid' },
        ]}
        data-testid="console-view"
      />
    </div>
  )

  const stageBlock = live ? (
    <div className="flex flex-col gap-2.5 px-3">
      <OnStage
        item={stage}
        lastPlayed={lastPlayed}
        actions={actions}
        now={now}
      />
      {upNext ? (
        <UpNextCard
          state={state}
          item={upNext}
          then={after}
          actions={actions}
          onFill={onFill}
        />
      ) : (
        <QuietStage state={state} actions={actions} />
      )}
    </div>
  ) : (
    <div
      className="mx-3 rounded-[24px] bg-bg-2 p-5"
      data-testid="console-not-live"
    >
      <b className="block text-[22px]">This jam isn't live yet</b>
      <p className="text-[14px] text-ink-2 mt-1 mb-3">
        Going live turns the lineup into the queue. Pitches and hands carry
        over.
      </p>
      <Button
        variant="primary"
        size="xl"
        icon={<Play size={18} />}
        onClick={() => void goLive()}
        className="!h-16"
        data-testid="console-go-live"
      >
        Go live
      </Button>
    </div>
  )

  const queueBlock = live && after.length > 0 && (
    <section data-testid="console-after">
      <div className="flex items-center px-6 pt-4 pb-1 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3">
        After that · {after.length}
      </div>
      <QueueList
        items={after}
        offset={1}
        desktop={desktop}
        actions={actions}
        onOpen={onOpen}
      />
    </section>
  )

  const gridItems = [
    ...(stage ? [stage] : []),
    ...queue,
    ...state.items
      .filter(i => i.state === 'pending' || i.state === 'open')
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
  ]
  const grid = (
    <div className="px-3">
      {gridItems.length ? (
        <JamGrid
          items={gridItems}
          state={state}
          onCell={onFill}
          data-testid="console-grid"
        />
      ) : (
        <p className="px-3 py-6 text-ink-3">No songs yet.</p>
      )}
    </div>
  )

  const quick = !desktop && (
    <div className="grid grid-cols-3 gap-2 px-3 pt-3">
      {[
        live && {
          icon: <Plus size={20} />,
          label: 'Walk-up',
          onClick: () => setWalkup(true),
          id: 'console-walkup',
        },
        {
          icon: <Users size={20} />,
          label: `People · ${here}`,
          onClick: () => setPeopleOpen(true),
          id: 'console-people-open',
        },
        codeMode && {
          icon: <QrCode size={20} />,
          label: 'Join code',
          onClick: () => setCodeOpen(true),
          id: 'console-code-open',
        },
      ]
        .filter(Boolean)
        .map(a => {
          const b = a as {
            icon: React.ReactNode
            label: string
            onClick: () => void
            id: string
          }
          return (
            <button
              key={b.id}
              type="button"
              onClick={b.onClick}
              className="min-h-16 rounded-[18px] bg-bg-2 shadow-group flex flex-col items-center justify-center gap-1 text-[12.5px] font-bold text-ink-1 [&>svg]:text-accent-ink"
              data-testid={b.id}
            >
              {b.icon}
              {b.label}
            </button>
          )
        })}
    </div>
  )

  const fillItem = fill ? items.get(fill.item) : undefined
  const openItem = open ? items.get(open.item) : undefined

  return (
    <Shell>
      {header}
      <div className="flex-1 min-h-0 flex">
        <main
          className="flex-1 min-w-0 overflow-y-auto custom-scrollbar pb-[max(24px,env(safe-area-inset-bottom))]"
          data-testid="console-main"
        >
          <div className="max-w-[860px] mx-auto pt-3">
            <div className="px-3 pb-3">{viewToggle}</div>
            {view === 'grid' ? (
              grid
            ) : (
              <>
                {stageBlock}
                {queueBlock}
                {quick}
                <div className="pt-2">
                  <PitchesPanel
                    state={state}
                    actions={actions}
                    onOpen={onOpen}
                  />
                  {!desktop && <HandsPanel state={state} actions={actions} />}
                </div>
              </>
            )}
          </div>
        </main>
        {desktop && (
          <aside
            className="w-[380px] shrink-0 border-l border-divider overflow-y-auto custom-scrollbar pt-3 pb-6"
            data-testid="console-side"
          >
            <HandsPanel state={state} actions={actions} />
            <div className="pt-2">
              <JoinCode state={state} />
            </div>
            <PeoplePanel state={state} run={run} />
          </aside>
        )}
      </div>

      {fill && fillItem && (
        <FillPartSheet
          state={state}
          item={fillItem}
          slot={
            fillItem.slots.find(
              s =>
                s.key === fill.slot.key &&
                (s.label ?? '') === (fill.slot.label ?? '') &&
                s.nth === fill.slot.nth
            ) ?? fill.slot
          }
          run={run}
          onClose={() => setFill(null)}
        />
      )}
      {open && openItem && (
        <ItemSheet
          state={state}
          item={openItem}
          actions={actions}
          at={open.at}
          onFill={s => onFill(openItem, s)}
          onClose={() => setOpen(null)}
        />
      )}
      {walkup && (
        <WalkupSheet state={state} run={run} onClose={() => setWalkup(false)} />
      )}
      {peopleOpen && (
        <Sheet
          onClose={() => setPeopleOpen(false)}
          title="People"
          data-testid="console-people-sheet"
        >
          <div className="-mx-3 pb-2">
            <PeoplePanel state={state} run={run} />
          </div>
        </Sheet>
      )}
      {codeOpen && (
        <Sheet
          onClose={() => setCodeOpen(false)}
          title="Join code"
          sub="Scan, or type the code at rockon.band/j"
          data-testid="console-code-sheet"
        >
          <div className="-mx-3 pb-2">
            <JoinCode state={state} />
          </div>
        </Sheet>
      )}
      {menu && (
        <Sheet
          onClose={() => setMenu(false)}
          title={state.jam.name}
          data-testid="console-menu"
        >
          <div className="pb-2">
            {live && (
              <SheetItem
                icon={<Plus />}
                label="Walk-up"
                onClick={() => {
                  setMenu(false)
                  setWalkup(true)
                }}
                data-testid="console-menu-walkup"
              />
            )}
            <SheetItem
              icon={<Users />}
              label={lockLabel}
              hint={state.jam.joining_locked ? 'Locked' : undefined}
              onClick={toggleLock}
              data-testid="console-menu-lock"
            />
            {codeMode && (
              <>
                <OpenTvButton
                  code={state.jam.short_code}
                  variant="item"
                  onOpened={() => setMenu(false)}
                />
                <SheetItem
                  icon={<QrCode />}
                  label="Open counter iPad"
                  onClick={() => {
                    setMenu(false)
                    setKiosk(true)
                  }}
                  data-testid="console-menu-kiosk"
                />
              </>
            )}
            {live && (
              <SheetItem
                icon={<Power />}
                label="End jam"
                danger
                onClick={() => void endJam()}
                data-testid="console-menu-end"
              />
            )}
          </div>
        </Sheet>
      )}
      {kiosk && (
        <KioskSheet eventId={state.jam.id} onClose={() => setKiosk(false)} />
      )}
      <ConfirmDialog {...dialogProps} />
    </Shell>
  )
}

export default JamConsolePage
