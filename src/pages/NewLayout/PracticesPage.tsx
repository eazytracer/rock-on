import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ModernLayout } from '../../components/layout/ModernLayout'
import { useAuth } from '../../contexts/AuthContext'
import { TimePicker } from '../../components/common/TimePicker'
import { DurationPicker } from '../../components/common/DurationPicker'
import {
  ChevronDown,
  Plus,
  Clock,
  MapPin,
  Music,
  Calendar,
  MoreVertical,
  X,
  Check,
  AlertCircle,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
} from 'lucide-react'

// ===== DATABASE IMPORTS =====
import {
  useUpcomingPractices,
  useCreatePractice,
  useUpdatePractice,
  useDeletePractice,
  useAutoSuggestSongs,
} from '../../hooks/usePractices'
import { useSongs } from '../../hooks/useSongs'
import {
  formatShowDate,
  formatTime12Hour,
  parseTime12Hour,
} from '../../utils/dateHelpers'
import type { PracticeSession } from '../../models/PracticeSession'
import type { Song } from '../../models/Song'
import type { SessionSong } from '../../types'
// PHASE 2: Sync status visualization
import { SyncIcon } from '../../components/sync/SyncIcon'
import { useItemStatus } from '../../hooks/useItemSyncStatus'

// ===== INTERFACES =====

// Helper interface for song display with loaded data
interface SongWithDetails extends Song {
  displayDuration: string
}

// ===== CARD COMPONENTS =====

// PHASE 2: Practice card component with sync status
interface PracticeCardProps {
  practice: PracticeSession
  songs: SongWithDetails[]
  isNextPractice: boolean
  getStatusBadge: (status: PracticeSession['status']) => JSX.Element
  formatShowDate: (date: Date) => string
  formatTime12Hour: (date: Date) => string
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  onEdit: () => void
  onMarkComplete: () => void | Promise<void>
  onCancel: () => void | Promise<void>
  onDelete: () => void
}

const PracticeCard: React.FC<PracticeCardProps> = ({
  practice,
  songs,
  isNextPractice,
  getStatusBadge,
  formatShowDate,
  formatTime12Hour,
  openMenuId,
  setOpenMenuId,
  onEdit,
  onMarkComplete,
  onCancel,
  onDelete,
}) => {
  // PHASE 2: Get sync status for this practice
  const syncStatus = useItemStatus(practice.id)

  return (
    <div
      data-testid={`practice-item-${practice.id}`}
      className={`p-5 bg-[#1a1a1a] rounded-xl border transition-all ${
        isNextPractice
          ? 'border-[#f17827ff]/30'
          : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        {/* Left: Date Badge */}
        <div className="flex items-start gap-4">
          {/* PHASE 2: Sync Icon */}
          <div className="flex-shrink-0 mt-1">
            <SyncIcon status={syncStatus} size="sm" />
          </div>

          <div
            className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] rounded-lg ${
              practice.status === 'scheduled'
                ? 'bg-[#f17827ff]/10 border border-[#f17827ff]/20'
                : practice.status === 'completed'
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-[#2a2a2a] border border-[#3a3a3a]'
            }`}
          >
            <div
              className={`text-xs font-semibold uppercase ${
                practice.status === 'scheduled'
                  ? 'text-[#f17827ff]'
                  : practice.status === 'completed'
                    ? 'text-green-500'
                    : 'text-[#707070]'
              }`}
            >
              {new Date(practice.scheduledDate).toLocaleDateString('en-US', {
                weekday: 'short',
              })}
            </div>
            <div
              className={`text-2xl font-bold ${
                practice.status === 'scheduled'
                  ? 'text-[#f17827ff]'
                  : practice.status === 'completed'
                    ? 'text-green-500'
                    : 'text-[#707070]'
              }`}
            >
              {new Date(practice.scheduledDate).getDate()}
            </div>
          </div>

          {/* Practice Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-white font-semibold text-base">
                {formatShowDate(new Date(practice.scheduledDate))}
              </h3>
              {getStatusBadge(practice.status)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#a0a0a0] mb-3">
              <div className="flex items-center gap-1">
                <Clock size={14} />
                {formatTime12Hour(new Date(practice.scheduledDate))} •{' '}
                {practice.duration} min
              </div>
              {practice.location && (
                <div className="flex items-center gap-1">
                  <MapPin size={14} />
                  {practice.location}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Music size={14} />
                {songs.length} song{songs.length !== 1 ? 's' : ''}
              </div>
            </div>
            {practice.notes && (
              <p className="text-sm text-[#a0a0a0] mb-3">{practice.notes}</p>
            )}

            {/* Song List */}
            {songs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {songs.map((song, index) => (
                  <div
                    key={`${practice.id}-${song.id}`}
                    className="flex items-center gap-2 px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-xs"
                  >
                    <span className="text-[#707070] font-semibold">
                      {index + 1}.
                    </span>
                    <span className="text-white">{song.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions Menu */}
        <div className="relative">
          <button
            onClick={() =>
              setOpenMenuId(openMenuId === practice.id ? null : practice.id)
            }
            className="p-2 text-[#707070] hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
          >
            <MoreVertical size={20} />
          </button>

          {/* Dropdown Menu */}
          {openMenuId === practice.id && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-10">
              <button
                onClick={onEdit}
                data-testid={`edit-practice-${practice.id}`}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-white text-sm hover:bg-[#252525] transition-colors"
              >
                <Edit2 size={16} />
                Edit
              </button>
              {practice.status === 'scheduled' && (
                <button
                  onClick={onMarkComplete}
                  data-testid={`complete-practice-${practice.id}`}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-white text-sm hover:bg-[#252525] transition-colors"
                >
                  <CheckCircle size={16} />
                  Mark as Completed
                </button>
              )}
              {practice.status === 'scheduled' && (
                <button
                  onClick={onCancel}
                  data-testid={`cancel-practice-${practice.id}`}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-white text-sm hover:bg-[#252525] transition-colors border-t border-[#2a2a2a]"
                >
                  <XCircle size={16} />
                  Cancel Practice
                </button>
              )}
              <button
                onClick={onDelete}
                data-testid={`delete-practice-${practice.id}`}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-500 text-sm hover:bg-[#252525] transition-colors border-t border-[#2a2a2a]"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== MODAL COMPONENTS =====

interface SchedulePracticeModalProps {
  isOpen: boolean
  onClose: () => void
  practice?: PracticeSession
  onSave: (practice: Partial<PracticeSession>) => Promise<void>
  bandId: string
}

const SchedulePracticeModal: React.FC<SchedulePracticeModalProps> = ({
  isOpen,
  onClose,
  practice,
  onSave,
  bandId,
}) => {
  // DATABASE: Load songs using useSongs hook instead of direct queries
  const { songs: allSongs } = useSongs(bandId)
  const [_suggestedSongIds, setSuggestedSongIds] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const { getSuggestions } = useAutoSuggestSongs(bandId)

  const [formData, setFormData] = useState({
    date: practice?.scheduledDate
      ? new Date(practice.scheduledDate).toISOString().split('T')[0]
      : '',
    time: practice?.scheduledDate
      ? formatTime12Hour(new Date(practice.scheduledDate))
      : '',
    duration: practice?.duration || 120,
    location: practice?.location || '',
    notes: practice?.notes || '',
    selectedSongs: practice?.songs.map(s => s.songId) || [],
  })

  const [songSearchQuery, setShowSongSearch] = useState(false)
  const [songFilter, setSongFilter] = useState('')

  // Songs are now loaded via useSongs hook above - no need for useEffect

  // DATABASE: Load song suggestions from upcoming shows
  const loadSuggestionsFromShows = async () => {
    try {
      setLoadingSuggestions(true)
      const songIds = await getSuggestions()
      setSuggestedSongIds(songIds)

      // Add suggested songs to selected songs
      setFormData(prev => ({
        ...prev,
        selectedSongs: [...new Set([...prev.selectedSongs, ...songIds])],
      }))
    } catch (error) {
      console.error('Error loading suggestions:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // DATABASE: Parse time and create proper Date
      const baseDate = new Date(formData.date)
      const datetime = parseTime12Hour(formData.time, baseDate)

      // DATABASE: Create SessionSong objects with proper structure
      const sessionSongs: SessionSong[] = formData.selectedSongs.map(
        songId => ({
          songId,
          timeSpent: 0,
          status: 'not-started' as const,
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        })
      )

      await onSave({
        scheduledDate: datetime,
        duration: formData.duration,
        location: formData.location,
        type: 'rehearsal',
        status: 'scheduled',
        songs: sessionSongs,
        notes: formData.notes,
        objectives: practice?.objectives || [],
        completedObjectives: practice?.completedObjectives || [],
      })
      onClose()
    } catch (error) {
      console.error('Error saving practice:', error)
      alert('Failed to save practice. Please try again.')
    }
  }

  const toggleSong = (songId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSongs: prev.selectedSongs.includes(songId)
        ? prev.selectedSongs.filter(id => id !== songId)
        : [...prev.selectedSongs, songId],
    }))
  }

  const removeSong = (songId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSongs: prev.selectedSongs.filter(id => id !== songId),
    }))
  }

  // DATABASE: Format duration helper
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // DATABASE: Get selected songs with formatted data
  const selectedSongObjects = formData.selectedSongs
    .map(id => {
      const song = allSongs.find(s => s.id === id)
      if (!song) return null
      return {
        ...song,
        displayDuration: formatDuration(song.duration),
      }
    })
    .filter(Boolean) as SongWithDetails[]

  // DATABASE: Filter songs for search
  const filteredSongs = allSongs.filter(
    song =>
      song.title.toLowerCase().includes(songFilter.toLowerCase()) ||
      song.artist.toLowerCase().includes(songFilter.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        data-testid="practice-modal"
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white font-medium">Practices</span>
            <span className="text-[#707070]">&gt;</span>
            <span className="text-[#a0a0a0]">
              {practice ? 'Edit Practice' : 'Schedule Practice'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#707070] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Info Section */}
          <div className="mb-6">
            <h3 className="text-white font-semibold text-sm mb-4">
              Basic Info
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Date <span className="text-[#f17827ff]">*</span>
                </label>
                <input
                  type="date"
                  name="practiceDate"
                  id="practice-date"
                  data-testid="practice-date-input"
                  required
                  value={formData.date}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Time <span className="text-[#f17827ff]">*</span>
                </label>
                <TimePicker
                  name="practiceTime"
                  id="practice-time"
                  data-testid="practice-time-input"
                  value={formData.time}
                  onChange={time => setFormData(prev => ({ ...prev, time }))}
                  placeholder="Select time"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Duration
                </label>
                <DurationPicker
                  value={formData.duration}
                  onChange={minutes =>
                    setFormData(prev => ({ ...prev, duration: minutes }))
                  }
                  placeholder="Select duration"
                  mode="duration"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  id="practice-location"
                  data-testid="practice-location-input"
                  value={formData.location}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="e.g., Dave's Garage"
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm text-[#a0a0a0] mb-2">Notes</label>
              <textarea
                name="notes"
                id="practice-notes"
                data-testid="practice-notes-textarea"
                value={formData.notes}
                onChange={e =>
                  setFormData(prev => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Add any notes about this practice..."
                rows={3}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 resize-none"
              />
            </div>
          </div>

          {/* Songs Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">
                Songs to Practice
              </h3>
              {/* DATABASE: Auto-suggest button */}
              <button
                type="button"
                onClick={loadSuggestionsFromShows}
                disabled={loadingSuggestions}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-[#f17827ff] text-xs font-medium hover:bg-[#252525] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingSuggestions ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Calendar size={14} />
                    Add from Upcoming Shows
                  </>
                )}
              </button>
            </div>

            {/* Selected Songs */}
            {selectedSongObjects.length > 0 && (
              <div data-testid="selected-songs-list" className="mb-3 space-y-2">
                {selectedSongObjects.map((song, index) => (
                  <div
                    key={song.id}
                    data-testid={`selected-song-${song.id}`}
                    className="flex items-center gap-3 p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2a2a2a] text-[#a0a0a0] text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">
                        {song.title}
                      </div>
                      <div className="text-[#707070] text-xs">
                        {song.artist} • {song.displayDuration}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSong(song.id)}
                      data-testid={`remove-song-${song.id}`}
                      className="p-1 text-[#707070] hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Songs Button */}
            <button
              type="button"
              onClick={() => setShowSongSearch(!songSearchQuery)}
              className="w-full h-10 flex items-center justify-center gap-2 border border-dashed border-[#2a2a2a] rounded-lg text-[#a0a0a0] text-sm hover:border-[#f17827ff] hover:text-[#f17827ff] transition-colors"
            >
              <Plus size={16} />
              Add Songs
            </button>

            {/* Song Selector */}
            {songSearchQuery && (
              <div className="mt-3 p-4 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg">
                <div className="mb-3">
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]"
                    />
                    <input
                      type="text"
                      placeholder="Search songs..."
                      value={songFilter}
                      onChange={e => setSongFilter(e.target.value)}
                      className="w-full h-9 pl-10 pr-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredSongs.map(song => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => toggleSong(song.id)}
                      data-testid={`available-song-${song.id}`}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-left"
                    >
                      <div
                        className={`flex items-center justify-center w-5 h-5 rounded border ${
                          formData.selectedSongs.includes(song.id)
                            ? 'bg-[#f17827ff] border-[#f17827ff]'
                            : 'border-[#2a2a2a]'
                        }`}
                      >
                        {formData.selectedSongs.includes(song.id) && (
                          <Check size={12} className="text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-sm">{song.title}</div>
                        <div className="text-[#707070] text-xs">
                          {song.artist}
                        </div>
                      </div>
                      <div className="text-[#707070] text-xs">
                        {formatDuration(song.duration)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSongObjects.length > 0 && (
              <div className="mt-3 text-xs text-[#707070]">
                {selectedSongObjects.length} song
                {selectedSongObjects.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#2a2a2a]">
            <button
              type="button"
              onClick={onClose}
              data-testid="cancel-practice-button"
              className="px-6 py-2.5 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="save-practice-button"
              className="px-6 py-2.5 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66920] transition-colors"
            >
              {practice ? 'Save Changes' : 'Schedule Practice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  practiceName: string
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  practiceName,
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        data-testid="delete-practice-modal"
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <h3 className="text-white font-semibold text-lg">
              Delete Practice
            </h3>
          </div>
          <p className="text-[#a0a0a0] text-sm mb-6">
            Are you sure you want to delete the practice on{' '}
            <span className="text-white font-medium">{practiceName}</span>? This
            action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              data-testid="cancel-delete-practice"
              className="px-4 py-2 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm()
                onClose()
              }}
              data-testid="confirm-delete-practice"
              className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== MAIN COMPONENT =====

export const PracticesPage: React.FC = () => {
  const navigate = useNavigate()

  // Get auth context for user info and sign out
  const { currentUser, currentBand, signOut } = useAuth()

  // DATABASE: Get current band ID from localStorage
  const [currentBandId] = useState(
    () => localStorage.getItem('currentBandId') || ''
  )

  // DATABASE: Use hooks to load and manage practices
  const { upcomingPractices, pastPractices, loading, error } =
    useUpcomingPractices(currentBandId)
  const { createPractice } = useCreatePractice()
  const { updatePractice } = useUpdatePractice()
  const { deletePractice } = useDeletePractice()

  // DATABASE: Load songs using hook instead of direct queries
  const { songs: allBandSongs } = useSongs(currentBandId)

  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingPractice, setEditingPractice] =
    useState<PracticeSession | null>(null)
  const [deleteConfirmPractice, setDeleteConfirmPractice] =
    useState<PracticeSession | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const now = new Date()

  const handleSignOut = async () => {
    // signOut() now calls logout() internally to clear all state
    await signOut()
    navigate('/auth')
  }

  // DATABASE: Combine and filter practices based on filter
  const allPractices = [...upcomingPractices, ...pastPractices]
  const filteredPractices = allPractices
    .filter(practice => {
      if (filter === 'upcoming')
        return (
          new Date(practice.scheduledDate) > now &&
          practice.status === 'scheduled'
        )
      if (filter === 'past')
        return (
          new Date(practice.scheduledDate) <= now ||
          practice.status === 'completed' ||
          practice.status === 'cancelled'
        )
      return true
    })
    .sort((a, b) => {
      const dateA = new Date(a.scheduledDate).getTime()
      const dateB = new Date(b.scheduledDate).getTime()
      return filter === 'upcoming' ? dateA - dateB : dateB - dateA
    })

  const nextPractice = upcomingPractices[0]

  // DATABASE: Songs are now loaded via useSongs hook - no need for separate useEffect

  // DATABASE: Format duration helper
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // DATABASE: Save practice (create or update)
  const handleSavePractice = async (practiceData: Partial<PracticeSession>) => {
    try {
      if (editingPractice) {
        // DATABASE: Update existing practice
        await updatePractice(editingPractice.id, practiceData)
        setEditingPractice(null)
        alert('Practice updated successfully!')
      } else {
        // DATABASE: Create new practice
        await createPractice({
          ...practiceData,
          bandId: currentBandId,
          type: 'rehearsal',
          status: 'scheduled',
          attendees: [],
          objectives: [],
          completedObjectives: [],
        })
        alert('Practice scheduled successfully!')
      }
      setIsScheduleModalOpen(false)
      // Hook automatically updates practice list - no manual refresh needed
    } catch (error) {
      console.error('Error saving practice:', error)
      alert('Failed to save practice. Please try again.')
    }
  }

  // DATABASE: Delete practice
  const handleDeletePractice = async (id: string) => {
    try {
      await deletePractice(id)
      alert('Practice deleted successfully!')
      // Hook automatically updates practice list - no manual refresh needed
    } catch (error) {
      console.error('Error deleting practice:', error)
      alert('Failed to delete practice. Please try again.')
    }
  }

  // DATABASE: Mark practice as completed
  const handleMarkComplete = async (id: string) => {
    try {
      await updatePractice(id, { status: 'completed' })
      setOpenMenuId(null)
      alert('Practice marked as completed!')
      // Hook automatically updates practice list - no manual refresh needed
    } catch (error) {
      console.error('Error updating practice:', error)
      alert('Failed to update practice. Please try again.')
    }
  }

  // DATABASE: Cancel practice
  const handleCancelPractice = async (id: string) => {
    try {
      await updatePractice(id, { status: 'cancelled' })
      setOpenMenuId(null)
      alert('Practice cancelled!')
      // Hook automatically updates practice list - no manual refresh needed
    } catch (error) {
      console.error('Error updating practice:', error)
      alert('Failed to cancel practice. Please try again.')
    }
  }

  // DATABASE: Get songs for a practice using hook data
  const getSongsForPractice = (
    practice: PracticeSession
  ): SongWithDetails[] => {
    return practice.songs
      .map(sessionSong => {
        const song = allBandSongs.find(s => s.id === sessionSong.songId)
        if (!song) return null
        return {
          ...song,
          displayDuration: formatDuration(song.duration),
        }
      })
      .filter(Boolean) as SongWithDetails[]
  }

  const getStatusBadge = (status: PracticeSession['status']): JSX.Element => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="px-2 py-1 bg-[#f17827ff]/10 text-[#f17827ff] text-xs font-medium rounded-md">
            Scheduled
          </span>
        )
      case 'completed':
        return (
          <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded-md">
            Completed
          </span>
        )
      case 'cancelled':
        return (
          <span className="px-2 py-1 bg-red-500/10 text-red-500 text-xs font-medium rounded-md">
            Cancelled
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 bg-[#505050]/10 text-[#505050] text-xs font-medium rounded-md">
            Unknown
          </span>
        )
    }
  }

  // DATABASE: Show loading state
  if (loading) {
    return (
      <ModernLayout
        bandName={currentBand?.name || 'No Band Selected'}
        userEmail={currentUser?.email || 'Not logged in'}
        onSignOut={handleSignOut}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 size={48} className="text-[#f17827ff] animate-spin" />
        </div>
      </ModernLayout>
    )
  }

  // DATABASE: Show error state
  if (error) {
    return (
      <ModernLayout
        bandName={currentBand?.name || 'No Band Selected'}
        userEmail={currentUser?.email || 'Not logged in'}
        onSignOut={handleSignOut}
      >
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle size={48} className="text-red-500 mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">
            Error Loading Practices
          </h3>
          <p className="text-[#a0a0a0] text-sm">{error.message}</p>
        </div>
      </ModernLayout>
    )
  }

  return (
    <ModernLayout
      bandName={currentBand?.name || 'No Band Selected'}
      userEmail={currentUser?.email || 'Not logged in'}
      onSignOut={handleSignOut}
    >
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold text-white">Practices</h1>
          <ChevronDown size={20} className="text-[#a0a0a0]" />
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Filter Dropdown */}
          <div className="relative">
            <select
              value={filter}
              onChange={e =>
                setFilter(e.target.value as 'upcoming' | 'past' | 'all')
              }
              className="h-10 pl-4 pr-10 bg-transparent border border-[#2a2a2a] rounded-lg text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors appearance-none cursor-pointer"
            >
              <option value="upcoming" className="bg-[#1a1a1a]">
                Upcoming
              </option>
              <option value="past" className="bg-[#1a1a1a]">
                Past
              </option>
              <option value="all" className="bg-[#1a1a1a]">
                All
              </option>
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707070] pointer-events-none"
            />
          </div>

          {/* Schedule Practice Button */}
          <button
            onClick={() => {
              setEditingPractice(null)
              setIsScheduleModalOpen(true)
            }}
            data-testid="create-practice-button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors ml-auto"
          >
            <Plus size={20} />
            <span>Schedule Practice</span>
          </button>
        </div>
      </div>

      {/* Next Practice Highlight */}
      {nextPractice && filter === 'upcoming' && (
        <div className="mb-6 p-5 bg-gradient-to-r from-[#f17827ff]/10 to-transparent border border-[#f17827ff]/20 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-[#f17827ff]" />
                <span className="text-[#f17827ff] text-xs font-semibold uppercase tracking-wider">
                  Next Practice
                </span>
              </div>
              <div className="text-white font-semibold text-lg mb-1">
                {formatShowDate(new Date(nextPractice.scheduledDate))} at{' '}
                {formatTime12Hour(new Date(nextPractice.scheduledDate))}
              </div>
              <div className="flex items-center gap-4 text-sm text-[#a0a0a0]">
                {nextPractice.location && (
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    {nextPractice.location}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  {nextPractice.duration} min
                </div>
                <div className="flex items-center gap-1">
                  <Music size={14} />
                  {nextPractice.songs.length} songs
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Practices List */}
      {filteredPractices.length === 0 ? (
        /* Empty State */
        <div
          data-testid="practice-empty-state"
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#1a1a1a] mb-4">
            <Calendar size={32} className="text-[#707070]" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">
            No practices scheduled
          </h3>
          <p className="text-[#a0a0a0] text-sm mb-6">
            Schedule your first practice to get started
          </p>
          <button
            onClick={() => {
              setEditingPractice(null)
              setIsScheduleModalOpen(true)
            }}
            data-testid="create-practice-button"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
          >
            <Plus size={20} />
            Schedule Practice
          </button>
        </div>
      ) : (
        <div data-testid="practice-list" className="space-y-3">
          {filteredPractices.map(practice => {
            const songs = getSongsForPractice(practice)
            const isNextPractice = practice.id === nextPractice?.id

            return (
              <PracticeCard
                key={practice.id}
                practice={practice}
                songs={songs}
                isNextPractice={isNextPractice}
                getStatusBadge={getStatusBadge}
                formatShowDate={formatShowDate}
                formatTime12Hour={formatTime12Hour}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                onEdit={() => {
                  setEditingPractice(practice)
                  setIsScheduleModalOpen(true)
                  setOpenMenuId(null)
                }}
                onMarkComplete={() => handleMarkComplete(practice.id)}
                onCancel={() => handleCancelPractice(practice.id)}
                onDelete={() => {
                  setDeleteConfirmPractice(practice)
                  setOpenMenuId(null)
                }}
              />
            )
          })}
        </div>
      )}

      {/* Schedule Practice Modal */}
      <SchedulePracticeModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false)
          setEditingPractice(null)
        }}
        practice={editingPractice || undefined}
        onSave={handleSavePractice}
        bandId={currentBandId}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirmPractice !== null}
        onClose={() => setDeleteConfirmPractice(null)}
        onConfirm={async () => {
          if (deleteConfirmPractice) {
            await handleDeletePractice(deleteConfirmPractice.id)
            setDeleteConfirmPractice(null)
          }
        }}
        practiceName={
          deleteConfirmPractice
            ? formatShowDate(new Date(deleteConfirmPractice.scheduledDate))
            : ''
        }
      />
    </ModernLayout>
  )
}
