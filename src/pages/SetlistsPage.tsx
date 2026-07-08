import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { Dropdown } from '../components/common/Dropdown'
import { useToast } from '../contexts/ToastContext'
import { BrowseSongsDrawer } from '../components/common/BrowseSongsDrawer'
import { TuningTag } from '../components/common/MetaPill'
import { useConfirm } from '../hooks/useConfirm'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import {
  ChevronDown,
  Plus,
  Search,
  Clock,
  Music2,
  GripVertical,
  X,
  MoreVertical,
  Copy,
  Archive,
  Trash2,
  Edit2,
  Calendar,
  ListMusic,
  ArrowLeft,
  ChevronRight,
  Coffee,
  Layers,
  Play,
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

// DATABASE INTEGRATION: Import database hooks and utilities
import { db } from '../services/database'
import { getSyncRepository } from '../services/data/SyncRepository'
import { SongService } from '../services/SongService'
import { secondsToDuration } from '../utils/formatters'
import { formatShowDate } from '../utils/dateHelpers'
import type {
  SetlistItem as DBSetlistItem,
  Setlist as DBSetlist,
} from '../models/Setlist'
import type { Song as DBSong } from '../models/Song'
import {
  useCreateSetlist,
  useUpdateSetlist,
  useDeleteSetlist,
  usePersonalSetlists,
} from '../hooks/useSetlists'
// PHASE 2: Sync status visualization
import { SyncIcon } from '../components/sync/SyncIcon'
import { useItemStatus } from '../hooks/useItemSyncStatus'

// DATABASE INTEGRATION: UI-specific types for display
// These extend the database types with UI-specific fields
interface UISong {
  id: string
  title: string
  artist: string
  duration: string // Formatted duration (e.g., "3:14")
  durationSeconds: number // Raw seconds from database
  key?: string
  tuning?: string
  bpm?: string
  album?: string
  initials: string
  avatarColor: string
}

interface UISetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number
  song?: UISong // Populated from database
  songId?: string // From database
  breakDuration?: number // in minutes
  breakNotes?: string
  sectionTitle?: string
  notes?: string // notes for individual songs in setlist
}

interface UISetlist {
  id: string
  name: string
  songCount: number
  totalDuration: string
  status: 'draft' | 'active' | 'archived'
  associatedShow?: {
    id: string
    name: string
    date: string
  }
  items: UISetlistItem[]
  lastModified: string
  notes: string
  // Database fields
  bandId?: string // nullable for personal setlists
  showId?: string
  contextType?: 'band' | 'personal'
  contextId?: string
  tags?: string[]
}

interface UIShow {
  id: string
  name: string
  date: string
}

interface UIPractice {
  id: string
  name: string
  date: string
}

// DATABASE INTEGRATION: Helper function to generate avatar color from song title
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

// DATABASE INTEGRATION: Helper function to generate initials from song title
const generateInitials = (title: string): string => {
  const words = title.split(' ').filter(w => w.length > 0)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return title.substring(0, 2).toUpperCase()
}

// DATABASE INTEGRATION: Convert database song to UI song
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
    album: dbSong.album,
    initials: generateInitials(dbSong.title),
    avatarColor: generateAvatarColor(dbSong.title),
  }
}

// DATABASE INTEGRATION: Mock data removed - all data now comes from IndexedDB

// Helper to convert seconds to readable duration
const formatTotalDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes} min`
}

// Helper to calculate setlist duration
const calculateSetlistDuration = (items: UISetlistItem[]): number => {
  return items.reduce((total, item) => {
    if (item.type === 'song' && item.song) {
      return total + item.song.durationSeconds
    } else if (item.type === 'break' && item.breakDuration) {
      return total + item.breakDuration * 60
    }
    return total
  }, 0)
}

// DATABASE INTEGRATION: Mock setlists removed - data loaded from database

// Draggable Setlist Item Component
interface SortableSetlistItemProps {
  item: UISetlistItem // DATABASE INTEGRATION: Updated to use UI type
  onRemove: (itemId: string) => void
  onUpdateItem: (itemId: string, updates: Partial<UISetlistItem>) => void
  onAddToPractice?: (songId: string) => void
}

const SortableSetlistItem: React.FC<SortableSetlistItemProps> = ({
  item,
  onRemove,
  onUpdateItem,
  onAddToPractice,
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

  const [isEditingNotes, setIsEditingNotes] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Render Break Item
  if (item.type === 'break') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex flex-col gap-2 p-3 sm:p-4 bg-bg-1 border border-dashed border-border-2 rounded-lg group hover:border-border-2 transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        {/* Mobile: Stacked layout */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-ink-5 hover:text-ink-3 transition-colors flex-shrink-0"
          >
            <GripVertical size={18} />
          </button>

          <div className="w-6 text-center flex-shrink-0">
            <Coffee size={18} className="text-ink-4" />
          </div>

          <span className="text-sm font-medium text-ink-3 flex-shrink-0">
            Break
          </span>

          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="number"
              placeholder="15"
              value={item.breakDuration || ''}
              onChange={e =>
                onUpdateItem(item.id, {
                  breakDuration: parseInt(e.target.value) || 0,
                })
              }
              className="w-16 h-8 px-2 bg-bg-2 border border-border-1 rounded text-white text-sm text-center placeholder-ink-5 focus:border-accent focus:outline-none"
            />
            <span className="text-xs text-ink-4">min</span>
          </div>

          <button
            onClick={() => onRemove(item.id)}
            className="ml-auto p-1.5 text-ink-4 hover:text-danger hover:bg-danger/10 rounded transition-all flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mobile: Notes on second row */}
        <div className="sm:hidden pl-11">
          <input
            type="text"
            placeholder="Break notes..."
            value={item.breakNotes || ''}
            onChange={e =>
              onUpdateItem(item.id, { breakNotes: e.target.value })
            }
            className="w-full h-8 px-3 bg-bg-2 border border-border-1 rounded text-white text-sm placeholder-ink-5 focus:border-accent focus:outline-none"
          />
        </div>

        {/* Desktop: Single row layout */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-ink-5 hover:text-ink-3 transition-colors"
          >
            <GripVertical size={18} />
          </button>

          <div className="w-6 text-center">
            <Coffee size={18} className="text-ink-4" />
          </div>

          <span className="text-sm font-medium text-ink-3">Break</span>

          <input
            type="text"
            placeholder="Break notes..."
            value={item.breakNotes || ''}
            onChange={e =>
              onUpdateItem(item.id, { breakNotes: e.target.value })
            }
            className="flex-1 h-8 px-3 bg-bg-2 border border-border-1 rounded text-white text-sm placeholder-ink-5 focus:border-accent focus:outline-none"
          />

          <input
            type="number"
            placeholder="15"
            value={item.breakDuration || ''}
            onChange={e =>
              onUpdateItem(item.id, {
                breakDuration: parseInt(e.target.value) || 0,
              })
            }
            className="w-20 h-8 px-3 bg-bg-2 border border-border-1 rounded text-white text-sm text-center placeholder-ink-5 focus:border-accent focus:outline-none"
          />
          <span className="text-xs text-ink-4">min</span>

          <button
            onClick={() => onRemove(item.id)}
            className="opacity-0 group-hover:opacity-100 text-ink-4 hover:text-danger transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    )
  }

  // Render Section Item
  if (item.type === 'section') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-accent/10 to-transparent border border-accent/30 rounded-lg group hover:border-accent/50 transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-ink-5 hover:text-ink-3 transition-colors flex-shrink-0"
        >
          <GripVertical size={18} />
        </button>

        <div className="w-6 text-center flex-shrink-0">
          <Layers size={18} className="text-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-accent text-sm font-semibold truncate">
            {item.sectionTitle}
          </div>
        </div>

        <button
          onClick={() => onRemove(item.id)}
          className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-ink-4 hover:text-danger hover:bg-danger/10 rounded transition-all flex-shrink-0"
        >
          <X size={16} className="sm:hidden" />
          <X size={18} className="hidden sm:block" />
        </button>
      </div>
    )
  }

  // Render Song Item (matching Songs page layout with notes on new line)
  if (item.type === 'song' && item.song) {
    const song = item.song

    return (
      <div
        ref={setNodeRef}
        style={style}
        data-testid={`setlist-item-${item.position - 1}`}
        data-song-id={item.songId}
        className={`flex flex-col bg-bg-2 border border-border-1 rounded-lg group hover:border-border-2 transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        {/* Main row */}
        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-ink-5 hover:text-ink-3 transition-colors flex-shrink-0"
          >
            <GripVertical size={18} />
          </button>

          <div className="w-5 sm:w-6 text-center text-ink-4 text-sm font-medium flex-shrink-0">
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
            <div className="flex items-center gap-2 text-xs text-ink-4">
              <span className="truncate">{song.artist}</span>
              <span className="text-ink-5">•</span>
              <span className="flex-shrink-0">{song.duration}</span>
              <span className="text-ink-5">•</span>
              <span className="flex-shrink-0">{song.key}</span>
            </div>
          </div>

          {/* Desktop: Full layout */}
          <div className="hidden sm:block flex-1 min-w-[200px]">
            <div className="text-white text-sm font-semibold truncate">
              {song.title}
            </div>
            <div className="text-ink-4 text-xs truncate">{song.artist}</div>
          </div>

          <div className="hidden sm:block w-[90px] text-ink-3 text-sm flex-shrink-0">
            {song.duration}
          </div>

          <div className="hidden sm:block w-[60px] text-ink-3 text-sm flex-shrink-0">
            {song.key}
          </div>

          <div className="hidden sm:block w-[130px] flex-shrink-0">
            <TuningTag tuning={song.tuning} className="text-sm" />
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {onAddToPractice && (
              <button
                onClick={() => onAddToPractice(song.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-4 hover:text-accent hover:bg-accent/10 rounded transition-all"
                title="Add to Practice"
              >
                <Play size={16} />
              </button>
            )}
            <button
              onClick={() => onRemove(item.id)}
              data-testid={`remove-item-${item.position - 1}`}
              className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-ink-4 hover:text-danger hover:bg-danger/10 rounded transition-all"
              title="Remove from Setlist"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Notes row */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          {isEditingNotes ? (
            <textarea
              value={item.notes || ''}
              onChange={e => onUpdateItem(item.id, { notes: e.target.value })}
              onBlur={() => setIsEditingNotes(false)}
              placeholder="Add notes for this song..."
              className="w-full px-3 py-2 bg-bg-1 border border-border-1 rounded text-white text-sm placeholder-ink-5 focus:border-accent focus:outline-none resize-none"
              rows={2}
              autoFocus
            />
          ) : (
            <div
              onClick={() => setIsEditingNotes(true)}
              className="text-ink-4 text-sm cursor-text hover:text-ink-3 transition-colors"
            >
              {item.notes ? (
                <span className="text-ink-3">{item.notes}</span>
              ) : (
                <span className="italic">Click to add notes...</span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

// Setlist Card Component (for grid view)
interface SetlistCardProps {
  setlist: UISetlist // DATABASE INTEGRATION: Updated to use UI type
  onClick: () => void
  onEdit: (setlist: UISetlist) => void
  onDuplicate: (setlist: UISetlist) => void
  onArchive: (setlistId: string) => void
  onDelete: (setlistId: string) => void
  onNavigateToShow?: (showId: string) => void
}

const SetlistCard: React.FC<SetlistCardProps> = ({
  setlist,
  onClick,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  onNavigateToShow,
}) => {
  // PHASE 2: Get sync status for this setlist
  const syncStatus = useItemStatus(setlist.id)

  const [showActions, setShowActions] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const songListRef = useRef<HTMLDivElement>(null)

  // Check if song list overflows
  const checkOverflow = useCallback(() => {
    if (songListRef.current) {
      const { scrollHeight, clientHeight } = songListRef.current
      setIsOverflowing(scrollHeight > clientHeight)
    }
  }, [])

  // Check overflow on mount and when content changes
  useEffect(() => {
    checkOverflow()
    // Also check on resize
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [checkOverflow, setlist.items])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-accent text-white'
      case 'draft':
        return 'bg-ink-5 text-white'
      case 'archived':
        return 'bg-bg-3 text-ink-3'
      default:
        return 'bg-ink-5 text-white'
    }
  }

  const songItems = setlist.items.filter(item => item.type === 'song')
  const totalDuration = formatTotalDuration(
    calculateSetlistDuration(setlist.items)
  )

  return (
    <div
      data-testid={`setlist-card-${setlist.name}`}
      className="bg-bg-2 rounded-xl p-5 border border-border-1 hover:border-border-2 transition-colors cursor-pointer aspect-square flex flex-col"
      onClick={onClick}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-2 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3
            data-testid="setlist-name"
            className="text-lg font-bold text-white mb-1 truncate"
          >
            {setlist.name}
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(setlist.status)}`}
            >
              {setlist.status.charAt(0).toUpperCase() + setlist.status.slice(1)}
            </span>
            <SyncIcon status={syncStatus} size="sm" />
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1.5 rounded-lg hover:bg-bg-4 transition-colors text-ink-3"
          >
            <MoreVertical size={18} />
          </button>

          {showActions && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowActions(false)}
              />
              <div className="absolute right-0 top-8 w-40 bg-bg-2 border border-border-1 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => {
                    onEdit(setlist)
                    setShowActions(false)
                  }}
                  data-testid={`edit-setlist-${setlist.id}`}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-border-1 transition-colors flex items-center gap-2"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDuplicate(setlist)
                    setShowActions(false)
                  }}
                  data-testid={`duplicate-setlist-${setlist.id}`}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-border-1 transition-colors flex items-center gap-2"
                >
                  <Copy size={14} />
                  Duplicate
                </button>
                {setlist.status !== 'archived' && (
                  <button
                    onClick={() => {
                      onArchive(setlist.id)
                      setShowActions(false)
                    }}
                    data-testid={`archive-setlist-${setlist.id}`}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-border-1 transition-colors flex items-center gap-2"
                  >
                    <Archive size={14} />
                    Archive
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true)
                    setShowActions(false)
                  }}
                  data-testid={`delete-setlist-${setlist.id}`}
                  className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-border-1 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-2 text-white font-medium mb-2 flex-shrink-0">
        <Clock size={16} className="text-accent" />
        <span data-testid={`setlist-duration-${setlist.id}`}>
          {totalDuration}
        </span>
        <span className="text-ink-5">•</span>
        <span
          className="text-ink-3"
          data-testid={`setlist-song-count-${setlist.id}`}
        >
          {songItems.length} song{songItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Associated Show Link */}
      {setlist.associatedShow && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <Calendar size={14} className="text-accent" />
          <button
            onClick={e => {
              e.stopPropagation()
              onNavigateToShow?.(setlist.associatedShow!.id)
            }}
            className="text-accent text-sm hover:underline truncate"
          >
            {setlist.associatedShow.name} - {setlist.associatedShow.date}
          </button>
        </div>
      )}

      {/* Notes/Description */}
      {setlist.notes && (
        <p className="text-sm text-ink-3 mb-2 line-clamp-2 flex-shrink-0">
          {setlist.notes}
        </p>
      )}

      {/* Song Preview - Vertical list */}
      {songItems.length > 0 && (
        <div
          ref={songListRef}
          className="relative flex-1 min-h-0 overflow-hidden"
        >
          <ul className="text-sm space-y-1">
            {songItems.map((item, index) => (
              <li key={index} className="text-ink-3 truncate">
                <span className="text-ink-5 mr-2">{index + 1}.</span>
                {item.song?.title}
              </li>
            ))}
          </ul>
          {/* Fade/ellipsis indicator - only show when overflowing */}
          {isOverflowing && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-bg-2 to-transparent pointer-events-none flex items-end justify-center pb-1">
              <span className="text-ink-5 text-sm">...</span>
            </div>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            data-testid="delete-setlist-modal"
            className="bg-bg-2 rounded-xl border border-border-1 p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg mb-2">
              Delete Setlist?
            </h3>
            <p className="text-ink-3 text-sm mb-6">
              Are you sure you want to delete "{setlist.name}"? This action
              cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                data-testid="cancel-delete-setlist"
                className="px-4 py-2 rounded-lg border border-border-1 bg-transparent text-white text-sm font-medium hover:bg-bg-3 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(setlist.id)
                  setShowDeleteConfirm(false)
                }}
                data-testid="confirm-delete-setlist"
                className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Full-Page Setlist Editor Component
interface SetlistEditorPageProps {
  setlist: UISetlist // DATABASE INTEGRATION: Updated to use UI type
  availableSongs: UISong[] // DATABASE INTEGRATION: Updated to use UI type
  availableShows: UIShow[] // DATABASE INTEGRATION: Updated to use UI type
  availablePractices: UIPractice[] // DATABASE INTEGRATION: Updated to use UI type
  dbSongs: DBSong[] // Primary songs for BrowseSongsDrawer (band or personal based on setlist context)
  bandDbSongs?: DBSong[] // Band songs (always available for cross-catalog picker)
  dbSetlists: DBSetlist[] // Raw database setlists for BrowseSongsDrawer
  isPersonalSetlist?: boolean // Whether editing a personal setlist
  onBack: () => void
  onSave: (setlist: UISetlist) => void
  onCopySongToPersonal?: (song: DBSong) => Promise<string> // Copy band song to personal catalog; returns new personal song ID
}

const SetlistEditorPage: React.FC<SetlistEditorPageProps> = ({
  setlist,
  availableShows,
  availablePractices,
  dbSongs,
  bandDbSongs,
  dbSetlists,
  isPersonalSetlist = false,
  onBack,
  onSave,
  onCopySongToPersonal,
}) => {
  const { showToast } = useToast()
  const { confirm, dialogProps: confirmDialogProps } = useConfirm()
  const [editedSetlist, setEditedSetlist] = useState<UISetlist>(setlist)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showPracticeMenu, setShowPracticeMenu] = useState(false)
  const [showSectionInput, setShowSectionInput] = useState(false)
  const [sectionTitle, setSectionTitle] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (prevents scrolling)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setEditedSetlist(prev => {
        const oldIndex = prev.items.findIndex(item => item.id === active.id)
        const newIndex = prev.items.findIndex(item => item.id === over.id)

        const newItems = arrayMove(prev.items, oldIndex, newIndex).map(
          (item, index) => ({
            ...item,
            position: index + 1,
          })
        )

        return {
          ...prev,
          items: newItems,
        }
      })
    }
  }

  const addSongToSetlist = async (song: DBSong) => {
    let resolvedSongId = song.id!
    let resolvedUiSong = dbSongToUISong(song)

    // If this is a personal setlist and the song is from a band catalog,
    // ask the user whether to copy it to their personal catalog first
    if (
      isPersonalSetlist &&
      song.contextType === 'band' &&
      onCopySongToPersonal
    ) {
      // Check if the user already has this song in their personal catalog
      const existingPersonal = dbSongs.find(
        s =>
          s.contextType === 'personal' &&
          s.title?.toLowerCase() === song.title?.toLowerCase() &&
          s.artist?.toLowerCase() === song.artist?.toLowerCase()
      )
      if (existingPersonal) {
        // Use the existing personal copy's ID so the item resolves correctly
        resolvedSongId = existingPersonal.id!
      } else {
        const confirmed = await confirm({
          title: 'Add Band Song to Personal Setlist',
          message: `"${song.title}" is a band song. Copy it to My Songs so it belongs to your personal catalog?`,
          confirmLabel: 'Copy to My Songs',
          cancelLabel: 'Add Without Copying',
          variant: 'default',
        })
        if (confirmed) {
          try {
            resolvedSongId = await onCopySongToPersonal(song)
            // Update the UI song to reflect it now belongs to the personal catalog
            resolvedUiSong = { ...resolvedUiSong }
            showToast(`"${song.title}" copied to My Songs`, 'success')
          } catch (err) {
            showToast(`Failed to copy "${song.title}" to My Songs`, 'error')
            // Do NOT add the item — the user should resolve the error and try again
            return
          }
        }
        // If "Add Without Copying", fall through with the original band song ID
      }
    }

    const newItem: UISetlistItem = {
      id: crypto.randomUUID(),
      type: 'song',
      position: editedSetlist.items.length + 1,
      song: resolvedUiSong,
      songId: resolvedSongId,
    }

    setEditedSetlist(prev => ({
      ...prev,
      items: [...prev.items, newItem],
      songCount: prev.items.filter(i => i.type === 'song').length + 1,
    }))
  }

  const addAllSongsFromSetlist = (songs: DBSong[]) => {
    const startPosition = editedSetlist.items.length + 1
    const newItems: UISetlistItem[] = songs.map((song, index) => {
      const uiSong = dbSongToUISong(song)
      return {
        id: crypto.randomUUID(),
        type: 'song',
        position: startPosition + index,
        song: uiSong,
        songId: song.id!,
      }
    })

    setEditedSetlist(prev => ({
      ...prev,
      items: [...prev.items, ...newItems],
      songCount:
        prev.items.filter(i => i.type === 'song').length + newItems.length,
    }))
  }

  const addBreakToSetlist = () => {
    const newPosition = editedSetlist.items.length + 1
    const newItem: UISetlistItem = {
      id: crypto.randomUUID(), // DATABASE INTEGRATION: Use crypto.randomUUID()
      type: 'break',
      position: newPosition,
      breakDuration: 15, // default 15 min
      breakNotes: '',
    }

    setEditedSetlist(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }))
    setShowAddMenu(false)
  }

  const updateItemInSetlist = (
    itemId: string,
    updates: Partial<UISetlistItem>
  ) => {
    setEditedSetlist(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }))
  }

  const addSectionToSetlist = () => {
    setShowAddMenu(false)
    setShowSectionInput(true)
  }

  const handleAddSection = (title: string) => {
    if (!title.trim()) return

    const newPosition = editedSetlist.items.length + 1
    const newItem: UISetlistItem = {
      id: crypto.randomUUID(), // DATABASE INTEGRATION: Use crypto.randomUUID()
      type: 'section',
      position: newPosition,
      sectionTitle: title.trim(),
    }

    setEditedSetlist(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }))
    setShowSectionInput(false)
    setSectionTitle('')
  }

  const removeItemFromSetlist = (itemId: string) => {
    setEditedSetlist(prev => {
      const newItems = prev.items
        .filter(item => item.id !== itemId)
        .map((item, index) => ({ ...item, position: index + 1 }))

      return {
        ...prev,
        items: newItems,
        songCount: newItems.filter(i => i.type === 'song').length,
      }
    })
  }

  const handleSave = () => {
    onSave(editedSetlist)
    onBack()
  }

  const handleAddToPractice = (practiceId: string) => {
    const practice = availablePractices.find(p => p.id === practiceId)
    if (practice) {
      showToast(
        `Added ${editedSetlist.items.filter(i => i.type === 'song').length} songs to ${practice.name}`,
        'success'
      )
      setShowPracticeMenu(false)
    }
  }

  const handleAddSongToPractice = (songId: string) => {
    const song = editedSetlist.items.find(
      i => i.type === 'song' && i.song?.id === songId
    )?.song
    if (song) {
      // For now, add to first practice (in real app, would show menu)
      showToast(`Added "${song.title}" to practice`, 'success')
    }
  }

  // Filter songs that are already in the setlist
  const songsInSetlist = editedSetlist.items
    .filter(item => item.type === 'song' && item.songId)
    .map(item => item.songId!)

  const totalDuration = calculateSetlistDuration(editedSetlist.items)
  const songCount = editedSetlist.items.filter(i => i.type === 'song').length

  const [showDetails, setShowDetails] = useState(false)

  return (
    <div
      data-testid="setlist-modal"
      className="fixed inset-0 bg-bg-1 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-border-1 bg-bg-1 flex-shrink-0">
        {/* Main header row */}
        <div className="flex items-center justify-between gap-3 px-3 sm:px-6 py-2 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 text-ink-4 hover:text-white transition-colors rounded-lg hover:bg-bg-2 flex-shrink-0"
            >
              <ArrowLeft size={18} className="sm:hidden" />
              <ArrowLeft size={20} className="hidden sm:block" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="hidden sm:flex items-center gap-2 text-xs text-ink-4 mb-1">
                <span>Setlists</span>
                <ChevronRight size={14} />
                <span className="text-ink-3">Edit</span>
              </div>
              <input
                type="text"
                name="setlistName"
                id="setlist-name"
                data-testid="setlist-name-input"
                value={editedSetlist.name}
                onChange={e =>
                  setEditedSetlist({ ...editedSetlist, name: e.target.value })
                }
                className="text-base sm:text-xl font-bold text-white bg-transparent border-0 outline-none focus:ring-0 p-0 w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Mobile: Icon buttons */}
            <button
              onClick={onBack}
              className="sm:hidden p-2 rounded-lg border border-border-1 bg-transparent text-white hover:bg-bg-3 transition-colors"
              title="Cancel"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleSave}
              className="sm:hidden p-2 rounded-lg bg-accent text-white hover:bg-accent-deep transition-colors"
              title="Save"
            >
              <Check size={18} />
            </button>

            {/* Desktop: Text buttons */}
            <button
              onClick={onBack}
              data-testid="cancel-setlist-button"
              className="hidden sm:block px-4 py-2 rounded-lg border border-border-1 bg-transparent text-white text-sm font-medium hover:bg-bg-3 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              data-testid="save-setlist-button"
              className="hidden sm:block px-6 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors"
            >
              Save Setlist
            </button>

            {/* Mobile: Details toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="sm:hidden p-2 rounded-lg border border-border-1 bg-transparent text-white hover:bg-bg-3 transition-colors"
              title={showDetails ? 'Hide Details' : 'Show Details'}
            >
              <ChevronDown
                size={18}
                className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Mobile: Collapsible details */}
        {showDetails && (
          <div className="sm:hidden px-3 py-3 border-t border-border-1 bg-bg-1 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-3 mb-1.5">
                  Status
                </label>
                <Dropdown
                  data-testid="setlist-status-select-mobile"
                  value={editedSetlist.status}
                  onChange={value =>
                    setEditedSetlist({
                      ...editedSetlist,
                      status: value as 'draft' | 'active' | 'archived',
                    })
                  }
                  groups={[
                    {
                      options: [
                        { value: 'draft', label: 'Draft' },
                        { value: 'active', label: 'Active' },
                        { value: 'archived', label: 'Archived' },
                      ],
                    },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs text-ink-3 mb-1.5">
                  Statistics
                </label>
                <div className="flex items-center gap-2 text-xs text-ink-3 h-9">
                  <span className="flex items-center gap-1">
                    <Music2 size={12} />
                    {songCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatTotalDuration(totalDuration)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-3 mb-1.5">
                Associated Show
              </label>
              <Dropdown
                data-testid="setlist-show-select-mobile"
                value={editedSetlist.associatedShow?.id || ''}
                onChange={value => {
                  const show = availableShows.find(s => s.id === value)
                  setEditedSetlist({ ...editedSetlist, associatedShow: show })
                }}
                groups={[
                  {
                    options: [
                      { value: '', label: 'No show' },
                      ...availableShows.map(show => ({
                        value: show.id,
                        label: `${show.name} - ${show.date}`,
                      })),
                    ],
                  },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs text-ink-3 mb-1.5">Notes</label>
              <input
                type="text"
                name="notes"
                id="setlist-notes"
                data-testid="setlist-notes-input"
                value={editedSetlist.notes}
                onChange={e =>
                  setEditedSetlist({ ...editedSetlist, notes: e.target.value })
                }
                placeholder="Add notes..."
                className="w-full h-9 px-2.5 bg-bg-2 border border-border-1 rounded-lg text-white text-sm placeholder-ink-5 focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Desktop: Metadata Bar */}
        <div className="hidden sm:block px-6 py-4 border-t border-border-1 bg-bg-1">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-ink-3 mb-2">Status</label>
              <Dropdown
                data-testid="setlist-status-select"
                value={editedSetlist.status}
                onChange={value =>
                  setEditedSetlist({
                    ...editedSetlist,
                    status: value as 'draft' | 'active' | 'archived',
                  })
                }
                groups={[
                  {
                    options: [
                      { value: 'draft', label: 'Draft' },
                      { value: 'active', label: 'Active' },
                      { value: 'archived', label: 'Archived' },
                    ],
                  },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs text-ink-3 mb-2">
                Associated Show
              </label>
              <Dropdown
                data-testid="setlist-show-select"
                value={editedSetlist.associatedShow?.id || ''}
                onChange={value => {
                  const show = availableShows.find(s => s.id === value)
                  setEditedSetlist({ ...editedSetlist, associatedShow: show })
                }}
                groups={[
                  {
                    options: [
                      { value: '', label: 'No show' },
                      ...availableShows.map(show => ({
                        value: show.id,
                        label: `${show.name} - ${show.date}`,
                      })),
                    ],
                  },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs text-ink-3 mb-2">Notes</label>
              <input
                type="text"
                name="notes"
                id="setlist-notes"
                data-testid="setlist-notes-input"
                value={editedSetlist.notes}
                onChange={e =>
                  setEditedSetlist({ ...editedSetlist, notes: e.target.value })
                }
                placeholder="Add notes..."
                className="w-full h-10 px-3 bg-bg-2 border border-border-1 rounded-lg text-white text-sm placeholder-ink-5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block text-xs text-ink-3 mb-2">
                Statistics
              </label>
              <div className="flex items-center gap-3 text-sm text-ink-3 h-10">
                <span className="flex items-center gap-1">
                  <Music2 size={14} />
                  {songCount} songs
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {formatTotalDuration(totalDuration)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Setlist Items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-lg">
                Setlist Items
              </h3>
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg border border-border-1 bg-transparent text-white text-sm font-medium hover:bg-bg-3 transition-colors w-full sm:w-auto"
                  >
                    <Plus size={18} />
                    <span>Add Item</span>
                  </button>

                  {showAddMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowAddMenu(false)}
                      />
                      <div className="absolute right-0 top-12 w-48 bg-bg-2 border border-border-1 rounded-lg shadow-lg z-20 py-1">
                        <button
                          onClick={() => {
                            setIsDrawerOpen(true)
                            setShowAddMenu(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-border-1 transition-colors flex items-center gap-2"
                        >
                          <Music2 size={14} />
                          Add Song
                        </button>
                        <button
                          onClick={addBreakToSetlist}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-border-1 transition-colors flex items-center gap-2"
                        >
                          <Coffee size={14} />
                          Add Break
                        </button>
                        <button
                          onClick={addSectionToSetlist}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-border-1 transition-colors flex items-center gap-2"
                        >
                          <Layers size={14} />
                          Add Section
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors w-full sm:w-auto"
                >
                  <Plus size={18} />
                  <span>Add Songs</span>
                </button>

                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => setShowPracticeMenu(!showPracticeMenu)}
                    className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg border border-accent bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors w-full sm:w-auto whitespace-nowrap"
                  >
                    <Play size={18} />
                    <span className="hidden sm:inline">
                      Add All to Practice
                    </span>
                    <span className="sm:hidden">Add to Practice</span>
                  </button>

                  {showPracticeMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowPracticeMenu(false)}
                      />
                      <div className="absolute right-0 top-12 w-56 bg-bg-2 border border-border-1 rounded-lg shadow-lg z-20 py-1">
                        {availablePractices.map(practice => (
                          <button
                            key={practice.id}
                            onClick={() => handleAddToPractice(practice.id)}
                            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-border-1 transition-colors"
                          >
                            <div className="font-medium">{practice.name}</div>
                            <div className="text-xs text-ink-4">
                              {practice.date}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {editedSetlist.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border-1 rounded-xl">
                <ListMusic size={48} className="text-border-1 mb-3" />
                <p className="text-ink-4 text-sm mb-1">No items yet</p>
                <p className="text-ink-5 text-xs mb-4">
                  Add songs, breaks, or sections to your setlist
                </p>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors"
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
                  items={editedSetlist.items.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div data-testid="setlist-items-list" className="space-y-2">
                    {editedSetlist.items.map(item => (
                      <SortableSetlistItem
                        key={item.id}
                        item={item}
                        onRemove={removeItemFromSetlist}
                        onUpdateItem={updateItemInSetlist}
                        onAddToPractice={handleAddSongToPractice}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Sliding Drawer for Songs */}
        <BrowseSongsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          songs={
            isPersonalSetlist
              ? [...dbSongs, ...(bandDbSongs ?? [])] // personal setlist: personal songs first, then band songs
              : dbSongs
          }
          selectedSongIds={songsInSetlist}
          onAddSong={song => void addSongToSetlist(song)}
          setlists={dbSetlists}
          onAddAllFromSetlist={addAllSongsFromSetlist}
        />

        {/* Confirm dialog for copying band songs to personal catalog */}
        <ConfirmDialog {...confirmDialogProps} />
      </div>

      {/* Section Title Input Modal */}
      {showSectionInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-2 rounded-lg border border-border-1 p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Add Section
            </h3>
            <input
              type="text"
              value={sectionTitle}
              onChange={e => setSectionTitle(e.target.value)}
              placeholder="Enter section title..."
              className="w-full px-4 py-3 bg-bg-1 border border-border-1 rounded-lg text-white placeholder-ink-5 focus:border-accent focus:outline-none mb-4"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && sectionTitle.trim()) {
                  handleAddSection(sectionTitle)
                } else if (e.key === 'Escape') {
                  setShowSectionInput(false)
                  setSectionTitle('')
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSectionInput(false)
                  setSectionTitle('')
                }}
                className="px-4 py-2 text-ink-3 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddSection(sectionTitle)}
                disabled={!sectionTitle.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Main Setlists Page Component
export const SetlistsPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { showToast } = useToast()

  // DATABASE INTEGRATION: Get currentBandId from localStorage
  const [currentBandId] = useState(
    () => localStorage.getItem('currentBandId') || ''
  )
  const currentUserId = localStorage.getItem('currentUserId') || ''

  // Tab state: 'band' = band setlists, 'personal' = user's personal setlists.
  // In a personal context (no band) there is only the personal catalog, so
  // default to the personal tab.
  const [activeTab, setActiveTab] = useState<'band' | 'personal'>(
    currentBandId ? 'band' : 'personal'
  )

  // Personal setlists (loaded separately when personal tab is active)
  const {
    setlists: personalSetlistData,
    loading: personalSetlistsLoading,
    refetch: refetchPersonalSetlists,
  } = usePersonalSetlists(currentUserId) // always loaded so My Setlists tab has data immediately

  // Hydrated personal setlists — songs populated from IndexedDB (mirrors band setlist load path)
  const [personalUISetlists, setPersonalUISetlists] = useState<UISetlist[]>([])

  // DATABASE INTEGRATION: Use hooks for setlist operations
  const { createSetlist } = useCreateSetlist()
  const { updateSetlist } = useUpdateSetlist()
  const { deleteSetlist } = useDeleteSetlist()

  // DATABASE INTEGRATION: State for UI data
  const [uiSetlists, setUISetlists] = useState<UISetlist[]>([])
  const [availableSongs, setAvailableSongs] = useState<UISong[]>([])
  const [availableShows, setAvailableShows] = useState<UIShow[]>([])
  const [availablePractices, setAvailablePractices] = useState<UIPractice[]>([])
  const [dbSongs, setDbSongs] = useState<DBSong[]>([]) // Raw band songs
  const [personalDbSongs, setPersonalDbSongs] = useState<DBSong[]>([]) // Raw personal songs
  const [dbSetlists, setDbSetlists] = useState<DBSetlist[]>([]) // Raw database setlists
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState<
    'all' | 'draft' | 'active' | 'archived'
  >('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingSetlist, setEditingSetlist] = useState<UISetlist | null>(null)

  // DATABASE INTEGRATION: Load all data from database
  useEffect(() => {
    const loadData = async () => {
      if (!currentBandId) {
        // Personal context — no band data to load here; personal setlists
        // are loaded separately via usePersonalSetlists.
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load setlists for the band
        const loadedDbSetlists = await db.setlists
          .where('bandId')
          .equals(currentBandId)
          .toArray()

        // Load songs for the band
        const loadedDbSongs = await db.songs
          .where('contextType')
          .equals('band')
          .and(s => s.contextId === currentBandId)
          .toArray()

        // Load personal songs for the current user (for personal setlist picker)
        const loadedPersonalSongs = currentUserId
          ? await db.songs
              .where('contextType')
              .equals('personal')
              .and(s => s.contextId === currentUserId)
              .toArray()
          : []

        // Store raw database data
        setDbSongs(loadedDbSongs)
        setPersonalDbSongs(loadedPersonalSongs)
        setDbSetlists(loadedDbSetlists)

        // Convert songs to UI format
        const uiSongs: UISong[] = loadedDbSongs.map(dbSongToUISong)

        // Load shows from dedicated shows table
        const dbShows = await db.shows
          .where('bandId')
          .equals(currentBandId)
          .toArray()

        const uiShows: UIShow[] = dbShows.map(show => ({
          id: show.id!,
          name: show.name || 'Unnamed Show',
          date: formatShowDate(show.scheduledDate),
        }))

        // Load practices (practice sessions with type='rehearsal')
        const dbPractices = await db.practiceSessions
          .where('bandId')
          .equals(currentBandId)
          .and(p => p.type === 'rehearsal')
          .toArray()

        const uiPractices: UIPractice[] = dbPractices.map(practice => ({
          id: practice.id!,
          name: `Practice - ${formatShowDate(practice.scheduledDate)}`,
          date: formatShowDate(practice.scheduledDate),
        }))

        // Convert setlists to UI format with populated songs
        const uiSetlists: UISetlist[] = await Promise.all(
          loadedDbSetlists.map(async dbSetlist => {
            // Load associated show if exists
            let associatedShow:
              | { id: string; name: string; date: string }
              | undefined
            if (dbSetlist.showId) {
              const show = await db.shows.get(dbSetlist.showId)
              if (show) {
                associatedShow = {
                  id: show.id!,
                  name: show.name || 'Unnamed Show',
                  date: formatShowDate(show.scheduledDate),
                }
              }
            }

            // Populate songs in items
            const populatedItems: UISetlistItem[] = await Promise.all(
              (dbSetlist.items || []).map(async item => {
                if (item.type === 'song' && item.songId) {
                  const song = await db.songs.get(item.songId)
                  if (song) {
                    return {
                      ...item,
                      song: dbSongToUISong(song),
                    }
                  }
                }
                return item as UISetlistItem
              })
            )

            // Calculate song count and total duration
            const songCount = populatedItems.filter(
              i => i.type === 'song'
            ).length
            const totalDuration = formatTotalDuration(
              calculateSetlistDuration(populatedItems)
            )

            // Format last modified
            const lastModified = dbSetlist.lastModified
              ? new Date(dbSetlist.lastModified).toLocaleDateString()
              : 'Never'

            return {
              id: dbSetlist.id!,
              name: dbSetlist.name,
              bandId: dbSetlist.bandId,
              showId: dbSetlist.showId,
              songCount,
              totalDuration,
              status: dbSetlist.status,
              associatedShow,
              items: populatedItems,
              lastModified,
              notes: dbSetlist.notes || '',
            }
          })
        )

        setUISetlists(uiSetlists)
        setAvailableSongs(uiSongs)
        setAvailableShows(uiShows)
        setAvailablePractices(uiPractices)
      } catch (err) {
        console.error('Error loading setlists:', err)
        setError('Failed to load setlists')
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBandId]) // currentUserId is stable (from localStorage on mount)

  // Handle opening editor from navigation state (e.g., from view page)
  useEffect(() => {
    const state = location.state as { editSetlistId?: string } | null
    if (state?.editSetlistId && uiSetlists.length > 0) {
      const setlistToEdit = uiSetlists.find(s => s.id === state.editSetlistId)
      if (setlistToEdit) {
        setEditingSetlist(setlistToEdit)
        // Clear the state to prevent reopening on refresh
        navigate(location.pathname, { replace: true })
      }
    }
  }, [location.state, uiSetlists, navigate, location.pathname])

  // Hydrate personal setlists: populate item.song from IndexedDB (same pattern as band setlists)
  useEffect(() => {
    if (personalSetlistData.length === 0) {
      setPersonalUISetlists([])
      return
    }
    let cancelled = false
    const hydrate = async () => {
      const hydrated = await Promise.all(
        personalSetlistData.map(async s => {
          const populatedItems: UISetlistItem[] = await Promise.all(
            (s.items ?? []).map(async item => {
              if (item.type === 'song' && item.songId) {
                const song = await db.songs.get(item.songId)
                if (song) return { ...item, song: dbSongToUISong(song) }
              }
              return item as UISetlistItem
            })
          )
          const songCount = populatedItems.filter(i => i.type === 'song').length
          return {
            id: s.id!,
            name: s.name,
            songCount,
            totalDuration: formatTotalDuration(
              calculateSetlistDuration(populatedItems)
            ),
            status: s.status,
            items: populatedItems,
            lastModified: s.lastModified?.toLocaleDateString() ?? '',
            notes: s.notes ?? '',
            bandId: undefined,
            contextType: 'personal' as const,
            contextId: s.contextId,
            tags: s.tags ?? [],
          } satisfies UISetlist
        })
      )
      if (!cancelled) setPersonalUISetlists(hydrated)
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [personalSetlistData])

  // Setlists to display (band or personal based on active tab)
  const activeSetlists =
    activeTab === 'personal' ? personalUISetlists : uiSetlists

  const filteredSetlists = activeSetlists.filter(setlist => {
    const matchesStatus =
      filterStatus === 'all' || setlist.status === filterStatus
    const matchesSearch = setlist.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Navigate to create new setlist
  const handleCreateNew = async () => {
    if (activeTab === 'personal') {
      // Create a personal setlist directly and open it in the inline editor
      if (!currentUserId) {
        showToast('Not logged in', 'error')
        return
      }
      try {
        const repo = getSyncRepository()
        const newId = crypto.randomUUID()
        const now = new Date()
        await repo.addSetlist({
          id: newId,
          name: 'My Setlist',
          bandId: undefined,
          contextType: 'personal',
          contextId: currentUserId,
          tags: [],
          items: [],
          totalDuration: 0,
          status: 'draft',
          createdDate: now,
          lastModified: now,
        })
        // Refresh personal setlists and open editor
        const refreshed = await db.setlists
          .filter(
            s => s.contextType === 'personal' && s.contextId === currentUserId
          )
          .reverse()
          .toArray()
        setPersonalDbSongs(
          await db.songs
            .where('contextType')
            .equals('personal')
            .and(s => s.contextId === currentUserId)
            .toArray()
        )
        const newUISetlist: UISetlist = {
          id: newId,
          name: 'My Setlist',
          songCount: 0,
          totalDuration: '0:00',
          status: 'draft',
          items: [],
          lastModified: 'Just now',
          notes: '',
          bandId: undefined,
          contextType: 'personal',
          contextId: currentUserId,
          tags: [],
        }
        void refreshed // suppress unused warning
        setEditingSetlist(newUISetlist)
      } catch (err) {
        console.error('Error creating personal setlist:', err)
        showToast('Failed to create setlist', 'error')
      }
    } else {
      if (!currentBandId) {
        showToast('No band selected', 'error')
        return
      }
      navigate('/setlists/new')
    }
  }

  // DATABASE INTEGRATION: Edit setlist
  const handleEdit = (setlist: UISetlist) => {
    setEditingSetlist({ ...setlist })
  }

  // DATABASE INTEGRATION: Duplicate setlist (using hook)
  const handleDuplicate = async (setlist: UISetlist) => {
    try {
      // Create new UISetlist with duplicated items
      const duplicated: UISetlist = {
        ...setlist,
        id: crypto.randomUUID(),
        name: `${setlist.name} (Copy)`,
        status: 'draft',
        associatedShow: undefined,
        showId: undefined,
        lastModified: 'Just now',
        items: setlist.items.map(item => ({
          ...item,
          id: crypto.randomUUID(),
        })),
      }

      // Convert UI items to database items
      const dbItems: DBSetlistItem[] = duplicated.items.map(item => ({
        id: item.id,
        type: item.type,
        position: item.position,
        songId: item.songId,
        notes: item.notes,
        breakDuration: item.breakDuration,
        breakNotes: item.breakNotes,
        sectionTitle: item.sectionTitle,
      }))

      // Calculate total duration
      const totalDurationSeconds = calculateSetlistDuration(duplicated.items)

      // Save to database using hook
      await createSetlist({
        id: duplicated.id,
        name: duplicated.name,
        bandId: duplicated.bandId,
        status: duplicated.status,
        items: dbItems,
        totalDuration: totalDurationSeconds,
        notes: duplicated.notes,
      })

      // Update UI state
      setUISetlists([duplicated, ...uiSetlists])

      showToast('Setlist duplicated', 'success')
    } catch (err) {
      console.error('Error duplicating setlist:', err)
      showToast('Failed to duplicate setlist', 'error')
    }
  }

  // DATABASE INTEGRATION: Archive setlist (using hook)
  const handleArchive = async (setlistId: string) => {
    try {
      await updateSetlist(setlistId, { status: 'archived' })
      setUISetlists(
        uiSetlists.map(s =>
          s.id === setlistId ? { ...s, status: 'archived' as const } : s
        )
      )
      showToast('Setlist archived', 'success')
    } catch (err) {
      console.error('Error archiving setlist:', err)
      showToast('Failed to archive setlist', 'error')
    }
  }

  // DATABASE INTEGRATION: Delete setlist (using hook)
  const handleDelete = async (setlistId: string) => {
    try {
      // Clear any show references (still need db for this query, but it's read-only)
      const shows = await db.practiceSessions
        .where('setlistId')
        .equals(setlistId)
        .toArray()

      const repo = getSyncRepository()
      for (const show of shows) {
        await repo.updatePracticeSession(show.id!, { setlistId: undefined })
      }

      // Delete the setlist using hook
      await deleteSetlist(setlistId)

      // Optimistic UI update — filter from BOTH lists. We don't know at
      // this point whether the deleted setlist was band-scoped (lives
      // in uiSetlists) or personal (lives in personalUISetlists), and
      // checking the setlist object up front is more code than just
      // filtering both — a no-op on whichever list didn't contain it.
      //
      // Without filtering personalUISetlists here, the personal tab
      // would keep showing the deleted row until the user navigates
      // away or a realtime DELETE event lands — both slow / unreliable
      // paths for the user's own write.
      setUISetlists(prev => prev.filter(s => s.id !== setlistId))
      setPersonalUISetlists(prev => prev.filter(s => s.id !== setlistId))

      showToast('Setlist deleted', 'success')
    } catch (err) {
      console.error('Error deleting setlist:', err)
      showToast('Failed to delete setlist', 'error')
    }
  }

  // DATABASE INTEGRATION: Save setlist (using hooks)
  const handleSave = async (updatedSetlist: UISetlist) => {
    try {
      // Convert UI items to database items
      const dbItems: DBSetlistItem[] = updatedSetlist.items.map(item => ({
        id: item.id,
        type: item.type,
        position: item.position,
        songId: item.songId,
        notes: item.notes,
        breakDuration: item.breakDuration,
        breakNotes: item.breakNotes,
        sectionTitle: item.sectionTitle,
      }))

      // Calculate total duration in seconds
      const totalDurationSeconds = calculateSetlistDuration(
        updatedSetlist.items
      )

      const setlistData: Partial<DBSetlist> = {
        name: updatedSetlist.name,
        bandId: updatedSetlist.bandId,
        contextType:
          updatedSetlist.contextType ??
          (updatedSetlist.bandId ? 'band' : 'personal'),
        contextId: updatedSetlist.contextId,
        tags: updatedSetlist.tags ?? [],
        status: updatedSetlist.status,
        items: dbItems,
        totalDuration: totalDurationSeconds,
        notes: updatedSetlist.notes,
        showId: updatedSetlist.showId,
      }

      // Check if setlist exists (read-only operation)
      const exists = await db.setlists.get(updatedSetlist.id)

      if (exists) {
        // Update existing using hook
        await updateSetlist(updatedSetlist.id, setlistData)
      } else {
        // Create new using hook
        await createSetlist({
          ...setlistData,
          id: updatedSetlist.id,
        })
      }

      // Update or add associated show if selected
      if (updatedSetlist.associatedShow) {
        const repo = getSyncRepository()
        await repo.updatePracticeSession(updatedSetlist.associatedShow.id, {
          setlistId: updatedSetlist.id,
        })
      }

      // Reload the appropriate setlists based on what was saved
      const isPersonalSave = updatedSetlist.contextType === 'personal'
      const dbSetlists = isPersonalSave
        ? await db.setlists
            .filter(
              s => s.contextType === 'personal' && s.contextId === currentUserId
            )
            .reverse()
            .toArray()
        : await db.setlists.where('bandId').equals(currentBandId).toArray()

      // Re-convert to UI format (reuse loading logic)
      const reloadedSetlists: UISetlist[] = await Promise.all(
        dbSetlists.map(async dbSetlist => {
          let associatedShow:
            | { id: string; name: string; date: string }
            | undefined
          if (dbSetlist.showId) {
            const show = await db.shows.get(dbSetlist.showId)
            if (show) {
              associatedShow = {
                id: show.id!,
                name: show.name || 'Unnamed Show',
                date: formatShowDate(show.scheduledDate),
              }
            }
          }

          const populatedItems: UISetlistItem[] = await Promise.all(
            (dbSetlist.items || []).map(async item => {
              if (item.type === 'song' && item.songId) {
                const song = await db.songs.get(item.songId)
                if (song) {
                  return {
                    ...item,
                    song: dbSongToUISong(song),
                  }
                }
              }
              return item as UISetlistItem
            })
          )

          const songCount = populatedItems.filter(i => i.type === 'song').length
          const totalDuration = formatTotalDuration(
            calculateSetlistDuration(populatedItems)
          )
          const lastModified = dbSetlist.lastModified
            ? new Date(dbSetlist.lastModified).toLocaleDateString()
            : 'Never'

          return {
            id: dbSetlist.id!,
            name: dbSetlist.name,
            bandId: dbSetlist.bandId,
            showId: dbSetlist.showId,
            songCount,
            totalDuration,
            status: dbSetlist.status,
            associatedShow,
            items: populatedItems,
            lastModified,
            notes: dbSetlist.notes || '',
          }
        })
      )

      if (isPersonalSave) {
        // Refresh the personal setlists list
        void refetchPersonalSetlists()
      } else {
        setUISetlists(reloadedSetlists)
      }

      setEditingSetlist(null)
      showToast('Setlist saved', 'success')
    } catch (err) {
      console.error('Error saving setlist:', err)
      showToast('Failed to save setlist', 'error')
    }
  }

  // If editing, show full-page editor
  if (editingSetlist) {
    const isPersonal = editingSetlist.contextType === 'personal'

    // When copying a band song to personal catalog — returns the new personal song's ID
    const handleCopySongToPersonal = async (song: DBSong): Promise<string> => {
      const newSong = await SongService.createSong({
        title: song.title,
        artist: song.artist ?? '',
        album: song.album,
        duration: song.duration ?? 0,
        key: song.key ?? 'C',
        bpm: song.bpm ?? 120,
        difficulty: (song.difficulty ?? 1) as 1 | 2 | 3 | 4 | 5,
        guitarTuning: song.guitarTuning,
        notes: song.notes,
        referenceLinks: song.referenceLinks ?? [],
        bandId: '', // Not used for personal songs
        contextType: 'personal',
        contextId: currentUserId,
        createdBy: currentUserId,
        visibility: 'personal',
      })
      // Refresh personal songs in state so the drawer shows the new song
      if (currentUserId) {
        const refreshed = await db.songs
          .where('contextType')
          .equals('personal')
          .and(s => s.contextId === currentUserId)
          .toArray()
        setPersonalDbSongs(refreshed)
      }
      return newSong.id!
    }

    return (
      <SetlistEditorPage
        setlist={editingSetlist}
        availableSongs={availableSongs}
        availableShows={availableShows}
        availablePractices={availablePractices}
        dbSongs={isPersonal ? personalDbSongs : dbSongs}
        bandDbSongs={isPersonal ? dbSongs : undefined}
        dbSetlists={dbSetlists}
        isPersonalSetlist={isPersonal}
        onBack={() => setEditingSetlist(null)}
        onSave={handleSave}
        onCopySongToPersonal={isPersonal ? handleCopySongToPersonal : undefined}
      />
    )
  }

  // Otherwise, show grid view
  return (
    <ContentLoadingSpinner isLoading={loading}>
      <div data-testid="setlists-page" className="max-w-6xl mx-auto">
        {/* Show error state */}
        {error && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-danger text-sm mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!error && (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h1 className="text-2xl font-bold text-white">Setlists</h1>
                <ChevronDown size={20} className="text-ink-3" />
              </div>

              {/* Band / Personal tab switcher — only in a band context;
                  personal context has a single (personal) catalog. */}
              {currentBandId && (
                <div className="flex gap-1 mb-6 bg-bg-2 rounded-lg p-1 w-fit">
                  <button
                    data-testid="setlists-band-tab"
                    onClick={() => setActiveTab('band')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'band'
                        ? 'bg-accent text-white'
                        : 'text-ink-3 hover:text-white'
                    }`}
                  >
                    Band Setlists
                  </button>
                  <button
                    data-testid="setlists-personal-tab"
                    onClick={() => setActiveTab('personal')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'personal'
                        ? 'bg-accent text-white'
                        : 'text-ink-3 hover:text-white'
                    }`}
                  >
                    My Setlists
                    {activeTab === 'personal' && personalSetlistsLoading && (
                      <span className="ml-2 text-xs opacity-60">...</span>
                    )}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="w-44">
                  <Dropdown
                    data-testid="setlists-status-filter"
                    value={filterStatus}
                    onChange={value =>
                      setFilterStatus(value as typeof filterStatus)
                    }
                    groups={[
                      {
                        options: [
                          { value: 'all', label: 'All Setlists' },
                          { value: 'active', label: 'Active' },
                          { value: 'draft', label: 'Drafts' },
                          { value: 'archived', label: 'Archived' },
                        ],
                      },
                    ]}
                  />
                </div>

                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search
                      size={20}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
                    />
                    <input
                      type="text"
                      placeholder="Search setlists"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-11 pr-4 bg-bg-2 border border-border-1 rounded-lg text-white text-sm placeholder-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>

                <button
                  onClick={() => void handleCreateNew()}
                  data-testid="create-setlist-button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors"
                >
                  <Plus size={20} />
                  <span>
                    {activeTab === 'personal'
                      ? 'Create Personal Setlist'
                      : 'Create Setlist'}
                  </span>
                </button>
              </div>
            </div>

            {filteredSetlists.length === 0 ? (
              <div
                data-testid="setlist-empty-state"
                className="flex flex-col items-center justify-center py-20"
              >
                <ListMusic size={64} className="text-border-1 mb-4" />
                <h3 className="text-white font-semibold text-lg mb-2">
                  No setlists yet
                </h3>
                <p className="text-ink-4 text-sm mb-6">
                  Create your first setlist to get started
                </p>
                <button
                  onClick={() => void handleCreateNew()}
                  data-testid="create-setlist-button"
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors"
                >
                  <Plus size={20} />
                  <span>
                    {activeTab === 'personal'
                      ? 'Create Personal Setlist'
                      : 'Create Setlist'}
                  </span>
                </button>
              </div>
            ) : (
              <div
                data-testid="setlist-list"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-sm md:max-w-none mx-auto md:mx-0"
              >
                {filteredSetlists.map(setlist => (
                  <SetlistCard
                    key={setlist.id}
                    setlist={setlist}
                    onClick={() => {
                      if (setlist.contextType === 'personal') {
                        // Open personal setlists in the inline editor (not SetlistViewPage)
                        handleEdit(setlist)
                      } else {
                        navigate(`/setlists/${setlist.id}`)
                      }
                    }}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onNavigateToShow={showId => navigate(`/shows/${showId}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ContentLoadingSpinner>
  )
}
