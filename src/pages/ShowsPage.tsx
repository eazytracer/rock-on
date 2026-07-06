/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { BandRequiredPrompt } from '../components/common/BandRequiredPrompt'
import { useToast } from '../contexts/ToastContext'
import { DatePicker } from '../components/common/DatePicker'
import { TimePickerDropdown } from '../components/common/TimePickerDropdown'
import { CalendarDateBadge } from '../components/common/CalendarDateBadge'
import {
  Plus,
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Music,
  Phone,
  MoreVertical,
  X,
  ChevronDown,
  Filter as FilterIcon,
  AlertCircle,
  Edit2,
  Trash2,
  User,
  FileText,
  ChevronRight,
  Guitar,
  Activity,
} from 'lucide-react'

// ============================================
// DATABASE & UTILITIES - REAL IMPORTS
// ============================================
import { db } from '../services/database'
import {
  useUpcomingShows,
  useCreateShow,
  useUpdateShow,
  useDeleteShow,
} from '../hooks/useShows'
import { SetlistService } from '../services/SetlistService'
import { centsToDollars, dollarsToCents } from '../utils/formatters'
import {
  formatShowDate,
  formatTime12Hour,
  parseTime12Hour,
  formatDateForInput,
  parseDateAsLocal,
} from '../utils/dateHelpers'
import type { Setlist } from '../models/Setlist'
// PHASE 2: Sync status visualization
import { SyncIcon } from '../components/sync/SyncIcon'
import { useItemStatus } from '../hooks/useItemSyncStatus'

// ============================================
// TYPES - UPDATED FOR DATABASE INTEGRATION
// ============================================
// Import Show and ShowContact from correct model
import { Show, ShowContact } from '../models/Show'
import { Badge } from '../components/common/Badge'
import { SHOW_TONE, type BadgeTone } from '../utils/tokens'

interface Song {
  id: string
  title: string
  artist: string
  duration: string
  durationSeconds: number
  key: string
  tuning: string
  bpm: string
}

interface SetlistSong extends Song {
  position: number
}

// @ts-expect-error - Intentionally unused
// Reserved for future use
interface _SetlistWithSongs {
  id: string
  name: string
  songs: SetlistSong[]
  totalDuration: string
  songCount: number
}

// Show is already properly typed in the Show model, no need for extension

type FilterType =
  | 'all'
  | 'upcoming'
  | 'past'
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'

// ============================================
// MOCK DATA REMOVED - NOW USING REAL DATABASE
// ============================================
// All mock shows, setlists, and songs have been replaced with database operations

export const ShowsPage: React.FC = () => {
  const navigate = useNavigate()

  const { showToast } = useToast()

  // ============================================
  // DATABASE STATE & HOOKS - REAL INTEGRATION
  // ============================================
  const currentBandId = localStorage.getItem('currentBandId') || ''
  const { upcomingShows, pastShows, loading, error } =
    useUpcomingShows(currentBandId)
  const { createShow } = useCreateShow()
  const { updateShow } = useUpdateShow()
  const { deleteShow } = useDeleteShow()

  // UI State
  const [filter, setFilter] = useState<FilterType>('upcoming')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [showToDelete, setShowToDelete] = useState<Show | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [searchQuery] = useState('')

  // Setlist data for display (loaded dynamically)
  const [setlistsData, setSetlistsData] = useState<Record<string, Setlist>>({})
  const [availableSetlists, setAvailableSetlists] = useState<Setlist[]>([])

  // ============================================
  // LOAD SETLISTS FOR SHOWS - REAL DATABASE
  // ============================================
  useEffect(() => {
    const loadSetlists = async () => {
      try {
        // Load all setlists for the current band
        const allSetlists = await db.setlists
          .where('bandId')
          .equals(currentBandId)
          .toArray()

        setAvailableSetlists(allSetlists)

        // Build a map of setlistId -> setlist for quick lookup
        const setlistMap: Record<string, Setlist> = {}
        for (const setlist of allSetlists) {
          setlistMap[setlist.id] = setlist
        }
        setSetlistsData(setlistMap)
      } catch (err) {
        console.error('Error loading setlists:', err)
      }
    }

    if (currentBandId) {
      loadSetlists()
    }
  }, [currentBandId, upcomingShows, pastShows]) // Reload when shows change

  // ============================================
  // HELPER FUNCTIONS - UPDATED FOR DATABASE
  // ============================================
  const combineShows = (): Show[] => {
    return [...upcomingShows, ...pastShows]
  }

  const getFilteredShows = (): Show[] => {
    const now = new Date()
    let shows = combineShows()

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      shows = shows.filter(
        show =>
          show.name?.toLowerCase().includes(query) ||
          show.venue?.toLowerCase().includes(query) ||
          show.location?.toLowerCase().includes(query)
      )
    }

    // Apply status filter
    switch (filter) {
      case 'upcoming':
        return shows.filter(
          show =>
            new Date(show.scheduledDate) >= now && show.status !== 'cancelled'
        )
      case 'past':
        return shows.filter(
          show =>
            new Date(show.scheduledDate) < now || show.status === 'completed'
        )
      case 'scheduled':
        return shows.filter(show => show.status === 'scheduled')
      case 'confirmed':
        return shows.filter(show => show.status === 'confirmed')
      case 'completed':
        return shows.filter(show => show.status === 'completed')
      case 'cancelled':
        return shows.filter(show => show.status === 'cancelled')
      default:
        return shows
    }
  }

  const getNextShow = (): Show | null => {
    if (upcomingShows.length === 0) return null
    // upcomingShows is already sorted ascending by the hook
    return upcomingShows[0]
  }

  const getDaysUntilShow = (date: Date | string): string => {
    if (!date) return 'Date TBD'

    const showDate = typeof date === 'string' ? new Date(date) : date

    // Check for invalid date
    if (!showDate || isNaN(showDate.getTime())) {
      return 'Date TBD'
    }

    const now = new Date()
    const diff = showDate.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days < 0) return `${Math.abs(days)} days ago`
    return `In ${days} days`
  }

  const formatDate = (date: Date | string): string => {
    return formatShowDate(date)
  }

  // ============================================
  // CRUD HANDLERS - REAL DATABASE OPERATIONS
  // ============================================
  const handleDeleteShow = async (show: Show) => {
    try {
      await deleteShow(show.id)
      setShowToDelete(null)
      showToast('Show deleted', 'success')
    } catch (err) {
      console.error('Failed to delete show:', err)
      showToast('Failed to delete show', 'error')
    }
  }

  const handleEditShow = (show: Show) => {
    setSelectedShow(show)
    setIsScheduleModalOpen(true)
  }

  const nextShow = getNextShow()
  const filteredShows = getFilteredShows()

  // ============================================
  // RENDER
  // ============================================
  // Shows are a band feature — band-less users get a create/join-a-band prompt.
  if (!currentBandId) {
    return <BandRequiredPrompt feature="Shows" testid="shows-band-required" />
  }

  return (
    <ContentLoadingSpinner isLoading={loading}>
      <div data-testid="shows-page" className="max-w-6xl mx-auto">
        {/* Error state */}
        {error && (
          <div className="flex items-center justify-center py-16">
            <div className="text-red-500">
              Error loading shows: {error.message}
            </div>
          </div>
        )}
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Shows</h1>
              <ChevronDown size={20} className="text-ink-3" />
            </div>

            <div className="flex items-center gap-3">
              {/* Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-1 bg-transparent text-white text-sm font-medium hover:bg-bg-3 transition-colors"
                >
                  <FilterIcon size={20} />
                  <span className="capitalize">{filter}</span>
                </button>

                {isFilterOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-bg-2 border border-border-1 rounded-lg shadow-xl z-50 py-1">
                    {(
                      [
                        'all',
                        'upcoming',
                        'past',
                        'scheduled',
                        'confirmed',
                        'completed',
                        'cancelled',
                      ] as FilterType[]
                    ).map(filterOption => (
                      <button
                        key={filterOption}
                        onClick={() => {
                          setFilter(filterOption)
                          setIsFilterOpen(false)
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors capitalize ${
                          filter === filterOption
                            ? 'bg-accent/10 text-accent'
                            : 'text-white hover:bg-bg-4'
                        }`}
                      >
                        {filterOption}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate('/shows/new')}
                data-testid="create-show-button"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors"
              >
                <Plus size={20} />
                <span>Schedule Show</span>
              </button>
            </div>
          </div>
        </div>

        {/* Next Show Preview Card - UPDATED FOR DATABASE */}
        {nextShow && filter === 'upcoming' && (
          <div className="mb-6 p-6 bg-gradient-to-br from-accent/10 to-transparent border-2 border-accent/30 rounded-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">
                  Next Show
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {nextShow.name || 'Untitled Show'}
                </h2>
                <div className="text-lg text-accent font-semibold">
                  {getDaysUntilShow(nextShow.scheduledDate)}
                </div>
              </div>
              <ShowStatusBadge status={nextShow.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-white">
                <Calendar size={20} className="text-accent" />
                <div>
                  <div className="text-sm font-medium">
                    {formatDate(nextShow.scheduledDate)}
                  </div>
                  <div className="text-xs text-ink-3">
                    {formatTime12Hour(nextShow.scheduledDate)}
                  </div>
                </div>
              </div>

              {nextShow.venue && (
                <div className="flex items-center gap-3 text-white">
                  <MapPin size={20} className="text-accent" />
                  <div>
                    <div className="text-sm font-medium">{nextShow.venue}</div>
                    {nextShow.location && (
                      <div className="text-xs text-ink-3">
                        {nextShow.location}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {nextShow.setlistId && setlistsData[nextShow.setlistId] && (
                <div className="flex items-center gap-3 text-white">
                  <Music size={20} className="text-accent" />
                  <div>
                    <div className="text-sm font-medium">
                      {setlistsData[nextShow.setlistId].name}
                    </div>
                    <div className="text-xs text-ink-3">
                      {
                        setlistsData[nextShow.setlistId].items.filter(
                          i => i.type === 'song'
                        ).length
                      }{' '}
                      songs
                    </div>
                  </div>
                </div>
              )}

              {nextShow.payment !== undefined && nextShow.payment > 0 && (
                <div className="flex items-center gap-3 text-white">
                  <DollarSign size={20} className="text-accent" />
                  <div>
                    <div className="text-sm font-medium">
                      {centsToDollars(nextShow.payment)}
                    </div>
                    <div className="text-xs text-ink-3">Payment</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shows List - UPDATED FOR DATABASE */}
        {filteredShows.length === 0 ? (
          <EmptyState onSchedule={() => navigate('/shows/new')} />
        ) : (
          <div data-testid="show-list" className="space-y-3">
            {filteredShows
              .sort((a, b) => {
                const dateA = new Date(a.scheduledDate).getTime()
                const dateB = new Date(b.scheduledDate).getTime()
                // Sort descending for display
                return dateB - dateA
              })
              .map(show => (
                <ShowCard
                  key={show.id}
                  show={show}
                  setlist={
                    show.setlistId ? setlistsData[show.setlistId] || null : null
                  }
                  onClick={() => navigate(`/shows/${show.id}`)}
                  onEdit={() => handleEditShow(show)}
                  onDelete={() => setShowToDelete(show)}
                  getDaysUntilShow={getDaysUntilShow}
                />
              ))}
          </div>
        )}

        {/* Schedule/Edit Show Modal - UPDATED FOR DATABASE */}
        {isScheduleModalOpen && (
          <ScheduleShowModal
            show={selectedShow}
            availableSetlists={availableSetlists}
            onClose={() => {
              setIsScheduleModalOpen(false)
              setSelectedShow(null)
            }}
            onSave={async showData => {
              try {
                if (selectedShow) {
                  // Edit existing show
                  await updateShow(selectedShow.id, showData)
                  console.log('Show updated successfully')
                } else {
                  // Create new show with optional setlist forking
                  let forkedSetlistId: string | undefined = undefined

                  // If a setlist was selected, fork it for this show
                  if (showData.setlistId) {
                    try {
                      const forkedSetlist = await SetlistService.forkSetlist(
                        showData.setlistId,
                        showData.name || 'Show'
                      )
                      forkedSetlistId = forkedSetlist.id
                      console.log(
                        'Setlist forked successfully:',
                        forkedSetlist.name
                      )
                    } catch (forkError) {
                      console.error('Failed to fork setlist:', forkError)
                      // Continue creating show without setlist if fork fails
                    }
                  }

                  // Create the show with the forked setlist (if available)
                  const newShow = await createShow({
                    ...showData,
                    setlistId: forkedSetlistId, // Use forked setlist instead of original
                    bandId: currentBandId,
                  })

                  // Update the forked setlist to reference the show (bidirectional link)
                  if (forkedSetlistId && newShow?.id) {
                    try {
                      await SetlistService.updateSetlist(forkedSetlistId, {
                        showId: newShow.id,
                      })
                      console.log('Setlist linked to show successfully')
                    } catch (linkError) {
                      console.warn('Failed to link setlist to show:', linkError)
                      // Non-critical - show is created, just missing bidirectional link
                    }
                  }

                  console.log('Show created successfully')
                }
                setIsScheduleModalOpen(false)
                setSelectedShow(null)
              } catch (err) {
                console.error('Failed to save show:', err)
                showToast('Failed to save show', 'error')
              }
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showToDelete && (
          <DeleteConfirmationModal
            show={showToDelete}
            onConfirm={() => handleDeleteShow(showToDelete)}
            onCancel={() => setShowToDelete(null)}
          />
        )}
      </div>
    </ContentLoadingSpinner>
  )
}

// ============================================
// SHOW CARD COMPONENT - UPDATED FOR DATABASE
// ============================================
const ShowCard: React.FC<{
  show: Show
  setlist: Setlist | null
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  getDaysUntilShow: (date: Date | string) => string
}> = ({ show, setlist, onClick, onEdit, onDelete, getDaysUntilShow }) => {
  // PHASE 2: Get sync status for this show
  const syncStatus = useItemStatus(show.id)

  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [setlistSongs, setSetlistSongs] = useState<any[]>([])

  // Payment is stored as cents in database, no paymentStatus field
  const paymentAmount = show.payment ? centsToDollars(show.payment) : null

  const isUpcoming =
    new Date(show.scheduledDate) > new Date() && show.status !== 'cancelled'

  // Contacts is ALWAYS an array of ShowContact objects
  const contacts = show.contacts || []

  // ============================================
  // LOAD SETLIST SONGS FROM DATABASE
  // ============================================
  useEffect(() => {
    const loadSetlistSongs = async () => {
      if (!setlist) return

      try {
        const songs = []
        for (const item of setlist.items) {
          if (item.type === 'song' && item.songId) {
            const song = await db.songs.get(item.songId)
            if (song) {
              songs.push({
                ...song,
                position: item.position,
              })
            }
          }
        }
        setSetlistSongs(songs)
      } catch (err) {
        console.error('Error loading setlist songs:', err)
      }
    }

    if (isExpanded) {
      loadSetlistSongs()
    }
  }, [isExpanded, setlist])

  return (
    <div
      data-testid={`show-item-${show.id}`}
      className={`bg-bg-2 rounded-xl p-5 border transition-all cursor-pointer ${
        show.status === 'cancelled'
          ? 'border-border-1 opacity-60'
          : 'border-border-1 hover:border-border-2'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Date Badge */}
        <CalendarDateBadge
          date={show.scheduledDate}
          variant={
            show.status === 'cancelled'
              ? 'cancelled'
              : show.status === 'completed'
                ? 'completed'
                : isUpcoming
                  ? 'active'
                  : 'default'
          }
          size="md"
        />

        {/* Show Info */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3
                data-testid={`show-name-${show.id}`}
                className={`text-lg font-bold mb-1 ${
                  show.status === 'cancelled'
                    ? 'line-through text-ink-4'
                    : 'text-white'
                }`}
              >
                {show.name}
              </h3>
              {isUpcoming && (
                <div className="flex items-center gap-2 text-sm text-accent font-medium">
                  <span>{getDaysUntilShow(show.scheduledDate)}</span>
                  <SyncIcon status={syncStatus} size="sm" />
                </div>
              )}
              {!isUpcoming && (
                <div className="flex items-center gap-2">
                  <SyncIcon status={syncStatus} size="sm" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ShowStatusBadge status={show.status} />

              {/* Actions Menu */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setIsActionsOpen(!isActionsOpen)}
                  className="p-1.5 rounded-lg hover:bg-bg-4 transition-colors text-ink-3"
                >
                  <MoreVertical size={18} />
                </button>

                {isActionsOpen && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-bg-2 border border-border-1 rounded-lg shadow-xl z-50 py-1">
                    <button
                      onClick={() => {
                        onEdit()
                        setIsActionsOpen(false)
                      }}
                      data-testid={`edit-show-${show.id}`}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-bg-4 transition-colors flex items-center gap-2"
                    >
                      <Edit2 size={16} />
                      Edit Show
                    </button>
                    <button
                      onClick={() => {
                        onDelete()
                        setIsActionsOpen(false)
                      }}
                      data-testid={`delete-show-${show.id}`}
                      className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Time - Prominent */}
          <div className="flex items-center gap-2 text-white font-medium mb-3">
            <Clock size={16} className="text-accent" />
            <span>{formatTime12Hour(show.scheduledDate)}</span>
          </div>

          {/* Details Grid - UPDATED FOR DATABASE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {show.venue && (
              <div className="flex items-center gap-2 text-ink-3">
                <MapPin size={16} />
                <span className="truncate">{show.venue}</span>
              </div>
            )}

            {setlist && (
              <div className="flex items-center gap-2 text-ink-3">
                <Music size={16} />
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-accent hover:underline cursor-pointer flex items-center gap-1"
                >
                  {setlist.name}
                  <ChevronRight
                    size={14}
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
              </div>
            )}

            {paymentAmount && (
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-ink-3" />
                <span className="text-ink-3">{paymentAmount}</span>
              </div>
            )}

            {contacts && contacts.length > 0 && (
              <div className="flex items-center gap-2 text-ink-3">
                <User size={16} />
                <span className="truncate">{contacts[0].name}</span>
                {contacts[0].phone && (
                  <a
                    href={`tel:${contacts[0].phone}`}
                    className="text-accent hover:underline"
                  >
                    <Phone size={14} />
                  </a>
                )}
              </div>
            )}

            {show.duration && (
              <div className="flex items-center gap-2 text-ink-3">
                <Clock size={16} />
                <span>{show.duration} min set</span>
              </div>
            )}

            {show.loadInTime && (
              <div className="flex items-center gap-2 text-ink-3">
                <Clock size={16} />
                <span>Load-in: {show.loadInTime}</span>
              </div>
            )}

            {show.soundcheckTime && (
              <div className="flex items-center gap-2 text-ink-3">
                <Clock size={16} />
                <span>Soundcheck: {show.soundcheckTime}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {show.notes && (
            <div className="mt-3 pt-3 border-t border-border-1">
              <div className="flex items-start gap-2 text-sm text-ink-3">
                <FileText size={16} className="mt-0.5 flex-shrink-0" />
                <p className="line-clamp-2">{show.notes}</p>
              </div>
            </div>
          )}

          {/* Expanded Setlist View - UPDATED FOR DATABASE */}
          {isExpanded && setlist && (
            <div className="mt-4 pt-4 border-t border-border-1">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white">
                  Setlist Songs
                </h4>
                <div className="text-xs text-ink-3">
                  {setlistSongs.length} songs loaded
                </div>
              </div>
              <div className="space-y-2">
                {setlistSongs.map(song => (
                  <SetlistSongMiniCard key={song.id} song={song} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Mini Song Card Component for Expanded Setlist
const SetlistSongMiniCard: React.FC<{ song: SetlistSong }> = ({ song }) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-bg-1 rounded-lg border border-border-1 hover:border-border-2 transition-colors">
      {/* Position Number */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-border-1 flex items-center justify-center text-white text-sm font-semibold">
        {song.position}
      </div>

      {/* Song Info */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium text-sm truncate">
          {song.title}
        </div>
        <div className="text-ink-3 text-xs truncate">{song.artist}</div>
      </div>

      {/* Song Metadata */}
      <div className="flex items-center gap-3 text-xs text-ink-3">
        <div className="flex items-center gap-1">
          <Clock size={14} />
          <span>{song.duration}</span>
        </div>
        <div className="flex items-center gap-1">
          <Music size={14} />
          <span>{song.key}</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <Guitar size={14} />
          <span className="px-2 py-0.5 bg-border-1 rounded text-xs">
            {song.tuning}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <Activity size={14} />
          <span>{song.bpm} bpm</span>
        </div>
      </div>
    </div>
  )
}

// Status Badge Component
const ShowStatusBadge: React.FC<{ status: Show['status'] }> = ({ status }) => {
  return (
    <Badge
      tone={
        (SHOW_TONE[status as keyof typeof SHOW_TONE] ?? 'neutral') as BadgeTone
      }
      size="sm"
    >
      {status}
    </Badge>
  )
}

// ============================================
// SCHEDULE SHOW MODAL - UPDATED FOR DATABASE
// ============================================
export const ScheduleShowModal: React.FC<{
  show: Show | null
  availableSetlists: Setlist[]
  onClose: () => void
  onSave: (show: Partial<Show>) => void | Promise<void>
}> = ({ show, availableSetlists, onClose, onSave }) => {
  const { showToast } = useToast()

  // Initialize form data from show or defaults
  const [formData, setFormData] = useState({
    name: show?.name || '',
    date: show?.scheduledDate ? formatDateForInput(show.scheduledDate) : '',
    time: show?.scheduledDate ? formatTime12Hour(show.scheduledDate) : '',
    venue: show?.venue || '',
    location: show?.location || '',
    setlistId: show?.setlistId || '',
    loadInTime: show?.loadInTime || '',
    soundcheckTime: show?.soundcheckTime || '',
    duration: show?.duration?.toString() || '',
    paymentAmount: show?.payment ? (show.payment / 100).toString() : '',
    notes: show?.notes || '',
    status: show?.status || 'scheduled',
  })

  // Contacts is ALWAYS an array of ShowContact objects
  const initialContacts = show?.contacts || []
  const [contacts, setContacts] = useState<ShowContact[]>(initialContacts)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Parse time and combine with date to create full scheduledDate
      // Use parseDateAsLocal to avoid timezone issues (new Date("YYYY-MM-DD") parses as UTC)
      const baseDate = parseDateAsLocal(formData.date)
      const scheduledDate = formData.time
        ? parseTime12Hour(formData.time, baseDate)
        : baseDate

      // Convert payment from dollars to cents
      const paymentInCents = formData.paymentAmount
        ? dollarsToCents(formData.paymentAmount)
        : 0

      // Prepare show data for database
      const showData: Partial<Show> = {
        name: formData.name,
        scheduledDate: scheduledDate,
        venue: formData.venue || undefined,
        location: formData.location || undefined,
        setlistId: formData.setlistId || undefined,
        loadInTime: formData.loadInTime || undefined,
        soundcheckTime: formData.soundcheckTime || undefined,
        duration: formData.duration ? parseInt(formData.duration) : undefined,
        payment: paymentInCents || undefined,
        contacts: contacts.length > 0 ? contacts : undefined,
        notes: formData.notes || undefined,
        status: formData.status as Show['status'],
      }

      // NOTE: Setlist relationship is handled by passing setlistId in showData
      // The service layer will handle the bidirectional relationship
      // TODO: Once SetlistService is refactored, this should use useUpdateSetlist hook

      await onSave(showData)
    } catch (err) {
      console.error('Error saving show:', err)
      showToast('Failed to save show', 'error')
    }
  }

  const addContact = () => {
    setContacts([
      ...contacts,
      {
        id: crypto.randomUUID(),
        name: '',
        role: '',
        phone: '',
        email: '',
      },
    ])
  }

  const updateContact = (
    index: number,
    field: keyof ShowContact,
    value: string
  ) => {
    const updated = [...contacts]
    updated[index] = { ...updated[index], [field]: value }
    setContacts(updated)
  }

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        data-testid="show-modal"
        className="bg-bg-2 rounded-xl border border-border-1 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar-thin"
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-bg-2 border-b border-border-1 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {show ? 'Edit Show' : 'Schedule Show'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-4 transition-colors text-ink-3"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-ink-3 uppercase tracking-wider">
              Basic Info
            </h3>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Show/Event Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="showName"
                id="show-name"
                data-testid="show-name-input"
                required
                value={formData.name}
                onChange={e =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-1 border border-border-1 rounded-lg text-white placeholder-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="e.g., Toys 4 Tots Benefit"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <DatePicker
                  label="Date"
                  name="showDate"
                  id="show-date"
                  data-testid="show-date-input"
                  required
                  value={formData.date}
                  onChange={date => setFormData({ ...formData, date })}
                />
              </div>

              <div>
                <TimePickerDropdown
                  label="Time"
                  name="showTime"
                  id="show-time"
                  data-testid="show-time-input"
                  required
                  value={formData.time}
                  onChange={time => setFormData({ ...formData, time })}
                  placeholder="Select time"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={e =>
                  setFormData({
                    ...formData,
                    status: e.target.value as Show['status'],
                  })
                }
                className="w-full px-4 py-2 bg-bg-1 border border-border-1 rounded-lg text-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Venue Section */}
          <div className="space-y-4 pt-6 border-t border-border-1">
            <h3 className="text-sm font-semibold text-ink-3 uppercase tracking-wider">
              Venue
            </h3>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Venue Name
              </label>
              <input
                type="text"
                name="venue"
                id="show-venue"
                data-testid="show-venue-input"
                value={formData.venue}
                onChange={e =>
                  setFormData({ ...formData, venue: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-1 border border-border-1 rounded-lg text-white placeholder-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="e.g., The Whiskey Room"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Location/Address
              </label>
              <input
                type="text"
                name="location"
                id="show-location"
                data-testid="show-location-input"
                value={formData.location}
                onChange={e =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-1 border border-border-1 rounded-lg text-white placeholder-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="Full address"
              />
            </div>
          </div>

          {/* Schedule Section */}
          <div className="space-y-4 pt-6 border-t border-border-1">
            <h3 className="text-sm font-semibold text-ink-3 uppercase tracking-wider">
              Schedule
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <TimePickerDropdown
                  label="Load-in Time"
                  value={formData.loadInTime}
                  onChange={time =>
                    setFormData({ ...formData, loadInTime: time })
                  }
                  placeholder="Select load-in time"
                  data-testid="show-loadin-time-input"
                />
              </div>

              <div>
                <TimePickerDropdown
                  label="Soundcheck Time"
                  value={formData.soundcheckTime}
                  onChange={time =>
                    setFormData({ ...formData, soundcheckTime: time })
                  }
                  placeholder="Select soundcheck time"
                  data-testid="show-soundcheck-time-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Duration (min)
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={e =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-bg-1 border border-border-1 rounded-lg text-white placeholder-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="90"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Setlist
              </label>
              <select
                name="setlist"
                id="show-setlist"
                data-testid="show-setlist-select"
                value={formData.setlistId}
                onChange={e =>
                  setFormData({ ...formData, setlistId: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-1 border border-border-1 rounded-lg text-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">No setlist assigned</option>
                {availableSetlists.map(setlist => (
                  <option key={setlist.id} value={setlist.id}>
                    {setlist.name} (
                    {setlist.items.filter(i => i.type === 'song').length} songs)
                  </option>
                ))}
              </select>
              {formData.setlistId && (
                <div className="mt-2 p-3 bg-accent/10 border border-accent/30 rounded-lg">
                  <p className="text-xs text-accent flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>
                      A copy is forked for this show — edits here won't change
                      the original setlist.
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Section - UPDATED FOR DATABASE */}
          <div className="space-y-4 pt-6 border-t border-border-1">
            <h3 className="text-sm font-semibold text-ink-3 uppercase tracking-wider">
              Payment
            </h3>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Amount ($)
              </label>
              <input
                type="number"
                value={formData.paymentAmount}
                onChange={e =>
                  setFormData({ ...formData, paymentAmount: e.target.value })
                }
                className="w-full px-4 py-2 bg-bg-1 border border-border-1 rounded-lg text-white placeholder-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="0"
                step="0.01"
              />
              <p className="mt-1 text-xs text-ink-3">
                Enter amount in dollars (e.g., 500 for $500.00)
              </p>
            </div>
          </div>

          {/* Contacts Section */}
          <div className="space-y-4 pt-6 border-t border-border-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-3 uppercase tracking-wider">
                Contacts
              </h3>
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-1 text-sm text-accent hover:text-accent-deep transition-colors"
              >
                <Plus size={16} />
                Add Contact
              </button>
            </div>

            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                className="p-4 bg-bg-1 border border-border-1 rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-ink-3 uppercase">
                    Contact {index + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeContact(index)}
                    className="text-danger hover:text-danger/80 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={contact.name}
                    onChange={e => updateContact(index, 'name', e.target.value)}
                    className="px-3 py-2 bg-bg-2 border border-border-1 rounded-lg text-white text-sm placeholder-ink-4 focus:border-accent focus:outline-none"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={contact.role || ''}
                    onChange={e => updateContact(index, 'role', e.target.value)}
                    className="px-3 py-2 bg-bg-2 border border-border-1 rounded-lg text-white text-sm placeholder-ink-4 focus:border-accent focus:outline-none"
                    placeholder="Role (e.g., Venue Manager)"
                  />
                  <input
                    type="tel"
                    value={contact.phone || ''}
                    onChange={e =>
                      updateContact(index, 'phone', e.target.value)
                    }
                    className="px-3 py-2 bg-bg-2 border border-border-1 rounded-lg text-white text-sm placeholder-ink-4 focus:border-accent focus:outline-none"
                    placeholder="Phone"
                  />
                  <input
                    type="email"
                    value={contact.email || ''}
                    onChange={e =>
                      updateContact(index, 'email', e.target.value)
                    }
                    className="px-3 py-2 bg-bg-2 border border-border-1 rounded-lg text-white text-sm placeholder-ink-4 focus:border-accent focus:outline-none"
                    placeholder="Email"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Notes Section */}
          <div className="space-y-4 pt-6 border-t border-border-1">
            <h3 className="text-sm font-semibold text-ink-3 uppercase tracking-wider">
              Notes
            </h3>

            <textarea
              name="notes"
              id="show-notes"
              data-testid="show-notes-textarea"
              value={formData.notes}
              onChange={e =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={4}
              className="w-full px-4 py-2 bg-bg-1 border border-border-1 rounded-lg text-white placeholder-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              placeholder="Any additional details, special requirements, or reminders..."
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border-1">
            <button
              type="button"
              onClick={onClose}
              data-testid="cancel-show-button"
              className="px-4 py-2 rounded-lg border border-border-1 bg-transparent text-white text-sm font-medium hover:bg-bg-3 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="save-show-button"
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors"
            >
              {show ? 'Save Changes' : 'Schedule Show'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// DELETE CONFIRMATION MODAL - UPDATED FOR DATABASE
// ============================================
const DeleteConfirmationModal: React.FC<{
  show: Show
  onConfirm: () => void
  onCancel: () => void
}> = ({ show, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        data-testid="delete-show-modal"
        className="bg-bg-2 rounded-xl border border-border-1 w-full max-w-md p-6"
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-full bg-danger/10">
            <AlertCircle size={24} className="text-danger" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Delete Show?</h3>
            <p className="text-sm text-ink-3">
              Are you sure you want to delete "
              <span className="text-white font-medium">
                {show.name || 'this show'}
              </span>
              "? This action cannot be undone.
            </p>
            {show.setlistId && (
              <p className="text-xs text-ink-4 mt-2">
                Note: The associated setlist reference will be cleared but the
                setlist itself will not be deleted.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            data-testid="cancel-delete-show"
            className="px-4 py-2 rounded-lg border border-border-1 bg-transparent text-white text-sm font-medium hover:bg-bg-3 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            data-testid="confirm-delete-show"
            className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 transition-colors"
          >
            Delete Show
          </button>
        </div>
      </div>
    </div>
  )
}

// Empty State Component
const EmptyState: React.FC<{ onSchedule: () => void }> = ({ onSchedule }) => {
  return (
    <div
      data-testid="show-empty-state"
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
        <Calendar size={32} className="text-accent" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">No shows scheduled</h3>
      <p className="text-ink-3 text-sm mb-6 text-center max-w-md">
        Schedule your first show to get started and keep track of your upcoming
        performances
      </p>
      <button
        onClick={onSchedule}
        data-testid="create-show-button"
        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent-deep transition-colors"
      >
        <Plus size={20} />
        Schedule Show
      </button>
    </div>
  )
}

// ============================================
// HELPER FUNCTIONS - STATUS CONFIGURATIONS
// ============================================
// @ts-expect-error - Intentionally unused
// Reserved for future payment tracking feature
function _getPaymentStatusConfig(status?: 'unpaid' | 'partial' | 'paid') {
  switch (status) {
    case 'paid':
      return {
        color: 'text-green-500 bg-green-500/10 border-green-500/20',
        label: 'Paid',
      }
    case 'partial':
      return {
        color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
        label: 'Partial',
      }
    case 'unpaid':
      return {
        color: 'text-red-500 bg-red-500/10 border-red-500/20',
        label: 'Unpaid',
      }
    default:
      return null
  }
}
