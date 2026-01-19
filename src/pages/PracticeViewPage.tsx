import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { EntityHeader } from '../components/common/EntityHeader'
import { InlineEditableField } from '../components/common/InlineEditableField'
import { PRACTICE_STATUS_OPTIONS } from '../components/common/InlineStatusBadge'
import {
  SortableSongListItem,
  UISong,
  UISetlistItem,
  generateAvatarColor,
  generateInitials,
} from '../components/common/SongListItem'
import { BrowseSongsDrawer } from '../components/common/BrowseSongsDrawer'
import { EditSongModal } from '../components/songs/EditSongModal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useConfirm } from '../hooks/useConfirm'
import { useToast } from '../contexts/ToastContext'
import { db } from '../services/database'
import {
  formatShowDate,
  formatTime12Hour,
  formatDateForInput,
  parseDateInputAsLocal,
  parseTime12Hour,
} from '../utils/dateHelpers'
import { secondsToDuration } from '../utils/formatters'
import { ListMusic, Plus, FileText, Clock, MapPin, Play } from 'lucide-react'
import type { PracticeSession } from '../models/PracticeSession'
import type { Song as DBSong } from '../models/Song'
import type { Setlist as DBSetlist } from '../models/Setlist'
import type { SessionStatus } from '../types'
import { useCreatePractice, useUpdatePractice } from '../hooks/usePractices'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

// Convert database song to UI song
const dbSongToUISong = (dbSong: DBSong): UISong => {
  return {
    id: dbSong.id!,
    title: dbSong.title,
    artist: dbSong.artist || '',
    duration: secondsToDuration(dbSong.duration || 0),
    durationSeconds: dbSong.duration || 0,
    key: dbSong.key,
    tuning: dbSong.guitarTuning,
    bpm: dbSong.bpm ? `${dbSong.bpm}` : '',
    initials: generateInitials(dbSong.title),
    avatarColor: generateAvatarColor(dbSong.title),
  }
}

// Helper to determine session status
const getSessionStatus = (session: PracticeSession): SessionStatus => {
  const now = new Date()
  const scheduledTime = new Date(session.scheduledDate)

  if (session.endTime) {
    return 'completed'
  }
  if (session.startTime) {
    return 'in-progress'
  }
  if (scheduledTime > now) {
    return 'scheduled'
  }
  return 'cancelled'
}

// Format duration in minutes to hours/minutes
const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}

// Practice song with position for list
interface UIPracticeSong {
  id: string
  songId: string
  song: UISong
  position: number
}

// Main PracticeViewPage Component
export const PracticeViewPage: React.FC = () => {
  const navigate = useNavigate()
  const { practiceId } = useParams<{ practiceId: string }>()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()

  // Detect "new" mode
  const isNewMode = !practiceId || practiceId === 'new'

  // Core state
  const [loading, setLoading] = useState(!isNewMode)
  const [practice, setPractice] = useState<PracticeSession | null>(null)
  const [songs, setSongs] = useState<UIPracticeSong[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Available data for song picker
  const [dbSongs, setDbSongs] = useState<DBSong[]>([])
  const [dbSetlists, setDbSetlists] = useState<DBSetlist[]>([])

  // Expandable notes state
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null)

  // Edit song modal state
  const [editingSong, setEditingSong] = useState<DBSong | null>(null)

  // Hooks
  const { createPractice } = useCreatePractice()
  const { updatePractice } = useUpdatePractice()

  // Get currentBandId and currentUserId from localStorage
  const currentBandId = localStorage.getItem('currentBandId') || ''
  const currentUserId = localStorage.getItem('currentUserId') || ''

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load practice data
  useEffect(() => {
    const loadPractice = async () => {
      // Load available songs and setlists for picker
      if (currentBandId) {
        const loadedDbSongs = await db.songs
          .where('contextType')
          .equals('band')
          .and(s => s.contextId === currentBandId)
          .toArray()

        const loadedDbSetlists = await db.setlists
          .where('bandId')
          .equals(currentBandId)
          .toArray()

        setDbSongs(loadedDbSongs)
        setDbSetlists(loadedDbSetlists)
      }

      // For new mode, create a default practice
      if (isNewMode) {
        const now = new Date()
        // Default to 7 PM
        now.setHours(19, 0, 0, 0)
        const defaultPractice: Partial<PracticeSession> = {
          scheduledDate: now,
          duration: 120,
          bandId: currentBandId,
          songs: [],
        }
        setPractice(defaultPractice as PracticeSession)
        return
      }

      try {
        setLoading(true)

        // Load the practice session
        const practiceSession = await db.practiceSessions.get(practiceId)

        if (!practiceSession) {
          navigate('/practices')
          return
        }

        setPractice(practiceSession)

        // Load songs for this practice
        const practiceSongs: UIPracticeSong[] = []
        if (practiceSession.songs && practiceSession.songs.length > 0) {
          for (const sessionSong of practiceSession.songs) {
            const song = await db.songs.get(sessionSong.songId)
            if (song) {
              practiceSongs.push({
                id: crypto.randomUUID(),
                songId: song.id!,
                song: dbSongToUISong(song),
                position: practiceSongs.length + 1,
              })
            }
          }
        }
        setSongs(practiceSongs)
      } catch (err) {
        console.error('Error loading practice:', err)
        navigate('/practices')
      } finally {
        setLoading(false)
      }
    }

    loadPractice()
  }, [practiceId, navigate, currentBandId, isNewMode])

  // Save a single field
  const saveField = useCallback(
    async (field: keyof PracticeSession, value: unknown) => {
      if (isNewMode) {
        // For new mode, just update local state
        setPractice(prev => (prev ? { ...prev, [field]: value } : prev))
        return
      }

      if (!practiceId) return

      try {
        await updatePractice(practiceId, { [field]: value })
        setPractice(prev => (prev ? { ...prev, [field]: value } : prev))
        showToast('Saved', 'success')
      } catch (error) {
        console.error('Error saving field:', error)
        showToast('Failed to save', 'error')
        throw error
      }
    },
    [practiceId, isNewMode, updatePractice, showToast]
  )

  // Save date and time combined
  const saveDateTime = useCallback(
    async (date: string, time: string) => {
      const baseDate = parseDateInputAsLocal(date)
      const scheduledDateTime = parseTime12Hour(time, baseDate)

      if (isNewMode) {
        setPractice(prev =>
          prev ? { ...prev, scheduledDate: scheduledDateTime } : prev
        )
        return
      }

      if (!practiceId) return

      try {
        await updatePractice(practiceId, { scheduledDate: scheduledDateTime })
        setPractice(prev =>
          prev ? { ...prev, scheduledDate: scheduledDateTime } : prev
        )
        showToast('Saved', 'success')
      } catch (error) {
        console.error('Error saving date/time:', error)
        showToast('Failed to save', 'error')
        throw error
      }
    },
    [practiceId, isNewMode, updatePractice, showToast]
  )

  // Create new practice (for new mode)
  const createPracticeHandler = useCallback(async () => {
    if (!practice) return

    try {
      const newPracticeId = await createPractice({
        bandId: currentBandId,
        scheduledDate: practice.scheduledDate,
        duration: practice.duration,
        location: practice.location,
        notes: practice.notes,
        wrapupNotes: practice.wrapupNotes,
        songs: songs.map(s => ({
          songId: s.songId,
          timeSpent: 0,
          status: 'not-started' as const,
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        })),
      })

      if (newPracticeId) {
        showToast('Practice created', 'success')
        navigate(`/practices/${newPracticeId}`, { replace: true })
      }
    } catch (error) {
      console.error('Error creating practice:', error)
      showToast('Failed to create practice', 'error')
    }
  }, [practice, songs, currentBandId, createPractice, showToast, navigate])

  // Handle drag end for reordering songs (always active)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setSongs(prev => {
        const oldIndex = prev.findIndex(item => item.id === active.id)
        const newIndex = prev.findIndex(item => item.id === over.id)

        const reordered = arrayMove(prev, oldIndex, newIndex).map(
          (item, index) => ({
            ...item,
            position: index + 1,
          })
        )

        // Auto-save song order if we have an existing practice
        if (practiceId && !isNewMode) {
          saveSongOrder(reordered)
        }

        return reordered
      })
    }
  }

  // Save song order to database
  const saveSongOrder = async (orderedSongs: UIPracticeSong[]) => {
    if (!practiceId || isNewMode) return

    try {
      await updatePractice(practiceId, {
        songs: orderedSongs.map(s => ({
          songId: s.songId,
          timeSpent: 0,
          status: 'not-started' as const,
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        })),
      })
    } catch (err) {
      console.error('Error saving song order:', err)
    }
  }

  // Add song to practice (always available)
  const addSongToPractice = (song: DBSong) => {
    const newPosition = songs.length + 1
    const uiSong = dbSongToUISong(song)
    const newItem: UIPracticeSong = {
      id: crypto.randomUUID(),
      songId: song.id!,
      song: uiSong,
      position: newPosition,
    }

    const newSongs = [...songs, newItem]
    setSongs(newSongs)

    // Auto-save if we have an existing practice
    if (practiceId && !isNewMode) {
      saveSongOrder(newSongs)
    }

    showToast(`Added "${song.title}"`, 'success')
  }

  // Add all songs from setlist
  const addAllSongsFromSetlist = (setlistSongs: DBSong[]) => {
    const startPosition = songs.length + 1
    const newItems: UIPracticeSong[] = setlistSongs.map((song, index) => ({
      id: crypto.randomUUID(),
      songId: song.id!,
      song: dbSongToUISong(song),
      position: startPosition + index,
    }))

    const newSongs = [...songs, ...newItems]
    setSongs(newSongs)

    // Auto-save if we have an existing practice
    if (practiceId && !isNewMode) {
      saveSongOrder(newSongs)
    }

    showToast(`Added ${setlistSongs.length} songs`, 'success')
  }

  // Remove song with confirmation
  const removeSongFromPractice = async (itemId: string, songTitle: string) => {
    const confirmed = await confirm({
      title: 'Remove Song',
      message: `Remove "${songTitle}" from this practice?`,
      variant: 'warning',
      confirmLabel: 'Remove',
    })

    if (confirmed) {
      const newSongs = songs
        .filter(item => item.id !== itemId)
        .map((item, index) => ({ ...item, position: index + 1 }))

      setSongs(newSongs)

      // Auto-save if we have an existing practice
      if (practiceId && !isNewMode) {
        saveSongOrder(newSongs)
      }

      showToast('Song removed', 'success')
    }
  }

  if (!practice) return null

  // Build display data
  const practiceDate = new Date(practice.scheduledDate)
  const formattedDate = formatDateForInput(practiceDate)
  const formattedTime = formatTime12Hour(practiceDate)
  const dateLabel = formatShowDate(practiceDate)

  const status = getSessionStatus(practice)

  // Header title - auto-generated from date
  const headerTitle = `Practice on ${practiceDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`

  // Current song IDs for drawer
  const songsInPractice = songs.map(item => item.songId)

  // Convert to UISetlistItem format for SongListItem
  const displayItems: UISetlistItem[] = songs.map(s => ({
    id: s.id,
    type: 'song' as const,
    position: s.position,
    song: s.song,
    songId: s.songId,
  }))

  return (
    <ContentLoadingSpinner isLoading={loading}>
      <div data-testid="practice-view-page">
        {/* Header with inline editing */}
        <EntityHeader
          backPath="/practices"
          title={headerTitle}
          titleEditable={false}
          entityType="practice"
          date={formattedDate}
          time={formattedTime}
          dateLabel={dateLabel}
          timeLabel={formattedTime}
          onDateSave={val => saveDateTime(String(val), formattedTime)}
          onTimeSave={val => saveDateTime(formattedDate, String(val))}
          venue={practice.location}
          onVenueSave={val => saveField('location', String(val) || undefined)}
          status={
            !isNewMode
              ? {
                  value: status,
                  onSave: () => {}, // Status is computed, not directly editable
                  options: PRACTICE_STATUS_OPTIONS,
                  disabled: true, // Practice status is auto-computed
                }
              : undefined
          }
          isNew={isNewMode}
        />

        {/* Start Practice Button - shown for existing practices with songs */}
        {!isNewMode && songs.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
            <button
              onClick={() => navigate(`/practices/${practiceId}/session`)}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#f17827ff] to-[#d66920] hover:from-[#ff8c3d] hover:to-[#e07830] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#f17827ff]/20 hover:shadow-xl hover:shadow-[#f17827ff]/30"
              data-testid="start-practice-button"
            >
              <Play size={24} fill="currentColor" />
              <span className="text-lg">Start Practice Session</span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* New mode save button */}
          {isNewMode && (
            <div className="bg-[#121212] border border-[#f17827ff] rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Creating new practice</p>
                <p className="text-sm text-[#707070]">
                  Click any field above to edit, then save when ready
                </p>
              </div>
              <button
                onClick={createPracticeHandler}
                className="px-4 py-2 bg-[#f17827ff] hover:bg-[#d66920] text-white font-medium rounded-lg transition-colors"
                data-testid="create-practice-button"
              >
                Create Practice
              </button>
            </div>
          )}

          {/* Details Section */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Duration */}
              <InlineEditableField
                label="Duration"
                value={practice.duration}
                displayValue={formatDuration(practice.duration)}
                onSave={val => saveField('duration', Number(val))}
                type="duration"
                icon={<Clock size={16} />}
                data-testid="practice-duration"
              />

              {/* Location */}
              <InlineEditableField
                label="Location"
                value={practice.location || ''}
                onSave={val => saveField('location', String(val) || undefined)}
                placeholder="Practice space, studio, etc."
                icon={<MapPin size={16} />}
                data-testid="practice-location"
              />
            </div>

            {/* Pre-practice Notes - Full Width */}
            <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
              <InlineEditableField
                label="Notes"
                value={practice.notes || ''}
                onSave={val => saveField('notes', String(val) || undefined)}
                type="textarea"
                placeholder="What to focus on, parts to work on, objectives for the band..."
                icon={<FileText size={16} />}
                data-testid="practice-notes"
              />
            </div>
          </div>

          {/* Songs Section - ALWAYS editable */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Songs ({songs.length})
              </h2>
              <button
                onClick={() => setIsDrawerOpen(true)}
                data-testid="add-songs-button"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
              >
                <Plus size={18} />
                <span>Add Songs</span>
              </button>
            </div>

            {songs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-[#2a2a2a] rounded-lg">
                <ListMusic size={48} className="text-[#2a2a2a] mb-3" />
                <p className="text-[#707070] text-sm mb-1">
                  No songs in this practice
                </p>
                <p className="text-[#505050] text-xs mb-4">
                  Add songs to practice during this session
                </p>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
                >
                  <Plus size={18} />
                  <span>Add Songs</span>
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={songs.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div data-testid="practice-songs-list" className="space-y-2">
                    {displayItems.map(item => (
                      <SortableSongListItem
                        key={item.id}
                        item={item}
                        isEditing={true}
                        onRemove={() =>
                          removeSongFromPractice(
                            item.id,
                            item.song?.title || 'this song'
                          )
                        }
                        onEdit={() => {
                          const song = dbSongs.find(s => s.id === item.songId)
                          if (song) setEditingSong(song)
                        }}
                        userId={currentUserId}
                        bandId={currentBandId}
                        isNotesExpanded={item.song?.id === expandedSongId}
                        onToggleNotes={() =>
                          setExpandedSongId(
                            item.song?.id === expandedSongId
                              ? null
                              : item.song?.id || null
                          )
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Wrap-up Notes Section */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Wrap-up Notes
            </h2>
            <p className="text-sm text-[#707070] mb-4">
              Capture your thoughts after the practice - what went well, what to
              improve, or any action items.
            </p>
            <InlineEditableField
              value={practice.wrapupNotes || ''}
              onSave={val => saveField('wrapupNotes', String(val) || undefined)}
              type="textarea"
              placeholder="How did it go? What to focus on next time?"
              icon={<FileText size={16} />}
              data-testid="practice-wrapup-notes"
            />
          </div>
        </div>

        {/* Browse Songs Drawer */}
        <BrowseSongsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          songs={dbSongs}
          selectedSongIds={songsInPractice}
          onAddSong={addSongToPractice}
          setlists={dbSetlists}
          onAddAllFromSetlist={addAllSongsFromSetlist}
        />

        {/* Confirm Dialog */}
        <ConfirmDialog {...dialogProps} />

        {/* Edit Song Modal */}
        {editingSong && (
          <EditSongModal
            song={editingSong}
            onClose={() => setEditingSong(null)}
            onSave={async updatedSong => {
              try {
                await db.songs.update(updatedSong.id!, updatedSong)
                // Update the song in our local state
                setDbSongs(prev =>
                  prev.map(s => (s.id === updatedSong.id ? updatedSong : s))
                )
                // Also update the displayed songs list
                setSongs(prev =>
                  prev.map(ps =>
                    ps.songId === updatedSong.id
                      ? { ...ps, song: dbSongToUISong(updatedSong) }
                      : ps
                  )
                )
                setEditingSong(null)
                showToast('Song updated', 'success')
              } catch (error) {
                console.error('Error updating song:', error)
                showToast('Failed to update song', 'error')
              }
            }}
          />
        )}
      </div>
    </ContentLoadingSpinner>
  )
}
