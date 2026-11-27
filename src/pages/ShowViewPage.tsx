/**
 * The show page (`/shows/:showId`, `/shows/new`). New show is this page
 * blank (FP 4): the first field saved creates it and the URL follows.
 */
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackCrumb } from '../components/layout/MobileHeader'
import { useAuth } from '../contexts/AuthContext'
import { ShowDetail } from '../components/calendar/ShowDetail'
import { calendarBackTo } from '../hooks/useCalendar'

export const ShowViewPage: React.FC = () => {
  const { showId } = useParams<{ showId: string }>()
  const navigate = useNavigate()
  const { currentBandId } = useAuth()
  const back = () => navigate(calendarBackTo('/calendar?type=show'))

  return (
    <div data-testid="show-view-page" className="max-w-[720px] md:pb-10">
      <BackCrumb
        label="Calendar"
        onClick={back}
        className="mb-4"
        data-testid="show-back"
      />
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
