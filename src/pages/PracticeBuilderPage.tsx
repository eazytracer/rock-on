import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { BrowseSongsDrawer } from '../components/common/BrowseSongsDrawer'
import { DatePicker } from '../components/common/DatePicker'
import { TimePickerDropdown } from '../components/common/TimePickerDropdown'
import { DurationPicker } from '../components/common/DurationPicker'
import {
  ArrowLeft,
  Plus,
  X,
  GripVertical,
  ListMusic,
  Check,
} from 'lucide-react'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../services/database'
import {
  formatDateForInput,
  parseDateInputAsLocal,
  parseTime12Hour,
  formatTime12Hour,
} from '../utils/dateHelpers'
import { secondsToDuration } from '../utils/formatters'
import type { Song as DBSong } from '../models/Song'
import type { Setlist as DBSetlist } from '../models/Setlist'
import { useCreatePractice, useUpdatePractice } from '../hooks/usePractices'

// UI-specific types for display
interface UISong {
  id: string
  title: string
  artist: string
  duration: string // Formatted duration (e.g., "3:14")
  durationSeconds: number // Raw seconds from database
  key?: string
  tuning?: string
  bpm?: string
  initials: string
  avatarColor: string
}

interface UIPracticeSong {
  id: string // Unique ID for this item in the list
  songId: string // Reference to the actual song
  song: UISong
  position: number
}

// Helper function to generate avatar color from song title
const generateAvatarColor = (title: string): string => {
  const colors = [
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#f43f5e',
    '#14b8a6',
    '#ef4444',
    '#6366f1',
    '#a855f7',
    '#84cc16',
    '#eab308',
    '#10b981',
    '#06b6d4',
    '#d946ef',
    '#f97316',
  ]
  const index = title.charCodeAt(0) % colors.length
  return colors[index]
}

// Helper function to generate initials from song title
const generateInitials = (title: string): string => {
  const words = title.split(' ').filter(w => w.length > 0)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return title.substring(0, 2).toUpperCase()
}

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

// Draggable Song Item Component
interface SortableSongItemProps {
  item: UIPracticeSong
  onRemove: (itemId: string) => void
}

const SortableSongItem: React.FC<SortableSongItemProps> = ({
  item,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const song = item.song

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`practice-song-${item.position - 1}`}
      className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg group hover:border-[#3a3a3a] transition-colors ${
        isDragging ? 'shadow-lg shadow-black/50' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
        data-testid={`drag-handle-${item.position - 1}`}
      >
        <GripVertical size={18} />
      </button>

      <div className="w-5 sm:w-6 text-center text-[#707070] text-sm font-medium flex-shrink-0">
        {item.position}
      </div>

      <div
        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm uppercase flex-shrink-0"
        style={{ backgroundColor: song.avatarColor }}
      >
        {song.initials}
      </div>

      {/* Mobile: Title/Artist + Duration stacked */}
      <div className="flex-1 min-w-0 sm:hidden">
        <div className="text-white text-sm font-semibold truncate">
          {song.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#707070]">
          <span className="truncate">{song.artist}</span>
          <span className="text-[#505050]">•</span>
          <span className="flex-shrink-0">{song.duration}</span>
          <span className="text-[#505050]">•</span>
          <span className="flex-shrink-0">{song.key}</span>
        </div>
      </div>

      {/* Desktop: Full layout */}
      <div className="hidden sm:block flex-1 min-w-[200px]">
        <div className="text-white text-sm font-semibold truncate">
          {song.title}
        </div>
        <div className="text-[#707070] text-xs truncate">{song.artist}</div>
      </div>

      <div className="hidden sm:block w-[90px] text-[#a0a0a0] text-sm flex-shrink-0">
        {song.duration}
      </div>

      <div className="hidden sm:block w-[60px] text-[#a0a0a0] text-sm flex-shrink-0">
        {song.key}
      </div>

      <div className="hidden sm:block w-[130px] text-[#a0a0a0] text-sm flex-shrink-0">
        {song.tuning}
      </div>

      <button
        onClick={() => onRemove(item.id)}
        data-testid={`remove-song-${item.position - 1}`}
        className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-[#707070] hover:text-red-500 hover:bg-red-500/10 rounded transition-all flex-shrink-0"
        title="Remove from Practice"
      >
        <X size={16} />
      </button>
    </div>
  )
}

// Main PracticeBuilderPage Component
export const PracticeBuilderPage: React.FC = () => {
  const navigate = useNavigate()
  const { practiceId } = useParams<{ practiceId?: string }>()

  // Get currentBandId from localStorage
  const [currentBandId] = useState(
    () => localStorage.getItem('currentBandId') || ''
  )

  // Hooks for practice operations
  const { createPractice, loading: creating } = useCreatePractice()
  const { updatePractice, loading: updating } = useUpdatePractice()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Form state
  const [date, setDate] = useState(() => formatDateForInput(new Date()))
  const [time, setTime] = useState(() => formatTime12Hour(new Date()))
  const [duration, setDuration] = useState(120) // Default 2 hours
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedSongs, setSelectedSongs] = useState<UIPracticeSong[]>([])

  // Available data
  const [dbSongs, setDbSongs] = useState<DBSong[]>([])
  const [dbSetlists, setDbSetlists] = useState<DBSetlist[]>([])

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!currentBandId) {
        setError('No band selected')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load songs for the band
        const loadedDbSongs = await db.songs
          .where('contextType')
          .equals('band')
          .and(s => s.contextId === currentBandId)
          .toArray()

        // Load setlists for the band
        const loadedDbSetlists = await db.setlists
          .where('bandId')
          .equals(currentBandId)
          .toArray()

        setDbSongs(loadedDbSongs)
        setDbSetlists(loadedDbSetlists)

        // If editing, load existing practice
        if (practiceId) {
          const practice = await db.practiceSessions.get(practiceId)
          if (practice) {
            setDate(formatDateForInput(practice.scheduledDate))
            setTime(formatTime12Hour(practice.scheduledDate))
            setDuration(practice.duration)
            setLocation(practice.location || '')
            setNotes(practice.notes || '')

            // Load songs for this practice
            if (practice.songs && practice.songs.length > 0) {
              const practiceSongs: UIPracticeSong[] = []
              for (const sessionSong of practice.songs) {
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
              setSelectedSongs(practiceSongs)
            }
          }
        }
      } catch (err) {
        console.error('Error loading practice data:', err)
        setError('Failed to load practice data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentBandId, practiceId])

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setSelectedSongs(prev => {
        const oldIndex = prev.findIndex(item => item.id === active.id)
        const newIndex = prev.findIndex(item => item.id === over.id)

        const newItems = arrayMove(prev, oldIndex, newIndex).map(
          (item, index) => ({
            ...item,
            position: index + 1,
          })
        )

        return newItems
      })
    }
  }

  // Add song to practice
  const addSongToPractice = (song: DBSong) => {
    const newPosition = selectedSongs.length + 1
    const uiSong = dbSongToUISong(song)
    const newItem: UIPracticeSong = {
      id: crypto.randomUUID(),
      songId: song.id!,
      song: uiSong,
      position: newPosition,
    }

    setSelectedSongs(prev => [...prev, newItem])
  }

  // Add all songs from setlist
  const addAllSongsFromSetlist = (songs: DBSong[]) => {
    const startPosition = selectedSongs.length + 1
    const newItems: UIPracticeSong[] = songs.map((song, index) => {
      const uiSong = dbSongToUISong(song)
      return {
        id: crypto.randomUUID(),
        songId: song.id!,
        song: uiSong,
        position: startPosition + index,
      }
    })

    setSelectedSongs(prev => [...prev, ...newItems])
  }

  // Remove song from practice
  const removeSongFromPractice = (itemId: string) => {
    setSelectedSongs(prev => {
      const newItems = prev
        .filter(item => item.id !== itemId)
        .map((item, index) => ({ ...item, position: index + 1 }))
      return newItems
    })
  }

  // Handle save
  const handleSave = async () => {
    if (!currentBandId) {
      alert('No band selected')
      return
    }

    try {
      // Combine date and time
      const baseDate = parseDateInputAsLocal(date)
      const scheduledDateTime = parseTime12Hour(time, baseDate)

      const practiceData = {
        bandId: currentBandId,
        scheduledDate: scheduledDateTime,
        duration,
        location,
        notes,
        songs: selectedSongs.map(s => ({
          songId: s.songId,
          timeSpent: 0,
          status: 'not-started' as const,
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        })),
      }

      if (practiceId) {
        // Update existing practice
        await updatePractice(practiceId, practiceData)
      } else {
        // Create new practice
        await createPractice(practiceData)
      }

      // Navigate back to practices page
      navigate('/practices')
    } catch (err) {
      console.error('Error saving practice:', err)
      alert('Failed to save practice')
    }
  }

  // Handle back/cancel
  const handleBack = () => {
    navigate('/practices')
  }

  // Filter songs that are already in the practice
  const songsInPractice = selectedSongs.map(item => item.songId)

  return (
    <ContentLoadingSpinner isLoading={loading}>
      <div
        data-testid="practice-builder-page"
        className="fixed inset-0 bg-[#0f0f0f] z-50 flex flex-col"
      >
        {error && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-500 text-sm mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="border-b border-[#2a2a2a] bg-[#121212] flex-shrink-0">
          <div className="flex items-center justify-between gap-3 px-3 sm:px-6 py-2 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <button
                onClick={handleBack}
                data-testid="back-button"
                className="p-1.5 sm:p-2 text-[#707070] hover:text-white transition-colors rounded-lg hover:bg-[#1a1a1a] flex-shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-white">
                  {practiceId ? 'Edit Practice' : 'Schedule Practice'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
              {/* Mobile: Icon buttons */}
              <button
                onClick={handleBack}
                data-testid="cancel-button"
                className="sm:hidden p-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white hover:bg-[#1f1f1f] transition-colors"
                title="Cancel"
              >
                <X size={18} />
              </button>
              <button
                onClick={handleSave}
                data-testid="save-button"
                disabled={creating || updating}
                className="sm:hidden p-2 rounded-lg bg-[#f17827ff] text-white hover:bg-[#d66920] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save"
              >
                <Check size={18} />
              </button>

              {/* Desktop: Text buttons */}
              <button
                onClick={handleBack}
                data-testid="cancel-button"
                className="hidden sm:block px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                data-testid="save-button"
                disabled={creating || updating}
                className="hidden sm:block px-6 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating || updating ? 'Saving...' : 'Save Practice'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
          {/* Left Panel - Practice Details */}
          <div className="w-full sm:w-[400px] border-b sm:border-b-0 sm:border-r border-[#2a2a2a] p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-[#0f0f0f]">
            <div className="space-y-4">
              <DatePicker
                label="Date"
                name="practiceDate"
                id="practice-date"
                data-testid="practice-date-input"
                value={date}
                onChange={setDate}
                required
              />

              <TimePickerDropdown
                label="Time"
                name="practiceTime"
                id="practice-time"
                data-testid="practice-time-input"
                value={time}
                onChange={setTime}
                required
              />

              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Duration
                </label>
                <DurationPicker
                  value={duration}
                  onChange={setDuration}
                  placeholder="Select duration"
                />
              </div>

              <div>
                <label
                  htmlFor="practice-location"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  id="practice-location"
                  data-testid="practice-location-input"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Practice space, studio, etc."
                  className="w-full h-10 px-3 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="practice-notes"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Notes
                </label>
                <textarea
                  name="notes"
                  id="practice-notes"
                  data-testid="practice-notes-input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Practice goals, what to focus on, etc."
                  rows={4}
                  className="w-full px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Right Panel - Songs */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-semibold text-lg">
                  Songs to Practice
                </h3>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  data-testid="add-songs-button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
                >
                  <Plus size={18} />
                  <span>Add Songs</span>
                </button>
              </div>

              {selectedSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#2a2a2a] rounded-xl">
                  <ListMusic size={48} className="text-[#2a2a2a] mb-3" />
                  <p className="text-[#707070] text-sm mb-1">No songs yet</p>
                  <p className="text-[#505050] text-xs mb-4">
                    Add songs to practice during this session
                  </p>
                  <button
                    onClick={() => setIsDrawerOpen(true)}
                    data-testid="add-songs-button"
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
                    items={selectedSongs.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      data-testid="practice-songs-list"
                      className="space-y-2"
                    >
                      {selectedSongs.map(item => (
                        <SortableSongItem
                          key={item.id}
                          item={item}
                          onRemove={removeSongFromPractice}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
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
      </div>
    </ContentLoadingSpinner>
  )
}
