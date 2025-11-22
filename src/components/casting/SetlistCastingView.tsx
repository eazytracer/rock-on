/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react'
import { Setlist } from '../../models/Setlist'
import { Song } from '../../models/Song'
import { SongCastingEditor } from './SongCastingEditor'
import { TouchButton } from '../common/TouchButton'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { castingService } from '../../services/CastingService'

interface SetlistCastingViewProps {
  setlist: Setlist
  songs: Song[]
  bandMembers: Array<{ userId: string; name: string }>
  bandId: string
  onClose?: () => void
}

interface SongCastingStatus {
  songId: number
  hasCasting: boolean
  assignmentCount: number
  castingId?: number
}

export const SetlistCastingView: React.FC<SetlistCastingViewProps> = ({
  setlist,
  songs,
  bandMembers,
  bandId,
  onClose,
}) => {
  const [castingStatuses, setCastingStatuses] = useState<
    Record<number, SongCastingStatus>
  >({})
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    loadCastingStatuses()
  }, [setlist.id])

  const loadCastingStatuses = async () => {
    setLoading(true)
    try {
      const allCastings = await castingService.getCastingsForContext(
        'setlist',
        setlist.id
      )

      const statuses: Record<number, SongCastingStatus> = {}

      for (const song of getSetlistSongs()) {
        if (!song.id) continue

        const songIdNum = parseInt(song.id, 10)
        const casting = allCastings.find((c: any) => c.songId === songIdNum)

        if (casting && casting.id) {
          const assignments = await castingService.getAssignments(casting.id)
          statuses[songIdNum] = {
            songId: songIdNum,
            hasCasting: true,
            assignmentCount: assignments.length,
            castingId: casting.id,
          }
        } else {
          statuses[songIdNum] = {
            songId: songIdNum,
            hasCasting: false,
            assignmentCount: 0,
          }
        }
      }

      setCastingStatuses(statuses)
    } catch (error) {
      console.error('Failed to load casting statuses:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSetlistSongs = (): Song[] => {
    return (setlist.songs || [])
      .map(ss => songs.find(s => s.id === ss.songId))
      .filter(Boolean) as Song[]
  }

  const handleCastingUpdated = () => {
    loadCastingStatuses()
  }

  const handleCopyFromSetlist = async () => {
    // TODO: Implement UI to select another setlist and copy casting
    alert('Copy from setlist feature coming soon!')
  }

  const handleClearAllCasting = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to clear all casting for "${setlist.name}"? This action cannot be undone.`
    )
    if (!confirmed) return

    setCopying(true)
    try {
      // Get all castings and delete them
      const castings = await castingService.getCastingsForContext(
        'setlist',
        setlist.id
      )
      for (const casting of castings) {
        if (casting.id) {
          await castingService.deleteCasting(casting.id)
        }
      }
      await loadCastingStatuses()
    } catch (error) {
      console.error('Failed to clear casting:', error)
      alert('Failed to clear casting')
    } finally {
      setCopying(false)
    }
  }

  const getCastingCompletionPercentage = (): number => {
    const totalSongs = Object.keys(castingStatuses).length
    if (totalSongs === 0) return 0

    const songsWithCasting = Object.values(castingStatuses).filter(
      s => s.hasCasting
    ).length
    return Math.round((songsWithCasting / totalSongs) * 100)
  }

  const getTotalAssignments = (): number => {
    return Object.values(castingStatuses).reduce(
      (sum, s) => sum + s.assignmentCount,
      0
    )
  }

  // Show song casting editor if a song is selected
  if (selectedSongId !== null) {
    const song = songs.find(s => parseInt(s.id, 10) === selectedSongId)
    if (!song) {
      setSelectedSongId(null)
      return null
    }

    return (
      <div className="max-w-4xl mx-auto">
        <SongCastingEditor
          song={song}
          bandMembers={bandMembers}
          bandId={bandId}
          contextType="setlist"
          contextId={setlist.id}
          onSave={handleCastingUpdated}
          onClose={() => setSelectedSongId(null)}
        />
      </div>
    )
  }

  // Show setlist overview
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">
                Casting: {setlist.name}
              </h2>
              {setlist.status && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    setlist.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : setlist.status === 'archived'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {setlist.status}
                </span>
              )}
            </div>
            {setlist.venue && (
              <p className="text-sm text-gray-600">📍 {setlist.venue}</p>
            )}
            {setlist.showDate && (
              <p className="text-sm text-gray-600">
                📅 {new Date(setlist.showDate).toLocaleDateString()}
              </p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Casting Summary */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Object.keys(castingStatuses).length}
            </div>
            <div className="text-sm text-gray-600">Total Songs</div>
          </div>
          <div className="text-center">
            <div
              className={`text-2xl font-bold ${
                getCastingCompletionPercentage() >= 100
                  ? 'text-green-600'
                  : getCastingCompletionPercentage() >= 50
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
            >
              {getCastingCompletionPercentage()}%
            </div>
            <div className="text-sm text-gray-600">Casting Complete</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {getTotalAssignments()}
            </div>
            <div className="text-sm text-gray-600">Total Assignments</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                getCastingCompletionPercentage() >= 100
                  ? 'bg-green-600'
                  : getCastingCompletionPercentage() >= 50
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
              }`}
              style={{ width: `${getCastingCompletionPercentage()}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-2">
          <TouchButton
            variant="secondary"
            size="sm"
            onClick={handleCopyFromSetlist}
            loading={copying}
          >
            Copy from Setlist
          </TouchButton>
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={handleClearAllCasting}
            loading={copying}
            className="text-red-600 hover:text-red-800"
          >
            Clear All
          </TouchButton>
        </div>
      </div>

      {/* Song List */}
      <div className="p-6">
        {loading ? (
          <div className="py-12">
            <LoadingSpinner
              size="lg"
              centered
              text="Loading casting information..."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {getSetlistSongs().map((song, index) => {
              if (!song.id) return null

              const songIdNum = parseInt(song.id, 10)
              const status = castingStatuses[songIdNum]

              return (
                <div
                  key={song.id}
                  className={`p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                    status?.hasCasting
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setSelectedSongId(songIdNum)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      {/* Song Order */}
                      <div className="flex-shrink-0 w-8 text-center">
                        <span className="text-sm font-medium text-gray-500">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Song Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {song.title}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          {song.artist}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                            {song.key}
                          </span>
                          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                            {song.bpm} BPM
                          </span>
                          {song.guitarTuning && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {song.guitarTuning}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Casting Status */}
                      <div className="flex-shrink-0">
                        {status?.hasCasting ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-green-700">
                              {status.assignmentCount}{' '}
                              {status.assignmentCount === 1
                                ? 'member'
                                : 'members'}
                            </span>
                            <svg
                              className="w-5 h-5 text-green-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              Not assigned
                            </span>
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Edit Button */}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedSongId(songIdNum)
                        }}
                        className="flex-shrink-0 p-2 text-blue-600 hover:text-blue-800 transition-colors rounded-lg hover:bg-blue-50"
                        aria-label="Edit casting"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {getSetlistSongs().length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                <p>No songs in this setlist</p>
                <p className="text-sm mt-1">
                  Add songs to the setlist before assigning roles
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
