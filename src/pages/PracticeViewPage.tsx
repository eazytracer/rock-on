/**
 * The practice page (`/practices/:practiceId`). Editing time, place and songs
 * happens in the practice editor (`/practices/new`, `/:id/edit`).
 */
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { PracticeDetail } from '../components/calendar/PracticeDetail'

export const PracticeViewPage: React.FC = () => {
  const { practiceId = '' } = useParams<{ practiceId: string }>()
  const navigate = useNavigate()
  const back = () => navigate('/calendar?type=practice')

  return (
    <div
      data-testid="practice-view-page"
      className="max-w-[720px] pb-44 md:pb-10"
    >
      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1 h-9 pl-2 pr-3.5 mb-4 rounded-full bg-bg-2 text-[14px] font-semibold text-ink-1"
        data-testid="practice-back"
      >
        <ChevronLeft size={17} /> Calendar
      </button>
      <PracticeDetail
        key={practiceId}
        practiceId={practiceId}
        variant="page"
        onGone={back}
      />
    </div>
  )
}

export default PracticeViewPage
