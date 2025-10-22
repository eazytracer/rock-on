import React, { useState } from 'react'
import { Setlist } from '../../models/Setlist'
import { Song } from '../../models/Song'
import { SetlistSong } from '../../types'
import { SetlistBuilder } from '../../components/setlists/SetlistBuilder'
import { TouchButton } from '../../components/common/TouchButton'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { SearchBar } from '../../components/common/SearchBar'
import { SetlistCastingView } from '../../components/casting/SetlistCastingView'
import { CastingComparison } from '../../components/casting/CastingComparison'

interface SetlistsProps {
  setlists: Setlist[]
  songs: Song[]
  bandMembers?: Array<{ userId: string; name: string }>
  bandId?: string
  loading?: boolean
  onCreateSetlist?: (setlistData: {
    name: string
    songs: SetlistSong[]
    showDate?: Date
    venue?: string
    notes?: string
  }) => Promise<void>
  onEditSetlist?: (setlistId: string, setlistData: Partial<Setlist>) => Promise<void>
  onDeleteSetlist?: (setlistId: string) => Promise<void>
  onDuplicateSetlist?: (setlistId: string) => Promise<void>
  onSetlistClick?: (setlist: Setlist) => void
  onBack?: () => void
}

type ViewMode = 'list' | 'add' | 'edit' | 'readiness' | 'casting' | 'compare'

interface ReadinessReport {
  setlistId: string
  overallReadiness: number
  totalSongs: number
  readySongs: number
  needsPracticeSongs: number
  recommendations: string[]
  estimatedPracticeTime: number
}

export const Setlists: React.FC<SetlistsProps> = ({
  setlists,
  songs,
  bandMembers = [],
  bandId = 'band1',
  loading = false,
  onCreateSetlist,
  onEditSetlist,
  onDeleteSetlist,
  onDuplicateSetlist,
  onSetlistClick,
  onBack
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedSetlist, setSelectedSetlist] = useState<Setlist | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [readinessReport, setReadinessReport] = useState<ReadinessReport | null>(null)

  const filteredSetlists = setlists.filter(setlist =>
    setlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    setlist.venue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    setlist.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getSongById = (id: string) => songs.find(song => song.id === id)

  const calculateReadiness = (setlist: Setlist): ReadinessReport => {
    const setlistSongs = setlist.songs.map(ss => getSongById(ss.songId)).filter(Boolean) as Song[]
    const totalSongs = setlistSongs.length
    const readySongs = setlistSongs.filter(song => song.confidenceLevel >= 4).length
    const needsPracticeSongs = setlistSongs.filter(song => song.confidenceLevel < 3).length

    const averageConfidence = totalSongs > 0
      ? setlistSongs.reduce((sum, song) => sum + song.confidenceLevel, 0) / totalSongs
      : 0

    const recommendations: string[] = []

    if (needsPracticeSongs > 0) {
      const weakestSongs = setlistSongs
        .filter(song => song.confidenceLevel < 3)
        .sort((a, b) => a.confidenceLevel - b.confidenceLevel)
        .slice(0, 3)

      recommendations.push(`Focus on practicing: ${weakestSongs.map(s => s.title).join(', ')}`)
    }

    if (readySongs / totalSongs < 0.7) {
      recommendations.push('Schedule additional practice sessions before performance')
    }

    const unpracticedSongs = setlistSongs.filter(song => !song.lastPracticed)
    if (unpracticedSongs.length > 0) {
      recommendations.push(`${unpracticedSongs.length} songs haven't been practiced yet`)
    }

    const estimatedPracticeTime = needsPracticeSongs * 20 + (totalSongs - readySongs - needsPracticeSongs) * 10

    return {
      setlistId: setlist.id,
      overallReadiness: averageConfidence,
      totalSongs,
      readySongs,
      needsPracticeSongs,
      recommendations,
      estimatedPracticeTime
    }
  }

  const handleCreateSetlist = async (setlistData: {
    name: string
    songs: SetlistSong[]
    showDate?: Date
    venue?: string
    notes?: string
  }) => {
    if (!onCreateSetlist) return

    setIsSubmitting(true)
    try {
      await onCreateSetlist(setlistData)
      setViewMode('list')
    } catch (error) {
      console.error('Failed to create setlist:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSetlist = async (setlistData: {
    name: string
    songs: SetlistSong[]
    showDate?: Date
    venue?: string
    notes?: string
  }) => {
    if (!onEditSetlist || !selectedSetlist) return

    setIsSubmitting(true)
    try {
      await onEditSetlist(selectedSetlist.id, setlistData)
      setViewMode('list')
      setSelectedSetlist(null)
    } catch (error) {
      console.error('Failed to edit setlist:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSetlist = async (setlist: Setlist) => {
    if (!onDeleteSetlist) return

    const confirmed = window.confirm(`Are you sure you want to delete "${setlist.name}"?`)
    if (!confirmed) return

    try {
      await onDeleteSetlist(setlist.id)
    } catch (error) {
      console.error('Failed to delete setlist:', error)
    }
  }

  const handleDuplicateSetlist = async (setlist: Setlist) => {
    if (!onDuplicateSetlist) return

    try {
      await onDuplicateSetlist(setlist.id)
    } catch (error) {
      console.error('Failed to duplicate setlist:', error)
    }
  }

  const handleSetlistEdit = (setlist: Setlist) => {
    setSelectedSetlist(setlist)
    setViewMode('edit')
  }

  const handleReadinessCheck = (setlist: Setlist) => {
    const report = calculateReadiness(setlist)
    setReadinessReport(report)
    setSelectedSetlist(setlist)
    setViewMode('readiness')
  }

  const handleManageCasting = (setlist: Setlist) => {
    setSelectedSetlist(setlist)
    setViewMode('casting')
  }

  const handleCompareCasting = () => {
    setViewMode('compare')
  }

  const handleCancel = () => {
    setViewMode('list')
    setSelectedSetlist(null)
    setReadinessReport(null)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'rehearsed': return 'bg-blue-100 text-blue-800'
      case 'performed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getReadinessColor = (readiness: number) => {
    if (readiness >= 4) return 'text-green-600'
    if (readiness >= 3) return 'text-yellow-600'
    if (readiness >= 2) return 'text-orange-600'
    return 'text-red-600'
  }

  const getUpcomingShows = () => {
    const now = new Date()
    return setlists
      .filter(setlist => setlist.showDate && new Date(setlist.showDate) > now)
      .sort((a, b) => new Date(a.showDate!).getTime() - new Date(b.showDate!).getTime())
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
          <h1 className="text-2xl font-bold text-steel-gray">Create New Setlist</h1>
        </div>
        <SetlistBuilder
          songs={songs}
          onSave={handleCreateSetlist}
          onCancel={handleCancel}
          loading={isSubmitting}
        />
      </div>
    )
  }

  if (viewMode === 'edit' && selectedSetlist) {
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
          <h1 className="text-2xl font-bold text-steel-gray">Edit Setlist</h1>
        </div>
        <SetlistBuilder
          songs={songs}
          setlist={selectedSetlist}
          onSave={handleEditSetlist}
          onCancel={handleCancel}
          loading={isSubmitting}
        />
      </div>
    )
  }

  if (viewMode === 'casting' && selectedSetlist) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="mr-4"
          >
            ← Back
          </TouchButton>
          <h1 className="text-2xl font-bold text-steel-gray">Manage Casting</h1>
        </div>
        <SetlistCastingView
          setlist={selectedSetlist}
          songs={songs}
          bandMembers={bandMembers}
          bandId={bandId}
          onClose={handleCancel}
        />
      </div>
    )
  }

  if (viewMode === 'compare') {
    const availableContexts = setlists.map(s => ({
      type: 'setlist' as const,
      id: s.id,
      name: s.name
    }))

    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="mr-4"
          >
            ← Back
          </TouchButton>
          <h1 className="text-2xl font-bold text-steel-gray">Compare Casting</h1>
        </div>
        <CastingComparison
          availableContexts={availableContexts}
          songs={songs}
          bandMembers={bandMembers}
          onClose={handleCancel}
        />
      </div>
    )
  }

  if (viewMode === 'readiness' && selectedSetlist && readinessReport) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
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
            <h1 className="text-2xl font-bold text-steel-gray">Readiness Report</h1>
            <p className="text-gray-600">{selectedSetlist.name}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Overall Readiness */}
          <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm p-6">
            <div className="text-center">
              <div className={`text-6xl font-bold mb-2 ${getReadinessColor(readinessReport.overallReadiness)}`}>
                {readinessReport.overallReadiness.toFixed(1)}
              </div>
              <div className="text-lg text-gray-600 mb-4">Overall Readiness Score</div>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div>
                  <div className="text-2xl font-bold text-green-600">{readinessReport.readySongs}</div>
                  <div className="text-sm text-gray-600">Ready</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{readinessReport.needsPracticeSongs}</div>
                  <div className="text-sm text-gray-600">Needs Practice</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">{readinessReport.totalSongs}</div>
                  <div className="text-sm text-gray-600">Total Songs</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {readinessReport.recommendations.length > 0 && (
            <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
              <div className="px-6 py-4 border-b border-steel-gray/20">
                <h3 className="text-lg font-semibold text-steel-gray">Recommendations</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {readinessReport.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-energy-orange text-sm font-medium">{index + 1}</span>
                      </div>
                      <p className="text-gray-700">{recommendation}</p>
                    </div>
                  ))}
                </div>
                {readinessReport.estimatedPracticeTime > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Estimated practice time needed:</strong> {readinessReport.estimatedPracticeTime} minutes
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Song Breakdown */}
          <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
            <div className="px-6 py-4 border-b border-steel-gray/20">
              <h3 className="text-lg font-semibold text-steel-gray">Song Breakdown</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {selectedSetlist.songs.map((setlistSong, index) => {
                  const song = getSongById(setlistSong.songId)
                  if (!song) return null

                  return (
                    <div key={setlistSong.songId} className="flex items-center justify-between p-3 border border-steel-gray/20 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm text-gray-500 w-8">#{index + 1}</div>
                        <div>
                          <div className="font-medium text-steel-gray">{song.title}</div>
                          <div className="text-sm text-gray-600">{song.artist}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600">{song.key}</div>
                        <div className={`text-sm font-medium ${getReadinessColor(song.confidenceLevel)}`}>
                          {song.confidenceLevel >= 4 ? 'Ready' :
                           song.confidenceLevel >= 3 ? 'Good' :
                           song.confidenceLevel >= 2 ? 'Practice' : 'New'}
                        </div>
                        <div className={`w-3 h-3 rounded-full ${
                          song.confidenceLevel >= 4 ? 'bg-green-500' :
                          song.confidenceLevel >= 3 ? 'bg-yellow-500' :
                          song.confidenceLevel >= 2 ? 'bg-orange-500' : 'bg-red-500'
                        }`}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
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
            <h1 className="text-2xl font-bold text-steel-gray">Setlists</h1>
            <p className="text-gray-600">Create and manage setlists for your performances</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          {bandMembers.length > 0 && (
            <TouchButton
              variant="secondary"
              size="md"
              onClick={handleCompareCasting}
            >
              Compare Casting
            </TouchButton>
          )}
          <TouchButton
            variant="primary"
            size="md"
            onClick={() => setViewMode('add')}
          >
            Create Setlist
          </TouchButton>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm p-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search setlists by name, venue, or notes..."
        />
      </div>

      {/* Upcoming Shows */}
      {getUpcomingShows().length > 0 && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="px-6 py-4 border-b border-steel-gray/20">
            <h3 className="text-lg font-semibold text-steel-gray">Upcoming Shows</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getUpcomingShows().slice(0, 4).map(setlist => {
                const readiness = calculateReadiness(setlist)

                return (
                  <div key={setlist.id} className="border border-steel-gray/20 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-steel-gray">{setlist.name}</h4>
                        {setlist.venue && (
                          <p className="text-sm text-gray-600">📍 {setlist.venue}</p>
                        )}
                        {setlist.showDate && (
                          <p className="text-sm text-gray-600">📅 {formatDate(setlist.showDate)}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(setlist.status)}`}>
                        {setlist.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-600">
                        {setlist.songs.length} songs
                      </div>
                      <div className={`text-sm font-medium ${getReadinessColor(readiness.overallReadiness)}`}>
                        {readiness.overallReadiness.toFixed(1)}/5.0 ready
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex gap-2">
                        <TouchButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleReadinessCheck(setlist)}
                        >
                          Readiness
                        </TouchButton>
                        {bandMembers.length > 0 && (
                          <TouchButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleManageCasting(setlist)}
                          >
                            Casting
                          </TouchButton>
                        )}
                      </div>
                      <TouchButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetlistEdit(setlist)}
                      >
                        Edit
                      </TouchButton>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* All Setlists */}
      <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
        <div className="px-6 py-4 border-b border-steel-gray/20">
          <h3 className="text-lg font-semibold text-steel-gray">All Setlists ({filteredSetlists.length})</h3>
        </div>
        <div className="p-6">
          {filteredSetlists.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSetlists.map(setlist => {
                const readiness = calculateReadiness(setlist)

                return (
                  <div key={setlist.id} className="border border-steel-gray/20 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-steel-gray truncate">{setlist.name}</h4>
                        {setlist.venue && (
                          <p className="text-sm text-gray-600 truncate">📍 {setlist.venue}</p>
                        )}
                        {setlist.showDate && (
                          <p className="text-sm text-gray-600">📅 {formatDate(setlist.showDate)}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(setlist.status)}`}>
                        {setlist.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-600">
                        {setlist.songs.length} songs • {Math.floor(setlist.totalDuration / 60)}m
                      </div>
                      <div className={`text-sm font-medium ${getReadinessColor(readiness.overallReadiness)}`}>
                        {readiness.overallReadiness.toFixed(1)}/5.0
                      </div>
                    </div>

                    {setlist.notes && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{setlist.notes}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2 flex-wrap gap-2">
                        <TouchButton
                          variant="primary"
                          size="sm"
                          onClick={() => onSetlistClick?.(setlist)}
                        >
                          View
                        </TouchButton>
                        <TouchButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReadinessCheck(setlist)}
                        >
                          Readiness
                        </TouchButton>
                        {bandMembers.length > 0 && (
                          <TouchButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleManageCasting(setlist)}
                          >
                            Casting
                          </TouchButton>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <TouchButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetlistEdit(setlist)}
                          className="p-2"
                          aria-label="Edit setlist"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </TouchButton>
                        <TouchButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicateSetlist(setlist)}
                          className="p-2"
                          aria-label="Duplicate setlist"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </TouchButton>
                        <TouchButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSetlist(setlist)}
                          className="p-2 text-red-600 hover:text-red-800"
                          aria-label="Delete setlist"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </TouchButton>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              {searchQuery ? (
                <>
                  <div className="text-gray-500 mb-3">No setlists found matching "{searchQuery}"</div>
                  <TouchButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search
                  </TouchButton>
                </>
              ) : (
                <>
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
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-steel-gray">No setlists yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating your first setlist for an upcoming show.
                  </p>
                  <div className="mt-6">
                    <TouchButton
                      variant="primary"
                      size="lg"
                      onClick={() => setViewMode('add')}
                    >
                      Create Your First Setlist
                    </TouchButton>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && setlists.length === 0 && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="p-12">
            <LoadingSpinner size="lg" centered text="Loading setlists..." />
          </div>
        </div>
      )}
    </div>
  )
}