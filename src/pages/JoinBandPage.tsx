/**
 * Join a band: `/j` (enter a code or paste a link) and `/j/:code`, the
 * preview (Band and Friends 7, desktop join): mark, name, description,
 * members' first names, song count; a big Join and a small Not now. A bad,
 * expired or regenerated code says so without naming the band. Signed-out
 * visitors are sent to sign in and back here (ProtectedLayoutRoute returnTo).
 */
import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Link2Off } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useMediaQuery } from '../hooks/useResponsive'
import { enterBand, useBandPreview, useJoinBand } from '../hooks/useBandAdmin'
import { BackCrumb } from '../components/layout/MobileHeader'
import { DockAction } from '../components/layout/PhoneDock'
import { Avatar } from '../components/common/Avatar'
import { BandMark, Button, Empty, RetryCard } from '../components/ui'
import { ApiError, errorText } from '../services/api/errors'
import type { BandMarkValue } from '../components/ui/bandMarkPalette'
import { parseInviteCode } from '../domain/invites'

const INVALID = "That code isn't valid any more. Ask the band for a new link."

export const JoinBandPage: React.FC = () => {
  const { code: raw } = useParams<{ code?: string }>()
  return raw ? <JoinPreview code={parseInviteCode(raw)} /> : <JoinCodeEntry />
}

const back = (navigate: ReturnType<typeof useNavigate>) => () =>
  window.history.length > 1 ? navigate(-1) : navigate('/')

const JoinCodeEntry: React.FC = () => {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const code = parseInviteCode(value)
  const go = () => code && navigate(`/j/${code}`)
  return (
    <div
      data-testid="join-band-page"
      className="max-w-[420px] md:mx-auto pb-28"
    >
      <BackCrumb
        label="Back"
        onClick={back(navigate)}
        className="mb-4"
        data-testid="join-back"
      />
      <h1 className="font-display font-extrabold uppercase text-[44px] leading-[.9] text-ink-1 mt-2">
        Join a band
      </h1>
      <p className="text-[15px] text-ink-2 mt-2 mb-5">
        Enter the code or paste the link a bandmate sent you. You'll see the
        band before you join.
      </p>
      <label
        htmlFor="join-code"
        className="block font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 mb-1.5"
      >
        Band code
      </label>
      <input
        id="join-code"
        name="inviteCode"
        data-testid="join-code-input"
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && go()}
        placeholder="ROCK2025"
        className="w-full h-14 px-4 rounded-2xl bg-bg-3 font-mono text-[22px] tracking-[.16em] uppercase text-ink-1 outline-none placeholder:text-ink-4 focus:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]"
      />
      <div className="mt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={<ArrowRight size={18} />}
          disabled={!code}
          onClick={go}
          data-testid="join-code-continue"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

const JoinPreview: React.FC<{ code: string }> = ({ code }) => {
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 768px)')
  const { userBands } = useAuth()
  const { showToast } = useToast()
  const { data: preview, isLoading, error, refetch } = useBandPreview(code)
  const join = useJoinBand()
  const [already, setAlready] = useState(false)

  const crumb = (
    <BackCrumb
      label="Back"
      onClick={back(navigate)}
      className="mb-4"
      data-testid="join-back"
    />
  )

  if (isLoading) {
    return (
      <div data-testid="join-preview-page" className="max-w-[420px] md:mx-auto">
        {crumb}
        <div className="flex flex-col items-center gap-3 pt-10" aria-busy>
          <span className="w-[84px] h-[84px] rounded-[24px] bg-bg-3 animate-pulse" />
          <span className="w-48 h-8 rounded-lg bg-bg-3 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !preview) {
    const invalid =
      !preview || (error instanceof ApiError && error.key === 'invite_invalid')
    return (
      <div data-testid="join-preview-page" className="max-w-[420px] md:mx-auto">
        {crumb}
        {invalid ? (
          <Empty
            icon={<Link2Off size={26} />}
            title="Invite not valid"
            why={INVALID}
            action={
              <div className="flex gap-2 mt-2">
                <Button
                  variant="primary"
                  onClick={() => navigate('/j')}
                  data-testid="join-enter-code"
                >
                  Enter a code
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  data-testid="join-not-now"
                >
                  Not now
                </Button>
              </div>
            }
            data-testid="join-invalid"
          />
        ) : (
          <RetryCard message={errorText(error)} onRetry={() => refetch()} />
        )}
      </div>
    )
  }

  const isMember = preview.is_member || already
  const existing = userBands.find(b => b.name === preview.name)
  const names = preview.member_first_names ?? []
  const songs = preview.song_count ?? 0

  const doJoin = async () => {
    try {
      const m = await join.mutateAsync(code)
      enterBand(m.band_id, '/')
    } catch (err) {
      if (err instanceof ApiError && err.key === 'already_member')
        setAlready(true)
      else showToast(errorText(err), 'error')
    }
  }

  const joinButton = isMember ? (
    <Button
      variant="primary"
      size={desktop ? 'xl' : 'lg'}
      fullWidth
      onClick={() =>
        existing ? enterBand(existing.id, '/band') : navigate('/')
      }
      data-testid="join-open-band"
    >
      Open {preview.name}
    </Button>
  ) : (
    <Button
      variant="primary"
      size={desktop ? 'xl' : 'lg'}
      fullWidth
      onClick={doJoin}
      disabled={join.isPending}
      data-testid="join-band-button"
    >
      {join.isPending ? 'Joining…' : `Join ${preview.name}`}
    </Button>
  )

  return (
    <div
      data-testid="join-preview-page"
      className="max-w-[420px] md:mx-auto pb-28"
    >
      {crumb}
      <div className="flex flex-col items-center text-center gap-2 pt-4">
        <span
          className="font-mono text-[11px] tracking-[.12em] uppercase text-ink-3"
          data-testid={isMember ? 'join-already-member' : 'join-invited'}
        >
          {isMember ? "You're already in" : "You're invited to"}
        </span>
        <BandMark
          name={preview.name}
          mark={preview.mark as BandMarkValue | null}
          size={desktop ? 96 : 84}
          className="my-1"
        />
        <h1
          className="font-display font-extrabold uppercase text-[44px] leading-[.9] text-ink-1"
          data-testid="join-band-name"
        >
          {preview.name}
        </h1>
        {preview.description && (
          <p
            className="text-[15px] text-ink-2 max-w-[300px]"
            data-testid="join-band-description"
          >
            {preview.description}
          </p>
        )}
        {names.length > 0 && (
          <div className="flex mt-1.5">
            {names.slice(0, 6).map((n, i) => (
              <span
                key={`${n}-${i}`}
                className={`rounded-full ring-2 ring-bg-1 ${i ? '-ml-2' : ''}`}
              >
                <Avatar size="md" label={n} />
              </span>
            ))}
          </div>
        )}
        <span
          className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-3"
          data-testid="join-band-meta"
        >
          {names.length > 0 ? `${names.join(', ')} · ` : ''}
          {songs} song{songs === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex flex-col items-center gap-1.5 mt-8">
        {desktop ? joinButton : <DockAction>{joinButton}</DockAction>}
        {!isMember && (
          <Button
            variant="text"
            onClick={() => navigate('/')}
            data-testid="join-not-now"
          >
            Not now
          </Button>
        )}
      </div>
    </div>
  )
}

export default JoinBandPage
