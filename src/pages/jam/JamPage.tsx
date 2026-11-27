/**
 * One jam (`/jam/:id`), by status:
 * - planned (scheduled / confirmed): host and co-hosts get Lineup / Requests /
 *   People (+ Grid view, Go live in the dock on phones, Access and Invite on
 *   the side on desktop, ⋯ Edit / Settings / Delete); everyone else Lineup /
 *   My hands / Request. Invited people who haven't joined get Join first.
 * - live: the participant's Tonight view; hosts also get Open console.
 * - ended: the played songs, and Save tonight as a setlist for hosts.
 * Everything reads jam_state (realtime `jam:<code>` + a 20 s poll).
 */
import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Hand,
  LayoutGrid,
  List,
  ListMusic,
  LogOut,
  Pencil,
  PartyPopper,
  Play,
  Radio,
  Settings2,
  Share2,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../hooks/useConfirm'
import { useMediaQuery } from '../../hooks/useResponsive'
import {
  usePersonalSongs,
  useCreateSong,
  useUpdateSong,
} from '../../hooks/useSongs'
import { useSetlistIndex } from '../../hooks/useSetlists'
import {
  formatCode,
  useJamAction,
  useJamState,
  type JamItem,
  type JamPerson,
} from '../../hooks/useJam'
import * as api from '../../services/api/jams'
import type { JamState, Part } from '../../services/api/jams'
import { ApiError, errorText } from '../../services/api/errors'
import { BackCrumb } from '../../components/layout/MobileHeader'
import { DockAction } from '../../components/layout/PhoneDock'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { ContentLoadingSpinner } from '../../components/common/ContentLoadingSpinner'
import { MoreButton } from '../../components/common/MoreButton'
import { AddSongsRow, SongBrowser } from '../../components/setlists/SongBrowser'
import {
  Button,
  Chip,
  Empty,
  Group,
  IconButton,
  RetryCard,
  Segmented,
  Sheet,
  SheetItem,
  TypeLabel,
} from '../../components/ui'
import { JamLineup } from '../../components/jams/JamLineup'
import { JamRequests } from '../../components/jams/JamRequests'
import { JamPeople } from '../../components/jams/JamPeople'
import { JamGrid } from '../../components/jams/JamGrid'
import { JamShareCard } from '../../components/jams/JamShareCard'
import {
  JamSettingsSheet,
  type JamSettingsValue,
} from '../../components/jams/JamSettingsSheet'
import { JamEditSheet } from '../../components/jams/JamForm'
import { InviteToJamSheet } from '../../components/jams/InviteToJamSheet'
import {
  JamRequestForm,
  type JamRequestValue,
} from '../../components/jams/JamRequestForm'
import { JamEnded } from '../../components/jams/JamEnded'
import { PartPicker } from '../../components/jams/PartChip'
import {
  CastSheet,
  HandSheet,
  ItemPartsSheet,
} from '../../components/jams/SlotSheets'
import { JamTonight } from '../../components/jams/live/JamTonight'
import {
  isEnded,
  isPlanned,
  jamFormAt,
  jamWhen,
  type JamFormValue,
  partLabel,
  partsFromInstruments,
} from '../../components/jams/parts'

type Slot = JamItem['slots'][number]
type At = { x: number; y: number } | null
type HostTab = 'lineup' | 'requests' | 'people'
type GuestTab = 'lineup' | 'hands' | 'request'

const kicker = 'font-mono text-[11px] tracking-[.12em] uppercase text-ink-3'

export const JamPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: state, isLoading, error, refetch } = useJamState(id)

  if (isLoading)
    return <ContentLoadingSpinner isLoading>{null}</ContentLoadingSpinner>
  if (error || !state) {
    const key = error instanceof ApiError ? error.key : ''
    return (
      <div data-testid="jam-page" className="max-w-3xl">
        <BackCrumb to="/jam" label="Jam" data-testid="jam-back" />
        {key === 'forbidden' || key === 'not_found' || key === 'no_jam' ? (
          <Empty
            icon={<PartyPopper size={28} />}
            title="Jam not found"
            why="It may have been deleted, or you're not in it. Ask the host for the code."
            action={
              <Button
                onClick={() => navigate('/jam')}
                data-testid="jam-not-found-hub"
              >
                Back to Jam
              </Button>
            }
            data-testid="jam-not-found"
          />
        ) : (
          <div className="-mx-3 mt-4">
            <RetryCard
              message="Couldn't load this jam."
              onRetry={() => void refetch()}
            />
          </div>
        )}
      </div>
    )
  }
  return <JamView state={state} />
}

const JamView: React.FC<{ state: JamState }> = ({ state }) => {
  const { jam, me } = state
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 768px)')
  const wide = useMediaQuery('(min-width: 1024px)')
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const { user, currentUserProfile } = useAuth()
  const userId = user?.id ?? ''
  const manage = !!me?.is_manager
  const isHost = !!me?.is_host
  const planned = isPlanned(jam.status)
  const live = jam.status === 'live'

  const [sheet, setSheet] = useState<
    | null
    | { kind: 'menu'; at: At }
    | { kind: 'edit' | 'settings' | 'invite' | 'share' | 'parts-me' }
    | { kind: 'cast'; item: string; slot: Slot }
    | { kind: 'hands'; item: string }
    | { kind: 'parts'; item: string }
    | { kind: 'item'; item: string; at: At }
    | { kind: 'person'; person: string; at: At }
  >(null)
  const close = () => setSheet(null)
  const [browsing, setBrowsing] = useState(false)
  const [grid, setGrid] = useState(false)
  const [hostTab, setHostTab] = useState<HostTab>('lineup')
  const [guestTab, setGuestTab] = useState<GuestTab>('lineup')

  // One mutation for every jam write: toast the server's copy on failure.
  const action = useJamAction(async (fn: () => Promise<unknown>) => fn())
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await action.mutateAsync(fn)
      if (done) showToast(done, 'success')
      return true
    } catch (err) {
      showToast(errorText(err), 'error')
      return false
    }
  }
  const busy = action.isPending

  const byId = useMemo(
    () => new Map(state.items.map(i => [i.id, i])),
    [state.items]
  )
  const lineup = state.items.filter(i => i.state === 'open')
  const pending = state.items.filter(i => i.state === 'pending')
  const myHands = state.items.filter(
    i => i.state !== 'removed' && i.hands.some(h => h.mine)
  )
  const joinedPeople = state.people.filter(p => p.joined)
  const withoutApp = joinedPeople.filter(p => !p.has_account).length
  const canInvite = manage || (jam.who_can_join !== 'invite' && !!me?.joined)
  const codeMode = jam.who_can_join === 'code'

  // ── My Songs (decision 11) ────────────────────────────────────────────────
  const { songs: mySongs } = usePersonalSongs(userId)
  const { createSong } = useCreateSong()
  const { updateSong } = useUpdateSong()
  const addMine = (it: JamItem) =>
    run(
      async () => {
        if (!it.mine) {
          await createSong({
            title: it.title,
            artist: it.artist ?? '',
            guitarTuning: it.tuning ?? undefined,
            key: it.key ?? undefined,
            tags: ['jam'],
            difficulty: 1,
            structure: [],
            chords: [],
            referenceLinks: [],
            confidenceLevel: 1,
            contextType: 'personal',
            contextId: userId,
            createdBy: userId,
            visibility: 'personal',
          })
        } else {
          const s = mySongs.find(x => x.id === it.mine!.song_id)
          await updateSong(it.mine.song_id, {
            tags: [...new Set([...(s?.tags ?? []), 'jam'])],
          })
        }
      },
      it.mine ? 'Added to your jam songs' : 'Added to My Songs'
    )

  // ── Header ────────────────────────────────────────────────────────────────
  const where = jam.venue || jam.location
  const header = (
    <header className="mb-4" data-testid="jam-header">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p
            className={`${kicker} flex items-center gap-1.5 min-w-0`}
            data-testid="jam-kicker"
          >
            {live ? (
              <span
                className="inline-flex items-center gap-1.5 font-bold text-danger shrink-0"
                data-testid="jam-live-mark"
              >
                <span
                  className="w-2 h-2 rounded-full bg-danger animate-pulse"
                  aria-hidden
                />
                Live
              </span>
            ) : (
              <span className="shrink-0">
                <TypeLabel type="jam" />
              </span>
            )}
            <span className="truncate">
              · {jamWhen(jam.scheduled_date)}
              {where && ` · ${where}`}
            </span>
          </p>
          <h1
            className={`mt-1 font-display font-extrabold uppercase leading-[.9] text-[40px] md:text-[50px] ${
              jam.status === 'cancelled'
                ? 'line-through text-ink-3'
                : 'text-ink-1'
            }`}
            data-testid="jam-title"
          >
            {jam.name}
          </h1>
          <p className={`${kicker} mt-2`} data-testid="jam-code-line">
            {codeMode && (
              <>
                Code{' '}
                <b className="text-ink-1 font-semibold">
                  {formatCode(jam.short_code)}
                </b>{' '}
                ·{' '}
              </>
            )}
            {joinedPeople.length} joined
            {withoutApp > 0 && ` · ${withoutApp} without the app`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {!wide && codeMode && planned && (
            <IconButton
              aria-label="Share the jam"
              onClick={() => setSheet({ kind: 'share' })}
              data-testid="jam-share-button"
            >
              <Share2 size={19} />
            </IconButton>
          )}
          {desktop && planned && manage && (
            <Button
              variant="primary"
              icon={<Play size={17} />}
              onClick={() => void askGoLive()}
              data-testid="jam-go-live"
            >
              Go live
            </Button>
          )}
          {live && manage && (
            <Button
              variant="primary"
              icon={<ArrowRight size={17} />}
              onClick={() => navigate(`/jam/${jam.id}/live`)}
              data-testid="jam-open-console"
            >
              Open console
            </Button>
          )}
          {me && (
            <MoreButton
              label="Jam menu"
              onClick={e => {
                const r = e.currentTarget.getBoundingClientRect()
                setSheet({
                  kind: 'menu',
                  at: desktop ? { x: r.right - 288, y: r.bottom + 6 } : null,
                })
              }}
              data-testid="jam-more"
            />
          )}
        </div>
      </div>
    </header>
  )

  // ── Host actions ──────────────────────────────────────────────────────────
  const hands = state.items.reduce((n, i) => n + i.hands.length, 0)
  const askGoLive = async () => {
    const ok = await confirm({
      title: 'Go live?',
      message: `Starts the live jam with ${lineup.length} ${lineup.length === 1 ? 'song' : 'songs'} on the lineup, ${hands} ${hands === 1 ? 'hand' : 'hands'} up and ${joinedPeople.length} ${joinedPeople.length === 1 ? 'person' : 'people'}. Requests and hands carry over.`,
      confirmLabel: 'Go live',
      cancelLabel: 'Not yet',
    })
    if (ok && (await run(() => api.goLive(jam.id))))
      navigate(`/jam/${jam.id}/live`)
  }
  const askDelete = async () => {
    close()
    const ok = await confirm({
      title: `Delete ${jam.name}?`,
      message:
        'Removes the jam and its lineup for everyone who joined. They’ll get a notice.',
      confirmLabel: 'Delete jam',
      cancelLabel: 'Keep it',
      variant: 'danger',
    })
    if (ok && (await run(() => api.deleteJam(jam.id), 'Jam deleted')))
      navigate('/jam', { replace: true })
  }
  const askLeave = async () => {
    close()
    const ok = await confirm({
      title: `Leave ${jam.name}?`,
      message: 'Your hands come down. You can join again while it’s open.',
      confirmLabel: 'Leave',
      variant: 'warning',
    })
    if (ok && (await run(() => api.leaveJam(jam.id), 'You left the jam')))
      navigate('/jam', { replace: true })
  }
  const saveEdit = async (v: JamFormValue) => {
    if (
      await run(
        () =>
          api.updateJam(
            jam.id,
            {
              name: v.name.trim(),
              scheduled_date: jamFormAt(v).toISOString(),
              venue: v.where.trim(),
            },
            jam.version
          ),
        'Jam saved'
      )
    )
      close()
  }
  const saveSettings = async (v: JamSettingsValue) => {
    if (await run(() => api.setJamSettings(jam.id, v), 'Settings saved'))
      close()
  }
  const join = () =>
    run(
      () =>
        api.joinJamById(
          jam.id,
          partsFromInstruments(currentUserProfile?.instruments ?? [])
        ),
      `You're in ${jam.name}`
    )

  // ── Lineup handlers ───────────────────────────────────────────────────────
  const openSlot = (it: JamItem, slot: Slot) =>
    setSheet({ kind: 'cast', item: it.id, slot })
  const openItem = (it: JamItem) =>
    manage
      ? setSheet({ kind: 'item', item: it.id, at: null })
      : me?.joined
        ? setSheet({ kind: 'hands', item: it.id })
        : undefined
  const menuItem = (it: JamItem, at: At) =>
    setSheet({ kind: 'item', item: it.id, at: desktop ? at : null })

  // SongBrowser: the jam's catalog (band or personal), with free-text titles.
  const contextType = jam.band_id ? 'band' : 'personal'
  const contextId = jam.band_id ?? userId
  const { rows: otherSets } = useSetlistIndex(contextType, contextId)
  const inSet = useMemo(
    () => new Set(lineup.map(i => i.song_id).filter((x): x is string => !!x)),
    [lineup]
  )
  const addSongs = (ids: string[]) => run(() => api.addLineupSongs(jam.id, ids))
  const removeSong = (songId: string) => {
    const it = lineup.find(i => i.song_id === songId)
    return it
      ? run(() => api.setQueueState(it.id, 'removed'))
      : Promise.resolve(false)
  }
  const addTitle = (title: string) =>
    run(() => api.addLineupTitle(jam.id, title), `${title} added`)

  const lineupList = (items: JamItem[], testId: string, host: boolean) => (
    <JamLineup
      items={items}
      me={me?.participant_id ?? null}
      manage={host}
      showMine={!!me}
      busy={busy}
      onReorder={
        host ? ids => void run(() => api.reorderLineup(jam.id, ids)) : undefined
      }
      onSlot={openSlot}
      onOpen={openItem}
      onMenu={host ? menuItem : undefined}
      onMine={it => void addMine(it)}
      testId={testId}
    />
  )

  const emptyLineup = (
    <Empty
      icon={<ListMusic size={28} />}
      title="No one on the lineup yet"
      why={
        manage
          ? 'Add songs, or share the code. Approved requests land here.'
          : 'The host adds songs, and approved requests land here.'
      }
      data-testid="jam-lineup-empty"
    />
  )

  const lineupTab = (host: boolean) => (
    <>
      {host && lineup.length > 0 && (
        <div className="flex justify-end px-3 pb-2">
          <Chip
            on={grid}
            icon={grid ? <List size={15} /> : <LayoutGrid size={15} />}
            onClick={() => setGrid(g => !g)}
            data-testid="jam-grid-toggle"
          >
            {grid ? 'List view' : 'Grid view'}
          </Chip>
        </div>
      )}
      <div className="px-3">
        {!lineup.length ? (
          emptyLineup
        ) : grid && host ? (
          <JamGrid items={lineup} state={state} onCell={openSlot} />
        ) : (
          lineupList(lineup, 'jam-lineup', host)
        )}
        {host && (
          <AddSongsRow
            className="mt-2.5"
            onClick={() => setBrowsing(true)}
            data-testid="jam-add-songs"
          />
        )}
      </div>
      {!host && pending.length > 0 && (
        <div className="mt-4">
          <Group
            label={`Requests · ${pending.length}`}
            data-testid="jam-guest-requests"
          >
            <div className="-mx-0">
              <JamRequests
                items={pending}
                me={me?.participant_id ?? null}
                manage={false}
                busy={busy}
                onApprove={() => undefined}
                onDecline={() => undefined}
                onSlot={openSlot}
                onOpen={openItem}
              />
            </div>
          </Group>
        </div>
      )}
    </>
  )

  const requestsTab = (
    <div className="px-3">
      <div className="flex flex-wrap gap-2 pb-3">
        <Chip
          on={jam.approve_myself}
          onClick={() =>
            void run(() =>
              api.setJamSettings(jam.id, { approveMyself: !jam.approve_myself })
            )
          }
          data-testid="jam-requests-approve-myself"
        >
          Approve myself
        </Chip>
        <Chip
          on={jam.requests_open}
          onClick={() =>
            void run(() =>
              api.setJamSettings(jam.id, { requestsOpen: !jam.requests_open })
            )
          }
          data-testid="jam-requests-open"
        >
          Requests open
        </Chip>
      </div>
      {pending.length ? (
        <JamRequests
          items={pending}
          me={me?.participant_id ?? null}
          manage
          busy={busy}
          onApprove={it =>
            void run(
              () => api.approvePitch(it.id),
              `${it.title} is on the lineup`
            )
          }
          onDecline={it =>
            void run(() => api.declinePitch(it.id), 'Request declined')
          }
          onSlot={openSlot}
          onOpen={it => setSheet({ kind: 'hands', item: it.id })}
        />
      ) : (
        <Empty
          icon={<Hand size={28} />}
          title="No requests yet"
          why="People pitch songs with the parts they need. You approve them here."
          data-testid="jam-requests-empty"
        />
      )}
    </div>
  )

  const inviteBtn = canInvite && planned && (
    <Button
      icon={<UserPlus size={17} />}
      onClick={() => setSheet({ kind: 'invite' })}
      data-testid="jam-invite-button"
    >
      Invite friends
    </Button>
  )

  const peopleTab = (
    <div className="px-3">
      {inviteBtn && !wide && (
        <div className="flex justify-end pb-3">{inviteBtn}</div>
      )}
      <JamPeople
        people={state.people}
        hostId={jam.host_participant_id}
        onMenu={
          manage
            ? (p, at) =>
                setSheet({
                  kind: 'person',
                  person: p.participant_id,
                  at: desktop ? at : null,
                })
            : undefined
        }
      />
    </div>
  )

  const myParts = me?.parts ?? []
  const guestTop = me && (
    <div
      className="mx-3 mb-3 flex items-center gap-3 rounded-[20px] bg-bg-2 shadow-group px-4 py-3"
      data-testid="jam-my-parts"
    >
      <span className="flex-1 min-w-0 text-[14.5px] text-ink-1 truncate">
        You play{' '}
        {myParts.length ? myParts.map(partLabel).join(', ') : 'nothing yet'}
      </span>
      <Button
        className="!h-9 !text-[13px]"
        onClick={() => setSheet({ kind: 'parts-me' })}
        data-testid="jam-my-parts-change"
      >
        Change
      </Button>
    </div>
  )

  const sendRequest = async (v: JamRequestValue) => {
    try {
      const row = await action.mutateAsync(() =>
        api.pitchSong(jam.id, {
          title: v.title,
          artist: v.artist || undefined,
          myParts: v.myParts,
          partsNeeded: v.partsNeeded,
        })
      )
      const state2 = (row as api.JamItemRow | undefined)?.state
      showToast(
        state2 === 'pending'
          ? 'Request sent to the host'
          : `${v.title} is on the lineup`,
        'success'
      )
      setGuestTab('lineup')
      return true
    } catch (err) {
      showToast(errorText(err), 'error')
      return false
    }
  }

  // ── Planned body ──────────────────────────────────────────────────────────
  let body: React.ReactNode
  if (!me?.joined && me) {
    body = (
      <section
        className="mx-3 rounded-[20px] bg-bg-2 shadow-group p-5"
        data-testid="jam-invited-card"
      >
        <b className="block text-[18px] text-ink-1">You're invited</b>
        <p className="text-[14px] text-ink-3 mt-1">
          {jam.host_name} invited you. Join to see the lineup and raise your
          hand.
        </p>
        <Button
          variant="primary"
          size="lg"
          className="mt-4"
          disabled={busy}
          onClick={() => void join()}
          data-testid="jam-invited-join"
        >
          Join the jam
        </Button>
      </section>
    )
  } else if (manage) {
    body = (
      <>
        <div className="px-3 pb-3 md:max-w-[420px]">
          <Segmented
            options={[
              { value: 'lineup', label: `Lineup ${lineup.length}` },
              { value: 'requests', label: `Requests ${pending.length}` },
              { value: 'people', label: `People ${joinedPeople.length}` },
            ]}
            value={hostTab}
            onChange={setHostTab}
            label="Jam sections"
            data-testid="jam-tabs"
          />
        </div>
        {hostTab === 'lineup'
          ? lineupTab(true)
          : hostTab === 'requests'
            ? requestsTab
            : peopleTab}
      </>
    )
  } else {
    body = (
      <>
        {guestTop}
        <div className="px-3 pb-3 md:max-w-[420px]">
          <Segmented
            options={[
              { value: 'lineup', label: `Lineup ${lineup.length}` },
              {
                value: 'hands',
                label: `My hands ${myHands.reduce((n, i) => n + i.hands.filter(h => h.mine).length, 0)}`,
              },
              { value: 'request', label: 'Request' },
            ]}
            value={guestTab}
            onChange={setGuestTab}
            label="Jam sections"
            data-testid="jam-tabs"
          />
        </div>
        {guestTab === 'lineup' ? (
          lineupTab(false)
        ) : guestTab === 'hands' ? (
          <div className="px-3">
            {myHands.length ? (
              lineupList(myHands, 'jam-my-hands', false)
            ) : (
              <Empty
                icon={<Hand size={28} />}
                title="No hands up yet"
                why="Tap a song on the lineup to raise your hand for a part."
                data-testid="jam-my-hands-empty"
              />
            )}
          </div>
        ) : (
          <div className="px-3">
            <JamRequestForm
              myParts={myParts}
              defaultParts={jam.default_parts}
              busy={busy}
              closed={!jam.requests_open}
              onSend={sendRequest}
            />
          </div>
        )}
        {canInvite && !wide && guestTab === 'lineup' && (
          <div className="flex justify-center pt-4">{inviteBtn}</div>
        )}
      </>
    )
  }

  const side = wide && planned && me?.joined && (
    <aside className="flex flex-col gap-3" data-testid="jam-side">
      {codeMode && (
        <>
          <p className={kicker}>Access</p>
          <JamShareCard code={jam.short_code} name={jam.name} />
        </>
      )}
      {canInvite && <div>{inviteBtn}</div>}
    </aside>
  )

  // ── Sheets ────────────────────────────────────────────────────────────────
  const sheetItem = sheet && 'item' in sheet ? byId.get(sheet.item) : undefined
  const sheetPerson =
    sheet?.kind === 'person'
      ? state.people.find(p => p.participant_id === sheet.person)
      : undefined
  const menu = sheet?.kind === 'menu' && (
    <Sheet
      onClose={close}
      at={sheet.at}
      title={jam.name}
      data-testid="jam-menu-sheet"
    >
      <div role="menu" className="pb-1">
        {manage && planned && (
          <>
            <SheetItem
              icon={<Pencil />}
              label="Edit"
              hint="Name, date, where"
              onClick={() => setSheet({ kind: 'edit' })}
              data-testid="jam-menu-edit"
            />
            <SheetItem
              icon={<Settings2 />}
              label="Settings"
              hint="Who can join, requests"
              onClick={() => setSheet({ kind: 'settings' })}
              data-testid="jam-menu-settings"
            />
          </>
        )}
        {canInvite && planned && (
          <SheetItem
            icon={<UserPlus />}
            label="Invite friends"
            onClick={() => setSheet({ kind: 'invite' })}
            data-testid="jam-menu-invite"
          />
        )}
        {isHost && planned && (
          <SheetItem
            icon={<Trash2 />}
            label="Delete jam"
            danger
            onClick={() => void askDelete()}
            data-testid="jam-menu-delete"
          />
        )}
        {!isHost && me?.joined && !isEnded(jam.status) && (
          <SheetItem
            icon={<LogOut />}
            label="Leave jam"
            danger
            onClick={() => void askLeave()}
            data-testid="jam-menu-leave"
          />
        )}
      </div>
    </Sheet>
  )
  const itemMenu = sheet?.kind === 'item' && sheetItem && (
    <Sheet
      onClose={close}
      at={sheet.at}
      title={sheetItem.title}
      data-testid="jam-item-sheet"
    >
      <div role="menu" className="pb-1">
        <SheetItem
          icon={<Hand />}
          label="Raise my hand"
          onClick={() => setSheet({ kind: 'hands', item: sheetItem.id })}
          data-testid="jam-item-hands"
        />
        <SheetItem
          icon={<ListMusic />}
          label="Parts"
          hint={`${sheetItem.slots.length} slots`}
          onClick={() => setSheet({ kind: 'parts', item: sheetItem.id })}
          data-testid="jam-item-parts"
        />
        <SheetItem
          icon={<Trash2 />}
          label="Remove from lineup"
          danger
          onClick={() => {
            close()
            void run(
              () => api.setQueueState(sheetItem.id, 'removed'),
              `${sheetItem.title} removed`
            )
          }}
          data-testid="jam-item-remove"
        />
      </div>
    </Sheet>
  )
  const personMenu = sheet?.kind === 'person' && sheetPerson && (
    <PersonMenu
      person={sheetPerson}
      at={sheet.at}
      isHost={isHost}
      onClose={close}
      onCohost={on =>
        void run(
          () => api.setCohost(sheetPerson.participant_id, on),
          on ? `${sheetPerson.name} is a co-host` : 'Co-host removed'
        ).then(close)
      }
      onHouse={on =>
        void run(
          () => api.markHousePlayer(sheetPerson.participant_id, on),
          on ? 'Marked as a house player' : 'House mark removed'
        ).then(close)
      }
      onRemove={async () => {
        close()
        const ok = await confirm({
          title: `Remove ${sheetPerson.name}?`,
          message: 'They leave the jam and their hands come down.',
          confirmLabel: 'Remove',
          variant: 'danger',
        })
        if (ok)
          await run(
            () => api.removePerson(sheetPerson.participant_id),
            `${sheetPerson.name} removed`
          )
      }}
    />
  )

  const inJam = useMemo(
    () =>
      new Set(state.people.map(p => p.user_id).filter((x): x is string => !!x)),
    [state.people]
  )

  return (
    <div
      data-testid="jam-page"
      data-status={jam.status}
      className="max-w-6xl pb-28 md:pb-8"
    >
      <BackCrumb to="/jam" label="Jam" data-testid="jam-back" />
      <div className="mt-2 md:mt-4">{header}</div>

      {live ? (
        <JamTonight state={state} />
      ) : isEnded(jam.status) ? (
        <JamEnded
          state={state}
          busy={busy}
          onSave={async (type, ctx) => {
            try {
              const set = (await action.mutateAsync(() =>
                api.saveJamAsSetlist(jam.id, type, ctx)
              )) as api.SetlistRow
              showToast('Saved as a setlist', 'success')
              navigate(`/setlists/${set.id}`)
            } catch (err) {
              showToast(errorText(err), 'error')
            }
          }}
        />
      ) : (
        <div
          className={`-mx-3 ${wide ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start' : ''}`}
        >
          <div>{body}</div>
          {side && <div className="px-3">{side}</div>}
        </div>
      )}

      {!desktop && planned && manage && (
        <DockAction>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Radio size={18} />}
            onClick={() => void askGoLive()}
            data-testid="jam-go-live"
          >
            Go live
          </Button>
        </DockAction>
      )}
      {!desktop && live && manage && (
        <DockAction>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<ArrowRight size={18} />}
            onClick={() => navigate(`/jam/${jam.id}/live`)}
            data-testid="jam-open-console-dock"
          >
            Open console
          </Button>
        </DockAction>
      )}

      {menu}
      {itemMenu}
      {personMenu}
      {sheet?.kind === 'share' && (
        <Sheet
          onClose={close}
          title="Share the jam"
          data-testid="jam-share-sheet"
        >
          <div className="pb-2">
            <JamShareCard code={jam.short_code} name={jam.name} />
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'edit' && (
        <JamEditSheet
          jam={jam}
          saving={busy}
          onSave={v => void saveEdit(v)}
          onClose={close}
        />
      )}
      {sheet?.kind === 'settings' && (
        <JamSettingsSheet
          jam={jam}
          saving={busy}
          onSave={v => void saveSettings(v)}
          onClose={close}
        />
      )}
      {sheet?.kind === 'invite' && (
        <InviteToJamSheet
          inJam={inJam}
          busy={busy}
          onClose={close}
          onInvite={async ids => {
            if (
              await run(
                () => api.inviteToJam(jam.id, ids),
                ids.length === 1 ? 'Invite sent' : `${ids.length} invites sent`
              )
            )
              close()
          }}
        />
      )}
      {sheet?.kind === 'parts-me' && (
        <MyPartsSheet
          parts={myParts}
          extra={jam.default_parts}
          busy={busy}
          onClose={close}
          onSave={async parts => {
            if (await run(() => api.updateMe(jam.id, { parts }), 'Parts saved'))
              close()
          }}
        />
      )}
      {sheet?.kind === 'cast' && sheetItem && (
        <CastSheet
          item={sheetItem}
          slot={sheet.slot}
          people={state.people}
          busy={busy}
          onClose={close}
          onCast={async (pid, on) => {
            const name =
              state.people.find(p => p.participant_id === pid)?.name ?? ''
            if (
              await run(
                () =>
                  api.setCast(
                    sheetItem.id,
                    sheet.slot.label
                      ? { key: sheet.slot.key, label: sheet.slot.label }
                      : { key: sheet.slot.key },
                    pid,
                    on
                  ),
                on ? `${name} is on` : `${name} is off`
              )
            )
              close()
          }}
        />
      )}
      {sheet?.kind === 'hands' && sheetItem && (
        <HandSheet
          item={sheetItem}
          busy={busy}
          onClose={close}
          onRaise={p => void run(() => api.raiseHand(sheetItem.id, [p]))}
          onLower={h => void run(() => api.lowerHand(h))}
        />
      )}
      {sheet?.kind === 'parts' && sheetItem && (
        <ItemPartsSheet
          item={sheetItem}
          busy={busy}
          onClose={close}
          onSave={async parts => {
            if (
              await run(
                () => api.setItemParts(sheetItem.id, parts),
                'Parts saved'
              )
            )
              close()
          }}
        />
      )}
      {browsing && (
        <SongBrowser
          setName={jam.name}
          contextType={contextType}
          contextId={contextId}
          userId={userId}
          catalogName={jam.band_id ? 'band' : 'your'}
          inSet={inSet}
          otherSets={otherSets}
          onAdd={addSongs}
          onRemove={removeSong}
          onAddTitle={addTitle}
          onClose={() => setBrowsing(false)}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

const PersonMenu: React.FC<{
  person: JamPerson
  at: At
  isHost: boolean
  onClose: () => void
  onCohost: (on: boolean) => void
  onHouse: (on: boolean) => void
  onRemove: () => void
}> = ({ person, at, isHost, onClose, onCohost, onHouse, onRemove }) => (
  <Sheet
    onClose={onClose}
    at={at}
    title={person.name}
    data-testid="jam-person-sheet"
  >
    <div role="menu" className="pb-1">
      {isHost && person.has_account && person.joined && (
        <SheetItem
          icon={<Shield />}
          label={person.tier === 'cohost' ? 'Remove co-host' : 'Make co-host'}
          onClick={() => onCohost(person.tier !== 'cohost')}
          data-testid="jam-person-cohost"
        />
      )}
      <SheetItem
        icon={<Hand />}
        label={person.is_house ? 'Not a house player' : 'House player'}
        hint="Fills open parts"
        onClick={() => onHouse(!person.is_house)}
        data-testid="jam-person-house"
      />
      <SheetItem
        icon={<UserMinus />}
        label="Remove from jam"
        danger
        onClick={onRemove}
        data-testid="jam-person-remove"
      />
    </div>
  </Sheet>
)

const MyPartsSheet: React.FC<{
  parts: Part[]
  extra: Part[]
  busy: boolean
  onSave: (parts: Part[]) => void
  onClose: () => void
}> = ({ parts, extra, busy, onSave, onClose }) => {
  const [v, setV] = useState(parts)
  return (
    <Sheet
      onClose={onClose}
      title="What you play"
      sub="The host sees these when filling parts."
      data-testid="jam-my-parts-sheet"
    >
      <div className="pb-2">
        <PartPicker
          value={v}
          onChange={setV}
          extra={extra}
          testId="jam-my-parts-picker"
          label="What you play"
        />
        <div className="flex gap-2 pt-5">
          <Button
            size="lg"
            className="flex-1"
            onClick={onClose}
            data-testid="jam-my-parts-cancel"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            variant="primary"
            className="flex-1"
            disabled={busy}
            onClick={() => onSave(v)}
            data-testid="jam-my-parts-save"
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

export default JamPage
