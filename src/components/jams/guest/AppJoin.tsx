/**
 * `/j/:code` for a signed-in visitor on a jam code: the preview (name, when,
 * where, host, people), a big Join, then the parts you play (from your
 * profile's instruments, in order), then your jam songs: share them, or pick
 * some first (the Jam songs builder) or skip. join_jam → `/jam/:id`.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Music, PartyPopper } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../contexts/ToastContext'
import { useJamAction, useJamPreview } from '../../../hooks/useJam'
import * as jams from '../../../services/api/jams'
import type { Part } from '../../../services/api/jams'
import { errorText } from '../../../services/api/errors'
import { Button, Empty, Switch } from '../../ui'
import { DockAction } from '../../layout/PhoneDock'
import { BackCrumb } from '../../layout/MobileHeader'
import { CodeRefusal } from './CodeRefusal'
import { JamHeader } from './JamHeader'
import { JAM_ENDED, isEnded } from './helpers'
import { PartPicker } from './PartPicker'
import { partsFromInstruments } from './parts'

type Step = 'preview' | 'parts' | 'songs'

const label =
  'block font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 mb-2'

export const AppJoin: React.FC<{ code: string }> = ({ code }) => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user, currentUserProfile } = useAuth()
  const preview = useJamPreview(code)
  const [step, setStep] = useState<Step>('preview')
  const [parts, setParts] = useState<Part[]>([])
  const [share, setShare] = useState(true)
  const jamSongs = useQuery({
    queryKey: ['jams', 'my-jam-songs', user?.id ?? ''],
    queryFn: () => jams.myJamSongCount(user!.id),
    enabled: !!user && step !== 'preview',
  })
  const join = useJamAction((v: { parts: Part[]; share: boolean }) =>
    jams.joinJam(code, v.parts, v.share)
  )

  // Parts default from the profile once it's loaded.
  const instruments = currentUserProfile?.instruments
  useEffect(() => {
    setParts(partsFromInstruments(instruments ?? []))
  }, [instruments])

  const back = () =>
    step === 'songs'
      ? setStep('parts')
      : step === 'parts'
        ? setStep('preview')
        : window.history.length > 1
          ? navigate(-1)
          : navigate('/jam')

  const crumb = (
    <BackCrumb
      label="Back"
      onClick={back}
      className="mb-4"
      data-testid="jam-join-back"
    />
  )

  if (preview.isLoading) {
    return (
      <div data-testid="jam-join-page" className="max-w-[420px] md:mx-auto">
        {crumb}
        <div className="flex flex-col gap-3 pt-6" aria-busy>
          <span className="w-40 h-3 rounded bg-bg-3 animate-pulse" />
          <span className="w-64 h-9 rounded-lg bg-bg-3 animate-pulse" />
        </div>
      </div>
    )
  }
  const p = preview.data
  if (preview.error || !p) {
    return (
      <div data-testid="jam-join-page" className="max-w-[420px] md:mx-auto">
        {crumb}
        <CodeRefusal
          error={preview.error}
          onRetry={() => preview.refetch()}
          onEnterCode={() => navigate('/j')}
        />
      </div>
    )
  }

  const eventId = p.event_id as string
  const open = () => navigate(`/jam/${eventId}`)
  const doJoin = async (then: string) => {
    try {
      await join.mutateAsync({ parts, share })
      navigate(then)
    } catch (err) {
      showToast(errorText(err), 'error')
    }
  }
  const people = p.people_count ?? 0

  const header = (
    <>
      <JamHeader
        name={p.name ?? ''}
        status={p.status}
        at={p.scheduled_date}
        venue={p.venue}
      />
      <p className="text-[15px] text-ink-2 mt-2" data-testid="jam-preview-meta">
        {p.host_first_name ? `Hosted by ${p.host_first_name}` : ''}
        {p.host_first_name ? ' · ' : ''}
        {people} {people === 1 ? 'person' : 'people'} in
      </p>
    </>
  )

  if (isEnded(p.status) && !p.is_participant) {
    return (
      <div data-testid="jam-join-page" className="max-w-[420px] md:mx-auto">
        {crumb}
        <Empty
          icon={<PartyPopper size={26} />}
          title={JAM_ENDED}
          why="Catch the next one."
          data-testid="jam-join-ended"
        />
      </div>
    )
  }

  const action = (button: React.ReactNode) => (
    <div className="mt-8">
      <DockAction>{button}</DockAction>
    </div>
  )

  if (step === 'preview') {
    return (
      <div
        data-testid="jam-join-page"
        className="max-w-[420px] md:mx-auto pb-28"
      >
        {crumb}
        {header}
        {action(
          p.is_participant ? (
            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={open}
              data-testid="jam-join-open"
            >
              Open jam
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => setStep('parts')}
              data-testid="jam-join-button"
            >
              Join
            </Button>
          )
        )}
      </div>
    )
  }

  if (step === 'parts') {
    return (
      <div
        data-testid="jam-join-page"
        className="max-w-[420px] md:mx-auto pb-28"
      >
        {crumb}
        {header}
        <div className="mt-6">
          <span className={label}>Parts you play</span>
          <PartPicker
            value={parts}
            onChange={setParts}
            listening
            testid="jam-join-parts"
          />
          <p className="text-[13px] text-ink-3 mt-2">
            The host sees these. You can change them later.
          </p>
        </div>
        {action(
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<ArrowRight size={18} />}
            onClick={() => setStep('songs')}
            data-testid="jam-join-parts-next"
          >
            Next
          </Button>
        )}
      </div>
    )
  }

  const count = jamSongs.data ?? 0
  return (
    <div data-testid="jam-join-page" className="max-w-[420px] md:mx-auto pb-28">
      {crumb}
      {header}
      <div className="mt-6" data-testid="jam-join-songs">
        <span className={label}>Share your jam songs</span>
        {jamSongs.isLoading ? (
          <div className="h-16 rounded-2xl bg-bg-3 animate-pulse" aria-busy />
        ) : count > 0 ? (
          <div className="flex items-center gap-3 rounded-[20px] bg-bg-2 shadow-group px-4 py-3">
            <Music size={20} className="text-ink-3 shrink-0" />
            <span className="flex-1">
              <b className="block text-[15px] text-ink-1">
                Share my {count} jam song{count === 1 ? '' : 's'}
              </b>
              <small className="text-[13px] text-ink-3">
                People here see which songs you have in common.
              </small>
            </span>
            <Switch
              label="Share my jam songs"
              checked={share}
              onChange={setShare}
              data-testid="jam-join-share-switch"
            />
          </div>
        ) : (
          <p className="text-[15px] text-ink-2" data-testid="jam-join-no-songs">
            Tag the songs you'd jam on and people here can see which ones you
            have in common.
          </p>
        )}
      </div>
      {action(
        count > 0 || jamSongs.isLoading ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={join.isPending || jamSongs.isLoading}
            onClick={() => doJoin(`/jam/${eventId}`)}
            data-testid="jam-join-confirm"
          >
            {join.isPending ? 'Joining…' : 'Join'}
          </Button>
        ) : (
          <div className="flex flex-col gap-1.5 w-full">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={join.isPending}
              onClick={() =>
                doJoin(
                  `/jam/songs?returnTo=${encodeURIComponent(`/jam/${eventId}`)}`
                )
              }
              data-testid="jam-join-pick-songs"
            >
              Pick your jam songs
            </Button>
            <Button
              variant="text"
              disabled={join.isPending}
              onClick={() => doJoin(`/jam/${eventId}`)}
              data-testid="jam-join-skip"
            >
              Skip
            </Button>
          </div>
        )
      )}
    </div>
  )
}
