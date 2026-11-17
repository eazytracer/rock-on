/**
 * The show page (`/shows/:showId`, `/shows/new`). New show is this page
 * blank (FP 4): the first field saved creates it and the URL follows.
 */
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ShowDetail } from '../components/calendar/ShowDetail'
import { calendarBackTo } from '../hooks/useCalendar'

export const ShowViewPage: React.FC = () => {
  const { showId } = useParams<{ showId: string }>()
  const navigate = useNavigate()
  const { currentBandId } = useAuth()
  const back = () => navigate(calendarBackTo('/calendar?type=show'))

  return (
    <div data-testid="show-view-page" className="max-w-[720px] pb-44 md:pb-10">
      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1 h-9 pl-2 pr-3.5 mb-4 rounded-full bg-bg-2 text-[14px] font-semibold text-ink-1"
        data-testid="show-back"
      >
        <ChevronLeft size={17} /> Calendar
      </button>
      <ShowDetail
        key={showId ?? 'new'}
        showId={showId ?? null}
        bandId={currentBandId ?? ''}
        variant="page"
        onCreated={id => navigate(`/shows/${id}`, { replace: true })}
        onGone={back}
      />
    </div>
  )
}

export default ShowViewPage
