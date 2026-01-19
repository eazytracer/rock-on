import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { useToast } from '../contexts/ToastContext'
import {
  ChevronDown,
  Plus,
  Clock,
  MapPin,
  Music,
  Calendar,
  MoreVertical,
  AlertCircle,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { CalendarDateBadge } from '../components/common/CalendarDateBadge'

// ===== DATABASE IMPORTS =====
import {
  useUpcomingPractices,
  useUpdatePractice,
  useDeletePractice,
} from '../hooks/usePractices'
import { useSongs } from '../hooks/useSongs'
import { formatShowDate, formatTime12Hour } from '../utils/dateHelpers'
import type { PracticeSession } from '../models/PracticeSession'
import type { Song } from '../models/Song'

// Helper to calculate end time from start time and duration
const formatTimeRange = (startDate: Date, durationMinutes: number): string => {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
  return `${formatTime12Hour(startDate)} - ${formatTime12Hour(endDate)}`
}
// PHASE 2: Sync status visualization
import { SyncIcon } from '../components/sync/SyncIcon'
import { useItemStatus } from '../hooks/useItemSyncStatus'

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
  getStatusBadge: (status: PracticeSession['status']) => JSX.Element
  formatShowDate: (date: Date) => string
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  onClick: () => void
  onEdit: () => void
  onMarkComplete: () => void | Promise<void>
  onCancel: () => void | Promise<void>
  onDelete: () => void
}

const PracticeCard: React.FC<PracticeCardProps> = ({
  practice,
  songs,
  getStatusBadge,
  formatShowDate,
  openMenuId,
  setOpenMenuId,
  onClick,
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
      onClick={onClick}
      className="p-5 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        {/* Left: Date Badge with Sync Icon */}
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-2">
            <CalendarDateBadge
              date={practice.scheduledDate}
              variant={
                practice.status === 'scheduled'
                  ? 'active'
                  : practice.status === 'completed'
                    ? 'completed'
                    : 'cancelled'
              }
              size="md"
            />
            <SyncIcon status={syncStatus} size="sm" />
          </div>

          {/* Practice Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-white font-semibold text-base">
                {formatShowDate(new Date(practice.scheduledDate))}
              </h3>
              {getStatusBadge(practice.status)}
            </div>
            {/* Time Range - Prominent */}
            <div className="flex items-center gap-2 text-white font-medium mb-2">
              <Clock size={16} className="text-[#f17827ff]" />
              <span>
                {formatTimeRange(
                  new Date(practice.scheduledDate),
                  practice.duration
                )}
              </span>
            </div>
            {/* Other details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#a0a0a0] mb-3">
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
        <div className="relative" onClick={e => e.stopPropagation()}>
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

  const { showToast } = useToast()

  // DATABASE: Get current band ID from localStorage
  const [currentBandId] = useState(
    () => localStorage.getItem('currentBandId') || ''
  )

  // DATABASE: Use hooks to load and manage practices
  const { upcomingPractices, pastPractices, loading, error } =
    useUpcomingPractices(currentBandId)
  const { updatePractice } = useUpdatePractice()
  const { deletePractice } = useDeletePractice()

  // DATABASE: Load songs using hook instead of direct queries
  const { songs: allBandSongs } = useSongs(currentBandId)

  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [deleteConfirmPractice, setDeleteConfirmPractice] =
    useState<PracticeSession | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const now = new Date()

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

  // DATABASE: Delete practice
  const handleDeletePractice = async (id: string) => {
    try {
      await deletePractice(id)
      showToast('Practice deleted', 'success')
      // Hook automatically updates practice list - no manual refresh needed
    } catch (error) {
      console.error('Error deleting practice:', error)
      showToast('Failed to delete practice', 'error')
    }
  }

  // DATABASE: Mark practice as completed
  const handleMarkComplete = async (id: string) => {
    try {
      await updatePractice(id, { status: 'completed' })
      setOpenMenuId(null)
      showToast('Practice marked as completed', 'success')
      // Hook automatically updates practice list - no manual refresh needed
    } catch (error) {
      console.error('Error updating practice:', error)
      showToast('Failed to update practice', 'error')
    }
  }

  // DATABASE: Cancel practice
  const handleCancelPractice = async (id: string) => {
    try {
      await updatePractice(id, { status: 'cancelled' })
      setOpenMenuId(null)
      showToast('Practice cancelled', 'success')
      // Hook automatically updates practice list - no manual refresh needed
    } catch (error) {
      console.error('Error updating practice:', error)
      showToast('Failed to cancel practice', 'error')
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

  // RENDER
  return (
    <ContentLoadingSpinner isLoading={loading}>
      <div data-testid="practices-page" className="max-w-6xl mx-auto">
        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <h3 className="text-white font-semibold text-lg mb-2">
              Error Loading Practices
            </h3>
            <p className="text-[#a0a0a0] text-sm">{error.message}</p>
          </div>
        )}
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
              onClick={() => navigate('/practices/new')}
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
          <div className="mb-6 p-6 bg-gradient-to-br from-[#f17827ff]/10 to-transparent border-2 border-[#f17827ff]/30 rounded-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs font-semibold text-[#f17827ff] uppercase tracking-wider mb-1">
                  Next Practice
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {formatShowDate(new Date(nextPractice.scheduledDate))}
                </h2>
                <div className="text-lg text-[#f17827ff] font-semibold">
                  {formatTimeRange(
                    new Date(nextPractice.scheduledDate),
                    nextPractice.duration
                  )}
                </div>
              </div>
              {getStatusBadge(nextPractice.status)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-white">
                <Clock size={20} className="text-[#f17827ff]" />
                <div>
                  <div className="text-sm font-medium">Duration</div>
                  <div className="text-xs text-[#a0a0a0]">
                    {nextPractice.duration} minutes
                  </div>
                </div>
              </div>

              {nextPractice.location && (
                <div className="flex items-center gap-3 text-white">
                  <MapPin size={20} className="text-[#f17827ff]" />
                  <div>
                    <div className="text-sm font-medium">
                      {nextPractice.location}
                    </div>
                    <div className="text-xs text-[#a0a0a0]">Location</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-white">
                <Music size={20} className="text-[#f17827ff]" />
                <div>
                  <div className="text-sm font-medium">
                    {nextPractice.songs.length} songs
                  </div>
                  <div className="text-xs text-[#a0a0a0]">To practice</div>
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
              onClick={() => navigate('/practices/new')}
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

              return (
                <PracticeCard
                  key={practice.id}
                  practice={practice}
                  songs={songs}
                  getStatusBadge={getStatusBadge}
                  formatShowDate={formatShowDate}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  onClick={() => navigate(`/practices/${practice.id}`)}
                  onEdit={() => {
                    navigate(`/practices/${practice.id}/edit`)
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
      </div>
    </ContentLoadingSpinner>
  )
}
