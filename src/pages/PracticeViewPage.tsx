/**
 * The practice page (`/practices/:practiceId`, `/practices/new`): everything
 * edits in place (PracticeDetail). Add songs (`?add=1`) opens the song drawer
 * (full screen on phones); adding to a new practice creates it.
 */
import React, { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { BandRequiredPrompt } from '../components/common/BandRequiredPrompt'
import { PracticeDetail } from '../components/calendar/PracticeDetail'
import { SongBrowser } from '../components/setlists/SongBrowser'
import {
  calendarBackTo,
  createPractice,
  usePracticePage,
} from '../hooks/useCalendar'
import { useSetlistIndex } from '../hooks/useSetlists'
import {
  defaultPracticeDate,
  freshPracticeSong,
  practiceTitle,
} from '../domain/calendar'
import { createLogger } from '../utils/logger'

const log = createLogger('PracticeViewPage')

export const PracticeViewPage: React.FC = () => {
  const { practiceId } = useParams<{ practiceId: string }>()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { currentBand, currentBandId, currentUser } = useAuth()
  const bandId = currentBandId ?? ''
  const { practice, save } = usePracticePage(practiceId ?? null)
  const { rows: sets } = useSetlistIndex('band', bandId)
  const back = () => navigate(calendarBackTo('/calendar?type=practice'))

  const browsing = params.get('add') === '1'
  const setBrowsing = (on: boolean) => {
    const next = new URLSearchParams(params)
    if (on) next.set('add', '1')
    else next.delete('add')
    setParams(next, { replace: true })
  }
  const songs = useMemo(() => practice?.songs ?? [], [practice?.songs])
  const inSet = useMemo(() => new Set(songs.map(s => s.songId)), [songs])

  if (!currentBandId)
    return (
      <BandRequiredPrompt
        feature="Practices"
        testid="practices-band-required"
      />
    )

  const addSongs = async (ids: string[]) => {
    const added = ids
      .filter(id => !inSet.has(id))
      .map(id => freshPracticeSong(id))
    try {
      if (practiceId) await save({ songs: [...songs, ...added] })
      else {
        const id = await createPractice(bandId, currentUser?.id, {
          scheduledDate: defaultPracticeDate(new Date()),
          songs: added,
        })
        void queryClient.invalidateQueries({ queryKey: ['calendar'] })
        navigate(`/practices/${id}?add=1`, { replace: true })
      }
      return true
    } catch (err) {
      log.error('Add songs failed', err)
      showToast("Couldn't add them. Try again.", 'error')
      return false
    }
  }

  const removeSong = async (id: string) => {
    try {
      await save({ songs: songs.filter(s => s.songId !== id) })
      return true
    } catch (err) {
      log.error('Remove song failed', err)
      showToast("Couldn't remove it. Try again.", 'error')
      return false
    }
  }

  const browser = (
    <SongBrowser
      setName={
        practice
          ? practiceTitle(practice.name, new Date(practice.scheduledDate))
          : 'New practice'
      }
      contextType="band"
      contextId={bandId}
      userId={currentUser?.id ?? ''}
      catalogName={currentBand?.name ?? 'band'}
      inSet={inSet}
      otherSets={sets}
      withMine={false}
      onAdd={addSongs}
      onRemove={removeSong}
      onClose={() => setBrowsing(false)}
    />
  )

  const detail = (
    <PracticeDetail
      key={practiceId ?? 'new'}
      practiceId={practiceId ?? null}
      bandId={bandId}
      variant="page"
      onCreated={id =>
        navigate(`/practices/${id}${browsing ? '?add=1' : ''}`, {
          replace: true,
        })
      }
      onGone={back}
      onAddSongs={() => setBrowsing(true)}
    />
  )

  return (
    <div data-testid="practice-view-page" className="pb-44 md:pb-10">
      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1 h-9 pl-2 pr-3.5 mb-4 rounded-full bg-bg-2 text-[14px] font-semibold text-ink-1"
        data-testid="practice-back"
      >
        <ChevronLeft size={17} /> Calendar
      </button>
      {detail}
      {browsing && browser}
    </div>
  )
}

export default PracticeViewPage
