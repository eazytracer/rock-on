import React, { useState, useEffect } from 'react'
import { Song } from '../../models/Song'
import { SongList } from '../../components/songs/SongList'
import { AddSongForm } from '../../components/songs/AddSongForm'
import { TouchButton } from '../../components/common/TouchButton'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

interface SongsProps {
  songs: Song[]
  loading?: boolean
  onAddSong?: (songData: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel'>) => Promise<void>
  onEditSong?: (songId: string, songData: Partial<Song>) => Promise<void>
  onDeleteSong?: (songId: string) => Promise<void>
  onSongClick?: (song: Song) => void
  onCreate?: () => void
  onBack?: () => void
}

type ViewMode = 'list' | 'add' | 'edit'

export const Songs: React.FC<SongsProps> = ({
  songs,
  loading = false,
  onAddSong,
  onEditSong,
  onDeleteSong,
  onSongClick,
  onCreate,
  onBack
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    ready: 0,
    needsPractice: 0,
    new: 0,
    averageConfidence: 0
  })

  useEffect(() => {
    calculateStats()
  }, [songs])

  const calculateStats = () => {
    const total = songs.length
    const ready = songs.filter(song => song.confidenceLevel >= 4).length
    const needsPractice = songs.filter(song => song.confidenceLevel >= 2 && song.confidenceLevel < 4).length
    const newSongs = songs.filter(song => song.confidenceLevel < 2).length
    const averageConfidence = total > 0
      ? songs.reduce((sum, song) => sum + song.confidenceLevel, 0) / total
      : 0

    setStats({
      total,
      ready,
      needsPractice,
      new: newSongs,
      averageConfidence
    })
  }

  const handleAddSong = async (songData: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel'>) => {
    if (!onAddSong) return

    setIsSubmitting(true)
    try {
      await onAddSong(songData)
      setViewMode('list')
    } catch (error) {
      console.error('Failed to add song:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSong = async (songData: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel'>) => {
    if (!onEditSong || !selectedSong) return

    setIsSubmitting(true)
    try {
      await onEditSong(selectedSong.id, songData)
      setViewMode('list')
      setSelectedSong(null)
    } catch (error) {
      console.error('Failed to edit song:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSong = async (song: Song) => {
    if (!onDeleteSong) return

    const confirmed = window.confirm(`Are you sure you want to delete "${song.title}" by ${song.artist}?`)
    if (!confirmed) return

    try {
      await onDeleteSong(song.id)
    } catch (error) {
      console.error('Failed to delete song:', error)
    }
  }

  const handleSongEdit = (song: Song) => {
    setSelectedSong(song)
    setViewMode('edit')
  }

  const handleCancel = () => {
    setViewMode('list')
    setSelectedSong(null)
  }

  const handleCreateClick = () => {
    if (onCreate) {
      onCreate()
    } else {
      setViewMode('add')
    }
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
          <h1 className="text-2xl font-bold text-steel-gray">Add New Song</h1>
        </div>
        <AddSongForm
          onSubmit={handleAddSong}
          onCancel={handleCancel}
          loading={isSubmitting}
        />
      </div>
    )
  }

  if (viewMode === 'edit' && selectedSong) {
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
          <h1 className="text-2xl font-bold text-steel-gray">Edit Song</h1>
        </div>
        <AddSongForm
          onSubmit={handleEditSong}
          onCancel={handleCancel}
          initialData={selectedSong}
          loading={isSubmitting}
        />
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
            <h1 className="text-2xl font-bold text-steel-gray">Songs</h1>
            <p className="text-gray-600">Manage your band's song catalog</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0">
          <TouchButton
            variant="primary"
            size="md"
            onClick={handleCreateClick}
          >
            Add Song
          </TouchButton>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-steel-gray">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Songs</div>
        </div>

        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{stats.ready}</div>
          <div className="text-sm text-gray-600">Performance Ready</div>
        </div>

        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">{stats.needsPractice}</div>
          <div className="text-sm text-gray-600">Needs Practice</div>
        </div>

        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-red-600">{stats.new}</div>
          <div className="text-sm text-gray-600">New Songs</div>
        </div>

        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-energy-orange">
            {stats.averageConfidence.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600">Avg Confidence</div>
        </div>
      </div>

      {/* Empty State */}
      {songs.length === 0 && !loading && (
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
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-steel-gray">No songs yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding your first song to the catalog.
            </p>
            <div className="mt-6">
              <TouchButton
                variant="primary"
                size="lg"
                onClick={handleCreateClick}
              >
                Add Your First Song
              </TouchButton>
            </div>
          </div>
        </div>
      )}

      {/* Song List */}
      {songs.length > 0 && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="p-6">
            <SongList
              songs={songs}
              loading={loading}
              onSongClick={onSongClick}
              onSongEdit={handleSongEdit}
              onSongDelete={handleDeleteSong}
              showSearch={true}
              searchPlaceholder="Search songs by title, artist, or tags..."
              virtualized={songs.length > 50}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {songs.length > 0 && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold text-steel-gray mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TouchButton
              variant="secondary"
              size="md"
              onClick={() => {
                // Filter to songs that need practice
                const needsPracticeSongs = songs.filter(song => song.confidenceLevel < 3)
                if (needsPracticeSongs.length > 0 && onSongClick) {
                  onSongClick(needsPracticeSongs[0])
                }
              }}
              disabled={stats.needsPractice === 0 && stats.new === 0}
            >
              Practice Weakest Song
            </TouchButton>

            <TouchButton
              variant="secondary"
              size="md"
              onClick={() => {
                // Filter to songs that haven't been practiced recently
                const unpracticedSongs = songs.filter(song => !song.lastPracticed)
                if (unpracticedSongs.length > 0 && onSongClick) {
                  onSongClick(unpracticedSongs[0])
                }
              }}
              disabled={songs.every(song => song.lastPracticed)}
            >
              Practice Unpracticed
            </TouchButton>

            <TouchButton
              variant="secondary"
              size="md"
              onClick={() => {
                // Pick a random song
                if (songs.length > 0 && onSongClick) {
                  const randomIndex = Math.floor(Math.random() * songs.length)
                  onSongClick(songs[randomIndex])
                }
              }}
              disabled={songs.length === 0}
            >
              Random Song
            </TouchButton>

            <TouchButton
              variant="primary"
              size="md"
              onClick={handleCreateClick}
            >
              Add New Song
            </TouchButton>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && songs.length === 0 && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="p-12">
            <LoadingSpinner size="lg" centered text="Loading songs..." />
          </div>
        </div>
      )}
    </div>
  )
}