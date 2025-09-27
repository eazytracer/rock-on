import React, { useState, useRef, useCallback } from 'react'
import { Song } from '../../models/Song'
import { Setlist } from '../../models/Setlist'
import { SetlistSong } from '../../types'
import { TouchButton } from '../common/TouchButton'
import { SearchBar } from '../common/SearchBar'
import { SongCard } from '../songs/SongCard'

interface SetlistBuilderProps {
  songs: Song[]
  setlist?: Setlist
  onSave: (setlistData: {
    name: string
    songs: SetlistSong[]
    showDate?: Date
    venue?: string
    notes?: string
  }) => void
  onCancel: () => void
  loading?: boolean
}

interface DragState {
  isDragging: boolean
  draggedIndex: number | null
  draggedFromAvailable: boolean
  startY: number
  currentY: number
}

export const SetlistBuilder: React.FC<SetlistBuilderProps> = ({
  songs,
  setlist,
  onSave,
  onCancel,
  loading = false
}) => {
  const [setlistName, setSetlistName] = useState(setlist?.name || '')
  const [showDate, setShowDate] = useState(
    setlist?.showDate ? new Date(setlist.showDate).toISOString().slice(0, 16) : ''
  )
  const [venue, setVenue] = useState(setlist?.venue || '')
  const [notes, setNotes] = useState(setlist?.notes || '')
  const [setlistSongs, setSetlistSongs] = useState<SetlistSong[]>(
    setlist?.songs || []
  )
  const [songSearch, setSongSearch] = useState('')
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedIndex: null,
    draggedFromAvailable: false,
    startY: 0,
    currentY: 0
  })

  const setlistRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ y: number; time: number } | null>(null)

  const availableSongs = songs.filter(song =>
    !setlistSongs.some(ss => ss.songId === song.id) &&
    (song.title.toLowerCase().includes(songSearch.toLowerCase()) ||
     song.artist.toLowerCase().includes(songSearch.toLowerCase()))
  )

  const getSongById = (id: string) => songs.find(song => song.id === id)

  const getTotalDuration = () => {
    return setlistSongs.reduce((total, setlistSong) => {
      const song = getSongById(setlistSong.songId)
      return total + (song?.duration || 0)
    }, 0)
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const addSongToSetlist = (song: Song, position?: number) => {
    const newSetlistSong: SetlistSong = {
      songId: song.id,
      order: position || setlistSongs.length + 1
    }

    if (position !== undefined) {
      const updatedSongs = [...setlistSongs]
      updatedSongs.splice(position - 1, 0, newSetlistSong)
      updatedSongs.forEach((song, index) => {
        song.order = index + 1
      })
      setSetlistSongs(updatedSongs)
    } else {
      setSetlistSongs([...setlistSongs, newSetlistSong])
    }
  }

  const removeSongFromSetlist = (index: number) => {
    const updatedSongs = setlistSongs.filter((_, i) => i !== index)
    updatedSongs.forEach((song, i) => {
      song.order = i + 1
    })
    setSetlistSongs(updatedSongs)
  }

  const reorderSongs = (fromIndex: number, toIndex: number) => {
    const updatedSongs = [...setlistSongs]
    const [movedSong] = updatedSongs.splice(fromIndex, 1)
    updatedSongs.splice(toIndex, 0, movedSong)

    updatedSongs.forEach((song, index) => {
      song.order = index + 1
    })

    setSetlistSongs(updatedSongs)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent, index: number, fromAvailable: boolean = false) => {
    const touch = e.touches[0]
    touchStartRef.current = { y: touch.clientY, time: Date.now() }

    setDragState({
      isDragging: false,
      draggedIndex: index,
      draggedFromAvailable: fromAvailable,
      startY: touch.clientY,
      currentY: touch.clientY
    })
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]

    if (touchStartRef.current) {
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)
      const deltaTime = Date.now() - touchStartRef.current.time

      if (deltaY > 10 && deltaTime > 100) {
        setDragState(prev => ({
          ...prev,
          isDragging: true,
          currentY: touch.clientY
        }))
      }
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragState.isDragging || dragState.draggedIndex === null) {
      touchStartRef.current = null
      setDragState({
        isDragging: false,
        draggedIndex: null,
        draggedFromAvailable: false,
        startY: 0,
        currentY: 0
      })
      return
    }

    const dropZone = document.elementFromPoint(
      e.changedTouches[0].clientX,
      e.changedTouches[0].clientY
    )

    const setlistElement = dropZone?.closest('[data-setlist-item]')

    if (setlistElement) {
      const dropIndex = parseInt(setlistElement.getAttribute('data-index') || '0')

      if (dragState.draggedFromAvailable) {
        const song = availableSongs[dragState.draggedIndex]
        if (song) {
          addSongToSetlist(song, dropIndex + 1)
        }
      } else {
        reorderSongs(dragState.draggedIndex, dropIndex)
      }
    } else if (dragState.draggedFromAvailable) {
      const song = availableSongs[dragState.draggedIndex]
      if (song) {
        addSongToSetlist(song)
      }
    }

    touchStartRef.current = null
    setDragState({
      isDragging: false,
      draggedIndex: null,
      draggedFromAvailable: false,
      startY: 0,
      currentY: 0
    })
  }, [dragState, availableSongs, setlistSongs])

  const handleSave = () => {
    if (!setlistName.trim()) {
      alert('Please enter a setlist name')
      return
    }

    const setlistData = {
      name: setlistName.trim(),
      songs: setlistSongs,
      showDate: showDate ? new Date(showDate) : undefined,
      venue: venue.trim() || undefined,
      notes: notes.trim() || undefined
    }

    onSave(setlistData)
  }

  const getReadinessColor = (songId: string) => {
    const song = getSongById(songId)
    if (!song) return 'bg-gray-100'

    if (song.confidenceLevel >= 4) return 'bg-green-100 border-green-300'
    if (song.confidenceLevel >= 3) return 'bg-yellow-100 border-yellow-300'
    if (song.confidenceLevel >= 2) return 'bg-orange-100 border-orange-300'
    return 'bg-red-100 border-red-300'
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Setlist Builder */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {setlist ? 'Edit Setlist' : 'Create Setlist'}
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Setlist Name *
              </label>
              <input
                type="text"
                value={setlistName}
                onChange={(e) => setSetlistName(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter setlist name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Show Date
                </label>
                <input
                  type="datetime-local"
                  value={showDate}
                  onChange={(e) => setShowDate(e.target.value)}
                  className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Venue
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Performance venue"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Performance notes, special instructions..."
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Songs ({setlistSongs.length})
                </h3>
                <div className="text-sm text-gray-600">
                  Total: {formatTotalTime(getTotalDuration())}
                </div>
              </div>

              <div
                ref={setlistRef}
                className="space-y-2 min-h-[200px] p-4 border-2 border-dashed border-gray-300 rounded-lg"
              >
                {setlistSongs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="mx-auto h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <p>Drag songs here to build your setlist</p>
                  </div>
                ) : (
                  setlistSongs.map((setlistSong, index) => {
                    const song = getSongById(setlistSong.songId)
                    if (!song) return null

                    const isDraggedItem = dragState.isDragging && dragState.draggedIndex === index && !dragState.draggedFromAvailable

                    return (
                      <div
                        key={`${setlistSong.songId}-${index}`}
                        data-setlist-item
                        data-index={index}
                        className={`p-3 border rounded-lg transition-all duration-200 ${
                          getReadinessColor(song.id)
                        } ${
                          isDraggedItem ? 'opacity-50 scale-95' : 'hover:shadow-md'
                        }`}
                        onTouchStart={(e) => handleTouchStart(e, index)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex flex-col items-center">
                              <span className="text-xs text-gray-500">#{index + 1}</span>
                              <svg className="w-4 h-4 text-gray-400 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">{song.title}</h4>
                              <p className="text-sm text-gray-600">{song.artist} • {formatDuration(song.duration)}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{song.key}</span>
                                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{song.bpm} BPM</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeSongFromSetlist(index)}
                            className="p-2 text-red-600 hover:text-red-800 transition-colors touch-manipulation"
                            aria-label="Remove from setlist"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
              <TouchButton
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleSave}
                loading={loading}
                className="sm:flex-1"
              >
                {setlist ? 'Update Setlist' : 'Save Setlist'}
              </TouchButton>
              <TouchButton
                variant="ghost"
                size="lg"
                fullWidth
                onClick={onCancel}
                disabled={loading}
                className="sm:flex-1"
              >
                Cancel
              </TouchButton>
            </div>
          </div>
        </div>

        {/* Available Songs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Available Songs</h3>
          </div>

          <div className="p-6">
            <SearchBar
              value={songSearch}
              onChange={setSongSearch}
              placeholder="Search available songs..."
              className="mb-4"
            />

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {availableSongs.map((song, index) => {
                const isDraggedItem = dragState.isDragging && dragState.draggedIndex === index && dragState.draggedFromAvailable

                return (
                  <div
                    key={song.id}
                    className={`transition-all duration-200 ${
                      isDraggedItem ? 'opacity-50 scale-95' : ''
                    }`}
                    onTouchStart={(e) => handleTouchStart(e, index, true)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <SongCard
                      song={song}
                      compact
                      onClick={() => addSongToSetlist(song)}
                      showActions={false}
                    />
                  </div>
                )
              })}

              {availableSongs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {songSearch ? `No songs found matching "${songSearch}"` : 'All songs are in the setlist'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}