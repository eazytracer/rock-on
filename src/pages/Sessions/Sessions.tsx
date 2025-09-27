import React, { useState, useEffect } from 'react'
import { PracticeSession } from '../../models/PracticeSession'
import { Song } from '../../models/Song'
import { Member } from '../../models/Member'
import { SessionForm } from '../../components/sessions/SessionForm'
import { PracticeTimer } from '../../components/sessions/PracticeTimer'
import { TouchButton } from '../../components/common/TouchButton'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

interface SessionsProps {
  sessions: PracticeSession[]
  songs: Song[]
  members: Member[]
  loading?: boolean
  onCreateSession?: (sessionData: any) => Promise<void>
  onEditSession?: (sessionId: string, sessionData: any) => Promise<void>
  onDeleteSession?: (sessionId: string) => Promise<void>
  onStartSession?: (sessionId: string) => Promise<void>
  onBack?: () => void
}

type ViewMode = 'list' | 'calendar' | 'add' | 'edit' | 'session'

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  sessions: PracticeSession[]
}

export const Sessions: React.FC<SessionsProps> = ({
  sessions,
  songs,
  members,
  loading = false,
  onCreateSession,
  onEditSession,
  onDeleteSession,
  onStartSession,
  onBack
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedSession, setSelectedSession] = useState<PracticeSession | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])

  useEffect(() => {
    generateCalendarDays()
  }, [currentDate, sessions])

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()))

    const days: CalendarDay[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const dayStart = new Date(current)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(current)
      dayEnd.setHours(23, 59, 59, 999)

      const daySessions = sessions.filter(session => {
        const sessionDate = new Date(session.scheduledDate)
        return sessionDate >= dayStart && sessionDate <= dayEnd
      })

      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        sessions: daySessions
      })

      current.setDate(current.getDate() + 1)
    }

    setCalendarDays(days)
  }

  const handleCreateSession = async (sessionData: any) => {
    if (!onCreateSession) return

    setIsSubmitting(true)
    try {
      await onCreateSession(sessionData)
      setViewMode('list')
    } catch (error) {
      console.error('Failed to create session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSession = async (sessionData: any) => {
    if (!onEditSession || !selectedSession) return

    setIsSubmitting(true)
    try {
      await onEditSession(selectedSession.id, sessionData)
      setViewMode('list')
      setSelectedSession(null)
    } catch (error) {
      console.error('Failed to edit session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSession = async (session: PracticeSession) => {
    if (!onDeleteSession) return

    const confirmed = window.confirm('Are you sure you want to delete this practice session?')
    if (!confirmed) return

    try {
      await onDeleteSession(session.id)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const handleSessionEdit = (session: PracticeSession) => {
    setSelectedSession(session)
    setViewMode('edit')
  }

  const handleSessionStart = async (session: PracticeSession) => {
    if (!onStartSession) return

    try {
      await onStartSession(session.id)
      setSelectedSession(session)
      setViewMode('session')
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  const handleCancel = () => {
    setViewMode('list')
    setSelectedSession(null)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date)
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'in-progress': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getUpcomingSessions = () => {
    const now = new Date()
    return sessions
      .filter(session => new Date(session.scheduledDate) > now && session.status === 'scheduled')
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, 5)
  }

  const getRecentSessions = () => {
    const now = new Date()
    return sessions
      .filter(session => new Date(session.scheduledDate) <= now)
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      .slice(0, 5)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentDate(newDate)
  }

  if (viewMode === 'add') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="mr-4"
          >
            ← Back
          </TouchButton>
          <h1 className="text-2xl font-bold text-steel-gray">Schedule Practice Session</h1>
        </div>
        <SessionForm
          onSubmit={handleCreateSession}
          onCancel={handleCancel}
          songs={songs}
          members={members}
          loading={isSubmitting}
        />
      </div>
    )
  }

  if (viewMode === 'edit' && selectedSession) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="mr-4"
          >
            ← Back
          </TouchButton>
          <h1 className="text-2xl font-bold text-steel-gray">Edit Practice Session</h1>
        </div>
        <SessionForm
          onSubmit={handleEditSession}
          onCancel={handleCancel}
          songs={songs}
          members={members}
          initialData={selectedSession}
          loading={isSubmitting}
        />
      </div>
    )
  }

  if (viewMode === 'session' && selectedSession) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="mr-4"
          >
            ← Back
          </TouchButton>
          <div>
            <h1 className="text-2xl font-bold text-steel-gray">Practice Session</h1>
            <p className="text-gray-600">{formatDate(selectedSession.scheduledDate)}</p>
          </div>
        </div>
        <PracticeTimer />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          {onBack && (
            <TouchButton
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-4"
            >
              ← Back
            </TouchButton>
          )}
          <div>
            <h1 className="text-2xl font-bold text-steel-gray">Practice Sessions</h1>
            <p className="text-gray-600">Schedule and manage your band's practice sessions</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <TouchButton
            variant="secondary"
            size="md"
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
          >
            {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
          </TouchButton>
          <TouchButton
            variant="primary"
            size="md"
            onClick={() => setViewMode('add')}
          >
            Schedule Session
          </TouchButton>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="px-6 py-4 border-b border-steel-gray/20 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-steel-gray">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex space-x-2">
              <TouchButton variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
                ←
              </TouchButton>
              <TouchButton variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </TouchButton>
              <TouchButton variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
                →
              </TouchButton>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-700">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`min-h-[100px] p-2 border border-gray-100 ${
                    !day.isCurrentMonth ? 'bg-surface text-gray-400' : 'bg-smoke-white'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {day.sessions.slice(0, 2).map(session => (
                      <div
                        key={session.id}
                        className="text-xs p-1 rounded bg-blue-100 text-blue-800 truncate cursor-pointer hover:bg-blue-200"
                        onClick={() => {
                          setSelectedSession(session)
                          setViewMode('session')
                        }}
                      >
                        {formatTime(session.scheduledDate)}
                      </div>
                    ))}
                    {day.sessions.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{day.sessions.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Sessions */}
          <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
            <div className="px-6 py-4 border-b border-steel-gray/20">
              <h3 className="text-lg font-semibold text-steel-gray">Upcoming Sessions</h3>
            </div>
            <div className="p-6">
              {getUpcomingSessions().length > 0 ? (
                <div className="space-y-4">
                  {getUpcomingSessions().map(session => (
                    <div key={session.id} className="border border-steel-gray/20 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-steel-gray">
                            {formatDate(session.scheduledDate)}
                          </div>
                          {session.location && (
                            <div className="text-sm text-gray-600">📍 {session.location}</div>
                          )}
                          <div className="text-sm text-gray-600">
                            {session.duration} minutes • {session.type}
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </div>

                      {session.songs && session.songs.length > 0 && (
                        <div className="text-sm text-gray-600 mb-3">
                          {session.songs.length} songs planned
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          <TouchButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleSessionStart(session)}
                          >
                            Start Session
                          </TouchButton>
                          <TouchButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSessionEdit(session)}
                          >
                            Edit
                          </TouchButton>
                        </div>
                        <TouchButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSession(session)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </TouchButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-3">No upcoming sessions</div>
                  <TouchButton
                    variant="primary"
                    size="sm"
                    onClick={() => setViewMode('add')}
                  >
                    Schedule One
                  </TouchButton>
                </div>
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
            <div className="px-6 py-4 border-b border-steel-gray/20">
              <h3 className="text-lg font-semibold text-steel-gray">Recent Sessions</h3>
            </div>
            <div className="p-6">
              {getRecentSessions().length > 0 ? (
                <div className="space-y-4">
                  {getRecentSessions().map(session => (
                    <div key={session.id} className="border border-steel-gray/20 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-steel-gray">
                            {formatDate(session.scheduledDate)}
                          </div>
                          {session.location && (
                            <div className="text-sm text-gray-600">📍 {session.location}</div>
                          )}
                          <div className="text-sm text-gray-600">
                            {session.duration} minutes • {session.type}
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </div>

                      {session.sessionRating && (
                        <div className="text-sm text-gray-600 mb-2">
                          Rating: {session.sessionRating}/5 ⭐
                        </div>
                      )}

                      {session.notes && (
                        <div className="text-sm text-gray-600 italic">
                          "{session.notes}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500">No recent sessions</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {sessions.length === 0 && !loading && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4a1 1 0 01-1 1H9a1 1 0 01-1-1z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 7h14l-.868 8.682A3 3 0 0115.14 18H8.86a3 3 0 01-2.992-2.318L5 7z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-steel-gray">No practice sessions</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by scheduling your first practice session.
            </p>
            <div className="mt-6">
              <TouchButton
                variant="primary"
                size="lg"
                onClick={() => setViewMode('add')}
              >
                Schedule Your First Session
              </TouchButton>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && sessions.length === 0 && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="p-12">
            <LoadingSpinner size="lg" centered text="Loading sessions..." />
          </div>
        </div>
      )}
    </div>
  )
}