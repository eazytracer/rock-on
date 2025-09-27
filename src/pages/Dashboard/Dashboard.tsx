import React, { useState, useEffect } from 'react'
import { Song } from '../../models/Song'
import { PracticeSession } from '../../models/PracticeSession'
import { Setlist } from '../../models/Setlist'
import { Member } from '../../models/Member'
import { TouchButton } from '../../components/common/TouchButton'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PracticeTimer } from '../../components/sessions/PracticeTimer'

interface DashboardProps {
  songs: Song[]
  sessions: PracticeSession[]
  setlists: Setlist[]
  members: Member[]
  loading?: boolean
  onAddSong?: () => void
  onScheduleSession?: () => void
  onCreateSetlist?: () => void
  onStartPractice?: (sessionId?: string) => void
  onViewSongs?: () => void
  onViewSessions?: () => void
  onViewSetlists?: () => void
}

interface QuickStats {
  totalSongs: number
  practicedThisWeek: number
  upcomingSessions: number
  readySetlists: number
  averageConfidence: number
}

export const Dashboard: React.FC<DashboardProps> = ({
  songs,
  sessions,
  setlists,
  loading = false,
  onAddSong,
  onScheduleSession,
  onCreateSetlist,
  onStartPractice,
  onViewSongs,
  onViewSessions,
  onViewSetlists
}) => {
  const [quickStats, setQuickStats] = useState<QuickStats>({
    totalSongs: 0,
    practicedThisWeek: 0,
    upcomingSessions: 0,
    readySetlists: 0,
    averageConfidence: 0
  })

  const [activePracticeSession, setActivePracticeSession] = useState<PracticeSession | null>(null)

  useEffect(() => {
    calculateQuickStats()
    findActivePracticeSession()
  }, [songs, sessions, setlists])

  const calculateQuickStats = () => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const practicedThisWeek = songs.filter(song =>
      song.lastPracticed && new Date(song.lastPracticed) >= weekAgo
    ).length

    const upcomingSessions = sessions.filter(session =>
      session.scheduledDate > now && session.status === 'scheduled'
    ).length

    const readySetlists = setlists.filter(setlist =>
      setlist.songs.every(setlistSong => {
        const song = songs.find(s => s.id === setlistSong.songId)
        return song && song.confidenceLevel >= 4
      })
    ).length

    const averageConfidence = songs.length > 0
      ? songs.reduce((sum, song) => sum + song.confidenceLevel, 0) / songs.length
      : 0

    setQuickStats({
      totalSongs: songs.length,
      practicedThisWeek,
      upcomingSessions,
      readySetlists,
      averageConfidence
    })
  }

  const findActivePracticeSession = () => {
    const active = sessions.find(session => session.status === 'in-progress')
    setActivePracticeSession(active || null)
  }

  const getRecentSongs = () => {
    return songs
      .filter(song => song.lastPracticed)
      .sort((a, b) => new Date(b.lastPracticed!).getTime() - new Date(a.lastPracticed!).getTime())
      .slice(0, 3)
  }

  const getNextSession = () => {
    const now = new Date()
    return sessions
      .filter(session => session.scheduledDate > now && session.status === 'scheduled')
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0]
  }

  const getSongsNeedingPractice = () => {
    return songs
      .filter(song => song.confidenceLevel < 3)
      .sort((a, b) => a.confidenceLevel - b.confidenceLevel)
      .slice(0, 3)
  }

  const getUpcomingShows = () => {
    const now = new Date()
    return setlists
      .filter(setlist => setlist.showDate && new Date(setlist.showDate) > now)
      .sort((a, b) => new Date(a.showDate!).getTime() - new Date(b.showDate!).getTime())
      .slice(0, 2)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const formatRelativeDate = (date: Date) => {
    const now = new Date()
    const diffMs = new Date(date).getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays < 7) return `In ${diffDays} days`
    return formatDate(date)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <LoadingSpinner size="lg" centered text="Loading dashboard..." />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your band.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <TouchButton variant="secondary" size="md" onClick={onAddSong}>
            Add Song
          </TouchButton>
          <TouchButton variant="primary" size="md" onClick={onScheduleSession}>
            Schedule Practice
          </TouchButton>
        </div>
      </div>

      {/* Active Practice Session */}
      {activePracticeSession && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-blue-900">Active Practice Session</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              In Progress
            </span>
          </div>
          <PracticeTimer compact />
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{quickStats.totalSongs}</div>
          <div className="text-sm text-gray-600">Total Songs</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{quickStats.practicedThisWeek}</div>
          <div className="text-sm text-gray-600">Practiced This Week</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{quickStats.upcomingSessions}</div>
          <div className="text-sm text-gray-600">Upcoming Sessions</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-purple-600">{quickStats.readySetlists}</div>
          <div className="text-sm text-gray-600">Ready Setlists</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {quickStats.averageConfidence.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600">Avg Confidence</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Session */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Next Session</h3>
              <TouchButton variant="ghost" size="sm" onClick={onViewSessions}>
                View All
              </TouchButton>
            </div>
          </div>
          <div className="p-6">
            {getNextSession() ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatRelativeDate(getNextSession()!.scheduledDate)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(getNextSession()!.scheduledDate)}
                  </div>
                </div>
                {getNextSession()!.location && (
                  <div className="text-sm text-gray-600">
                    📍 {getNextSession()!.location}
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  {getNextSession()!.duration} minutes • {getNextSession()!.type}
                </div>
                <TouchButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => onStartPractice?.(getNextSession()!.id)}
                >
                  Start Early
                </TouchButton>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-gray-500 mb-3">No upcoming sessions</div>
                <TouchButton variant="primary" size="sm" onClick={onScheduleSession}>
                  Schedule One
                </TouchButton>
              </div>
            )}
          </div>
        </div>

        {/* Recently Practiced */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recently Practiced</h3>
              <TouchButton variant="ghost" size="sm" onClick={onViewSongs}>
                View All
              </TouchButton>
            </div>
          </div>
          <div className="p-6">
            {getRecentSongs().length > 0 ? (
              <div className="space-y-3">
                {getRecentSongs().map(song => (
                  <div key={song.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{song.title}</div>
                      <div className="text-xs text-gray-600">{song.artist}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {song.lastPracticed && formatRelativeDate(song.lastPracticed)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-gray-500 mb-3">No recent practice</div>
                <TouchButton variant="primary" size="sm" onClick={() => onStartPractice?.()}>
                  Start Practicing
                </TouchButton>
              </div>
            )}
          </div>
        </div>

        {/* Needs Practice */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Needs Practice</h3>
              <TouchButton variant="ghost" size="sm" onClick={onViewSongs}>
                View All
              </TouchButton>
            </div>
          </div>
          <div className="p-6">
            {getSongsNeedingPractice().length > 0 ? (
              <div className="space-y-3">
                {getSongsNeedingPractice().map(song => (
                  <div key={song.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{song.title}</div>
                      <div className="text-xs text-gray-600">{song.artist}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        song.confidenceLevel >= 2 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {song.confidenceLevel >= 2 ? 'Practice' : 'New'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-green-600 mb-2">🎉</div>
                <div className="text-gray-900 font-medium text-sm">All songs ready!</div>
                <div className="text-gray-500 text-xs">Great job practicing</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Shows */}
      {getUpcomingShows().length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Shows</h3>
              <TouchButton variant="ghost" size="sm" onClick={onViewSetlists}>
                View All Setlists
              </TouchButton>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getUpcomingShows().map(setlist => (
                <div key={setlist.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{setlist.name}</h4>
                      {setlist.venue && (
                        <p className="text-sm text-gray-600">📍 {setlist.venue}</p>
                      )}
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {formatRelativeDate(setlist.showDate!)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    {setlist.songs.length} songs
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {setlist.status === 'performed' ? 'Performed' :
                       setlist.status === 'rehearsed' ? 'Rehearsed' : 'Draft'}
                    </div>
                    <TouchButton variant="ghost" size="sm">
                      View Setlist
                    </TouchButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TouchButton variant="primary" size="lg" onClick={() => onStartPractice?.()}>
            <div className="text-center">
              <div className="text-lg mb-1">🎵</div>
              <div>Start Practice</div>
            </div>
          </TouchButton>

          <TouchButton variant="secondary" size="lg" onClick={onCreateSetlist}>
            <div className="text-center">
              <div className="text-lg mb-1">📝</div>
              <div>Create Setlist</div>
            </div>
          </TouchButton>

          <TouchButton variant="secondary" size="lg" onClick={onAddSong}>
            <div className="text-center">
              <div className="text-lg mb-1">➕</div>
              <div>Add Song</div>
            </div>
          </TouchButton>
        </div>
      </div>
    </div>
  )
}