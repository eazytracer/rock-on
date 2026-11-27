/**
 * The web guest (`/j/:code` signed out; Jam Plan 11–12, Jam Live 7): no
 * account, a first name and parts. Arriving → join_jam_as_web_guest; the token
 * stays on this device (localStorage `rockon.jam.<CODE>`). In: on stage, up
 * next, the lineup with hands per part (raise / lower your own), Request a
 * song, your name and parts, Leave. A dead token (ended jam, removed, another
 * jam's token) is dropped: an ended jam says so with no names; otherwise the
 * guest can join again.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, User } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../hooks/useConfirm'
import {
  guestToken,
  useJamAction,
  useJamPreview,
  useJamState,
  type JamItem,
} from '../../hooks/useJam'
import * as jams from '../../services/api/jams'
import type { JamState, Part } from '../../services/api/jams'
import { ApiError, errorText } from '../../services/api/errors'
import { Button, Group, Sheet } from '../../components/ui'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { PartPicker } from '../../components/jams/guest/PartPicker'
import { GuestSongRow } from '../../components/jams/guest/GuestSongRow'
import { JamHeader } from '../../components/jams/guest/JamHeader'
import { CodeRefusal } from '../../components/jams/guest/CodeRefusal'
import { JAM_ENDED, isEnded } from '../../components/jams/guest/helpers'
import { partsText } from '../../components/jams/guest/parts'
import { encodeReturnTo } from '../../utils/returnTo'
import { useBrandAccent } from '../auth/AuthFrame'

const NAME_MAX = 40
const TITLE_MAX = 80
const label =
  'block font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 mb-1.5'
const field =
  'w-full h-12 px-4 rounded-2xl bg-bg-3 text-[16px] text-ink-1 outline-none placeholder:text-ink-4 focus:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]'

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    data-testid="web-guest-page"
    style={useBrandAccent()}
    className="min-h-screen bg-bg-0 text-ink-1"
  >
    <div className="max-w-[440px] mx-auto px-4 pt-6 pb-16">{children}</div>
  </div>
)

export const WebGuestPage: React.FC<{ code: string }> = ({ code }) => {
  const [token, setToken] = useState(() => guestToken.get(code))
  const [lost, setLost] = useState(false)
  const preview = useJamPreview(code)
  const eventId = preview.data?.event_id ?? null
  const refetchPreview = preview.refetch
  const state = useJamState(token ? eventId : null, { token })

  // A token the server no longer takes: drop it, then see why.
  const dead =
    !!token &&
    state.error instanceof ApiError &&
    state.error.key === 'forbidden'
  useEffect(() => {
    if (!dead) return
    guestToken.clear(code)
    setToken(null)
    setLost(true)
    void refetchPreview()
  }, [dead, code, refetchPreview])

  const ended =
    isEnded(preview.data?.status) ||
    (!!token && isEnded(state.data?.jam.status))
  useEffect(() => {
    if (ended && token) {
      guestToken.clear(code)
      setToken(null)
    }
  }, [ended, token, code])

  if (preview.isLoading || (lost && preview.isFetching)) {
    return (
      <Frame>
        <div className="flex flex-col gap-3" aria-busy>
          <span className="w-40 h-3 rounded bg-bg-3 animate-pulse" />
          <span className="w-64 h-9 rounded-lg bg-bg-3 animate-pulse" />
        </div>
      </Frame>
    )
  }
  if (preview.error || !preview.data) {
    return (
      <Frame>
        <CodeRefusal error={preview.error} onRetry={() => preview.refetch()} />
        <SignUpLine code={code} />
      </Frame>
    )
  }
  if (ended) {
    return (
      <Frame>
        <div
          className="flex flex-col items-center text-center gap-3 pt-16"
          data-testid="web-guest-ended"
        >
          <b className="font-display font-extrabold uppercase text-[34px] leading-[.95]">
            {JAM_ENDED}
          </b>
        </div>
        <SignUpLine code={code} />
      </Frame>
    )
  }

  const p = preview.data
  const header = (
    <JamHeader
      name={state.data?.jam.name ?? p.name ?? ''}
      status={state.data?.jam.status ?? p.status}
      at={p.scheduled_date}
      venue={p.venue}
      className="mb-4"
    />
  )

  if (!token) {
    return (
      <Frame>
        {header}
        <Arriving
          code={code}
          notice={lost}
          onJoined={t => {
            guestToken.set(code, t)
            setLost(false)
            setToken(t)
          }}
        />
        <SignUpLine code={code} />
      </Frame>
    )
  }

  if (!state.data) {
    return (
      <Frame>
        {header}
        {state.error ? (
          <CodeRefusal error={state.error} onRetry={() => state.refetch()} />
        ) : (
          <div
            className="h-40 rounded-[20px] bg-bg-3 animate-pulse"
            aria-busy
          />
        )}
      </Frame>
    )
  }

  return (
    <Frame>
      {header}
      <GuestIn
        code={code}
        token={token}
        state={state.data}
        onLeft={() => {
          guestToken.clear(code)
          setToken(null)
        }}
      />
      <SignUpLine code={code} />
    </Frame>
  )
}

const SignUpLine: React.FC<{ code: string }> = ({ code }) => {
  const back = encodeReturnTo(`/j/${code}`)
  return (
    <p
      className="mt-10 text-center text-[13.5px] text-ink-3"
      data-testid="web-guest-signup"
    >
      Get the app to keep your songs and find people who know them.{' '}
      <Link
        to={`/auth/signup?returnTo=${back}`}
        className="font-bold text-ink-1"
        data-testid="web-guest-signup-link"
      >
        Sign up free
      </Link>{' '}
      ·{' '}
      <Link
        to={`/auth?returnTo=${back}`}
        className="font-bold text-ink-1"
        data-testid="web-guest-login-link"
      >
        Log in
      </Link>
    </p>
  )
}

// ── Arriving ─────────────────────────────────────────────────────────────────
const Arriving: React.FC<{
  code: string
  notice: boolean
  onJoined: (token: string) => void
}> = ({ code, notice, onJoined }) => {
  const [name, setName] = useState('')
  const [parts, setParts] = useState<Part[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed) {
      setError('Add your first name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await jams.joinJamAsWebGuest(code, trimmed, parts)
      onJoined(r.token)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-[24px] bg-bg-2 shadow-group p-4 flex flex-col gap-3"
      data-testid="web-guest-arriving"
    >
      {notice && (
        <p className="text-[13.5px] text-ink-3" data-testid="web-guest-notice">
          You're not on this jam right now. Join again below.
        </p>
      )}
      <b className="text-[17px]">Let the host know you're here</b>
      <div>
        <label htmlFor="web-guest-name" className={label}>
          Your name
        </label>
        <input
          id="web-guest-name"
          name="guestName"
          data-testid="web-guest-name-input"
          autoComplete="given-name"
          maxLength={NAME_MAX}
          value={name}
          onChange={e => {
            setName(e.target.value)
            setError(null)
          }}
          placeholder="First name"
          className={field}
        />
      </div>
      <div>
        <span className={label}>You play</span>
        <PartPicker
          value={parts}
          onChange={setParts}
          listening
          testid="web-guest-parts"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="text-[14px] text-danger"
          data-testid="web-guest-error"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={busy}
        data-testid="web-guest-join-button"
      >
        {busy ? 'Joining…' : "I'm here"}
      </Button>
    </form>
  )
}

// ── In ───────────────────────────────────────────────────────────────────────
const LIVE_STATES = new Set(['pending', 'open', 'queued', 'stage'])

const GuestIn: React.FC<{
  code: string
  token: string
  state: JamState
  onLeft: () => void
}> = ({ token, state, onLeft }) => {
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const [editing, setEditing] = useState(false)
  const [pitching, setPitching] = useState(false)
  const me = state.me
  const myParts = useMemo(() => me?.parts ?? [], [me])
  const eventId = state.jam.id
  const byId = useMemo(
    () => new Map(state.items.map(i => [i.id, i])),
    [state.items]
  )
  const stage = state.stage ? byId.get(state.stage) : undefined
  const upNext = state.up_next ? byId.get(state.up_next) : undefined
  const queued = state.queue
    .filter(id => id !== state.up_next)
    .map(id => byId.get(id))
    .filter((i): i is JamItem => !!i)
  const rest = state.items
    .filter(
      i =>
        LIVE_STATES.has(i.state) &&
        i.state !== 'stage' &&
        i.state !== 'queued' &&
        i.id !== state.up_next
    )
    .sort(
      (a, b) =>
        Number(a.state === 'pending') - Number(b.state === 'pending') ||
        a.position - b.position
    )

  const fail = (err: unknown) => showToast(errorText(err), 'error')
  const raise = useJamAction((v: { item: JamItem; part: Part }) =>
    jams.raiseHand(v.item.id, [v.part], token)
  )
  const lower = useJamAction((handId: string) => jams.lowerHand(handId, token))
  const busy = raise.isPending || lower.isPending
  const row = (item: JamItem, tag?: string) => (
    <GuestSongRow
      key={item.id}
      item={item}
      myParts={myParts}
      tag={tag ?? (item.state === 'pending' ? 'Pending' : undefined)}
      busy={busy}
      onRaise={(i, part) => raise.mutate({ item: i, part }, { onError: fail })}
      onLower={id => lower.mutate(id, { onError: fail })}
    />
  )

  const leave = async () => {
    const ok = await confirm({
      title: 'Leave this jam?',
      message: 'Your name and hands come off the list.',
      confirmLabel: 'Leave',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await jams.leaveJam(eventId, token)
      onLeft()
      showToast('You left the jam', 'success')
    } catch (err) {
      fail(err)
    }
  }

  return (
    <div data-testid="web-guest-in">
      <div className="flex items-center gap-2.5 rounded-[20px] bg-bg-2 shadow-group px-4 py-3 mb-4">
        <User size={18} className="text-ink-3 shrink-0" />
        <span className="flex-1 text-[15px]" data-testid="web-guest-me">
          You're <b>{me?.name}</b> · {partsText(myParts)}
        </span>
        <Button
          variant="text"
          onClick={() => setEditing(true)}
          data-testid="web-guest-change"
        >
          Change
        </Button>
      </div>

      {stage && (
        <Group label="On stage" data-testid="web-guest-stage">
          {row(stage, 'On stage')}
        </Group>
      )}
      {upNext && (
        <Group label="Up next" data-testid="web-guest-up-next">
          {row(upNext)}
        </Group>
      )}
      {(queued.length > 0 || rest.length > 0) && (
        <Group
          label={stage || upNext ? 'After that' : 'Lineup'}
          data-testid="web-guest-lineup"
        >
          {queued.map(i => row(i))}
          {rest.map(i => row(i))}
        </Group>
      )}
      {!stage && !upNext && queued.length === 0 && rest.length === 0 && (
        <p
          className="text-[15px] text-ink-3 px-2 py-6 text-center"
          data-testid="web-guest-empty"
        >
          Nothing on the lineup yet. Request a song to get it started.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={<Plus size={18} />}
          disabled={!state.jam.requests_open}
          onClick={() => setPitching(true)}
          data-testid="web-guest-request-button"
        >
          Request a song
        </Button>
        {!state.jam.requests_open && (
          <p className="text-[13px] text-ink-3 text-center">
            Song requests are closed right now.
          </p>
        )}
        <Button variant="text" onClick={leave} data-testid="web-guest-leave">
          Leave jam
        </Button>
      </div>

      {editing && me && (
        <EditMe
          eventId={eventId}
          token={token}
          name={me.name}
          parts={myParts}
          jamParts={state.jam.default_parts}
          onClose={() => setEditing(false)}
        />
      )}
      {pitching && (
        <Pitch
          eventId={eventId}
          token={token}
          parts={myParts}
          jamParts={state.jam.default_parts}
          onClose={() => setPitching(false)}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

const EditMe: React.FC<{
  eventId: string
  token: string
  name: string
  parts: Part[]
  jamParts: Part[]
  onClose: () => void
}> = ({
  eventId,
  token,
  name: initialName,
  parts: initial,
  jamParts,
  onClose,
}) => {
  const { showToast } = useToast()
  const [name, setName] = useState(initialName)
  const [parts, setParts] = useState<Part[]>(initial)
  const save = useJamAction(() =>
    jams.updateMe(eventId, { name: name.trim(), parts }, token)
  )
  return (
    <Sheet onClose={onClose} title="You" data-testid="web-guest-edit-sheet">
      <div className="flex flex-col gap-3 pb-2">
        <div>
          <label htmlFor="web-guest-edit-name" className={label}>
            Your name
          </label>
          <input
            id="web-guest-edit-name"
            name="guestName"
            data-testid="web-guest-edit-name-input"
            maxLength={NAME_MAX}
            value={name}
            onChange={e => setName(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <span className={label}>You play</span>
          <PartPicker
            value={parts}
            onChange={setParts}
            jamParts={jamParts}
            listening
            testid="web-guest-edit-parts"
          />
        </div>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!name.trim() || save.isPending}
          onClick={() =>
            save.mutate(undefined, {
              onSuccess: onClose,
              onError: err => showToast(errorText(err), 'error'),
            })
          }
          data-testid="web-guest-edit-save"
        >
          Save
        </Button>
      </div>
    </Sheet>
  )
}

const Pitch: React.FC<{
  eventId: string
  token: string
  parts: Part[]
  jamParts: Part[]
  onClose: () => void
}> = ({ eventId, token, parts: myParts, jamParts, onClose }) => {
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [parts, setParts] = useState<Part[]>(myParts)
  const send = useJamAction(() =>
    jams.pitchSong(
      eventId,
      {
        title: title.trim(),
        artist: artist.trim() || undefined,
        myParts: parts,
      },
      token
    )
  )
  return (
    <Sheet
      onClose={onClose}
      title="Request a song"
      sub="The host sees it with your name."
      data-testid="web-guest-pitch-sheet"
    >
      <div className="flex flex-col gap-3 pb-2">
        <div>
          <label htmlFor="web-guest-pitch-title" className={label}>
            Song
          </label>
          <input
            id="web-guest-pitch-title"
            name="pitchTitle"
            data-testid="web-guest-pitch-title-input"
            autoFocus
            maxLength={TITLE_MAX}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="web-guest-pitch-artist" className={label}>
            Artist
          </label>
          <input
            id="web-guest-pitch-artist"
            name="pitchArtist"
            data-testid="web-guest-pitch-artist-input"
            maxLength={TITLE_MAX}
            value={artist}
            onChange={e => setArtist(e.target.value)}
            placeholder="Optional"
            className={field}
          />
        </div>
        <div>
          <span className={label}>I'll play</span>
          <PartPicker
            value={parts}
            onChange={setParts}
            jamParts={jamParts}
            testid="web-guest-pitch-parts"
          />
        </div>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!title.trim() || send.isPending}
          onClick={() =>
            send.mutate(undefined, {
              onSuccess: item => {
                showToast(
                  item.state === 'pending'
                    ? 'Sent. The host will look at it.'
                    : 'Added to the lineup',
                  'success'
                )
                onClose()
              },
              onError: err => showToast(errorText(err), 'error'),
            })
          }
          data-testid="web-guest-pitch-send"
        >
          {send.isPending ? 'Sending…' : 'Send request'}
        </Button>
      </div>
    </Sheet>
  )
}

export default WebGuestPage
