import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ModernLayout } from '../../components/layout/ModernLayout'
import { useAuth } from '../../contexts/AuthContext'
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
  Guitar,
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
import { db } from '../../services/database'
import { secondsToDuration } from '../../utils/formatters'
import { formatShowDate } from '../../utils/dateHelpers'
import type {
  SetlistItem as DBSetlistItem,
  Setlist as DBSetlist,
} from '../../models/Setlist'
import type { Song as DBSong } from '../../models/Song'
import {
  useCreateSetlist,
  useUpdateSetlist,
  useDeleteSetlist,
} from '../../hooks/useSetlists'
// PHASE 2: Sync status visualization
import { SyncIcon } from '../../components/sync/SyncIcon'
import { useItemStatus } from '../../hooks/useItemSyncStatus'

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
  bandId: string
  showId?: string
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
        className={`flex flex-col gap-2 p-3 sm:p-4 bg-[#0f0f0f] border border-dashed border-[#3a3a3a] rounded-lg group hover:border-[#4a4a4a] transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        {/* Mobile: Stacked layout */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
          >
            <GripVertical size={18} />
          </button>

          <div className="w-6 text-center flex-shrink-0">
            <Coffee size={18} className="text-[#707070]" />
          </div>

          <span className="text-sm font-medium text-[#a0a0a0] flex-shrink-0">
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
              className="w-16 h-8 px-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white text-sm text-center placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
            />
            <span className="text-xs text-[#707070]">min</span>
          </div>

          <button
            onClick={() => onRemove(item.id)}
            className="ml-auto p-1.5 text-[#707070] hover:text-red-500 hover:bg-red-500/10 rounded transition-all flex-shrink-0"
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
            className="w-full h-8 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
          />
        </div>

        {/* Desktop: Single row layout */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors"
          >
            <GripVertical size={18} />
          </button>

          <div className="w-6 text-center">
            <Coffee size={18} className="text-[#707070]" />
          </div>

          <span className="text-sm font-medium text-[#a0a0a0]">Break</span>

          <input
            type="text"
            placeholder="Break notes..."
            value={item.breakNotes || ''}
            onChange={e =>
              onUpdateItem(item.id, { breakNotes: e.target.value })
            }
            className="flex-1 h-8 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
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
            className="w-20 h-8 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white text-sm text-center placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
          />
          <span className="text-xs text-[#707070]">min</span>

          <button
            onClick={() => onRemove(item.id)}
            className="opacity-0 group-hover:opacity-100 text-[#707070] hover:text-red-500 transition-all"
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
        className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-[#f17827ff]/10 to-transparent border border-[#f17827ff]/30 rounded-lg group hover:border-[#f17827ff]/50 transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
        >
          <GripVertical size={18} />
        </button>

        <div className="w-6 text-center flex-shrink-0">
          <Layers size={18} className="text-[#f17827ff]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[#f17827ff] text-sm font-semibold truncate">
            {item.sectionTitle}
          </div>
        </div>

        <button
          onClick={() => onRemove(item.id)}
          className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-[#707070] hover:text-red-500 hover:bg-red-500/10 rounded transition-all flex-shrink-0"
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
        className={`flex flex-col bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg group hover:border-[#3a3a3a] transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        {/* Main row */}
        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
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

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {onAddToPractice && (
              <button
                onClick={() => onAddToPractice(song.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-[#707070] hover:text-[#f17827ff] hover:bg-[#f17827ff]/10 rounded transition-all"
                title="Add to Practice"
              >
                <Play size={16} />
              </button>
            )}
            <button
              onClick={() => onRemove(item.id)}
              data-testid={`remove-item-${item.position - 1}`}
              className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-[#707070] hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
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
              className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none resize-none"
              rows={2}
              autoFocus
            />
          ) : (
            <div
              onClick={() => setIsEditingNotes(true)}
              className="text-[#707070] text-sm cursor-text hover:text-[#a0a0a0] transition-colors"
            >
              {item.notes ? (
                <span className="text-[#a0a0a0]">{item.notes}</span>
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
  onEdit: (setlist: UISetlist) => void
  onDuplicate: (setlist: UISetlist) => void
  onArchive: (setlistId: string) => void
  onDelete: (setlistId: string) => void
}

const SetlistCard: React.FC<SetlistCardProps> = ({
  setlist,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}) => {
  // PHASE 2: Get sync status for this setlist
  const syncStatus = useItemStatus(setlist.id)

  const [showActions, setShowActions] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-[#f17827ff] text-white'
      case 'draft':
        return 'bg-[#505050] text-white'
      case 'archived':
        return 'bg-[#2a2a2a] text-[#707070]'
      default:
        return 'bg-[#505050] text-white'
    }
  }

  const songItems = setlist.items.filter(item => item.type === 'song')

  return (
    <div
      data-testid={`setlist-card-${setlist.name}`}
      className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        {/* PHASE 2: Sync Icon */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-1">
            <SyncIcon status={syncStatus} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              data-testid="setlist-name"
              className="text-white font-semibold text-base mb-1 truncate"
            >
              {setlist.name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(setlist.status)}`}
              >
                {setlist.status.charAt(0).toUpperCase() +
                  setlist.status.slice(1)}
              </span>
              {setlist.associatedShow && (
                <div className="flex items-center gap-1 text-[#a0a0a0] text-xs">
                  <Calendar size={12} />
                  <span>{setlist.associatedShow.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1 text-[#707070] hover:text-white transition-colors"
          >
            <MoreVertical size={18} />
          </button>

          {showActions && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowActions(false)}
              />
              <div className="absolute right-0 top-8 w-40 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => {
                    onEdit(setlist)
                    setShowActions(false)
                  }}
                  data-testid={`edit-setlist-${setlist.id}`}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
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
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
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
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
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
                  className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[#a0a0a0] text-sm mb-3">
        <div className="flex items-center gap-1">
          <Music2 size={14} />
          <span data-testid={`setlist-song-count-${setlist.id}`}>
            {songItems.length} songs
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={14} />
          <span data-testid={`setlist-duration-${setlist.id}`}>
            {formatTotalDuration(calculateSetlistDuration(setlist.items))}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {songItems.slice(0, 5).map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span className="text-[#505050] w-4">{index + 1}.</span>
            <span className="text-[#a0a0a0] truncate flex-1">
              {item.song?.title}
            </span>
            <span className="text-[#707070]">{item.song?.duration}</span>
          </div>
        ))}
        {songItems.length > 5 && (
          <div className="text-[#505050] text-xs pl-6">
            +{songItems.length - 5} more...
          </div>
        )}
      </div>

      <button
        onClick={() => onEdit(setlist)}
        className="w-full py-2 rounded-lg border border-[#2a2a2a] text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
      >
        Edit Setlist
      </button>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            data-testid="delete-setlist-modal"
            className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg mb-2">
              Delete Setlist?
            </h3>
            <p className="text-[#a0a0a0] text-sm mb-6">
              Are you sure you want to delete "{setlist.name}"? This action
              cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                data-testid="cancel-delete-setlist"
                className="px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(setlist.id)
                  setShowDeleteConfirm(false)
                }}
                data-testid="confirm-delete-setlist"
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
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
  onBack: () => void
  onSave: (setlist: UISetlist) => void
}

const SetlistEditorPage: React.FC<SetlistEditorPageProps> = ({
  setlist,
  availableSongs,
  availableShows,
  availablePractices,
  onBack,
  onSave,
}) => {
  const [editedSetlist, setEditedSetlist] = useState<UISetlist>(setlist)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTuning, setSelectedTuning] = useState<string>('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showPracticeMenu, setShowPracticeMenu] = useState(false)

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

  const addSongToSetlist = (song: UISong) => {
    const newPosition = editedSetlist.items.length + 1
    const newItem: UISetlistItem = {
      id: crypto.randomUUID(), // DATABASE INTEGRATION: Use crypto.randomUUID()
      type: 'song',
      position: newPosition,
      song: song,
      songId: song.id, // DATABASE INTEGRATION: Store songId for database
    }

    setEditedSetlist(prev => ({
      ...prev,
      items: [...prev.items, newItem],
      songCount: prev.items.filter(i => i.type === 'song').length + 1,
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
    const sectionTitle = prompt('Enter section title:')
    if (!sectionTitle) return

    const newPosition = editedSetlist.items.length + 1
    const newItem: UISetlistItem = {
      id: crypto.randomUUID(), // DATABASE INTEGRATION: Use crypto.randomUUID()
      type: 'section',
      position: newPosition,
      sectionTitle,
    }

    setEditedSetlist(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }))
    setShowAddMenu(false)
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
      alert(
        `Added ${editedSetlist.items.filter(i => i.type === 'song').length} songs to ${practice.name}`
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
      alert(`Added "${song.title}" to practice`)
    }
  }

  // Filter songs that are already in the setlist
  const songsInSetlist = new Set(
    editedSetlist.items
      .filter(item => item.type === 'song' && item.song)
      .map(item => item.song!.id)
  )

  const filteredSongs = availableSongs
    .filter(song => !songsInSetlist.has(song.id))
    .filter(song => {
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTuning = !selectedTuning || song.tuning === selectedTuning
      return matchesSearch && matchesTuning
    })

  const availableTunings = Array.from(
    new Set(availableSongs.map(s => s.tuning))
  ).sort()

  const totalDuration = calculateSetlistDuration(editedSetlist.items)
  const songCount = editedSetlist.items.filter(i => i.type === 'song').length

  const [showDetails, setShowDetails] = useState(false)

  return (
    <div
      data-testid="setlist-modal"
      className="fixed inset-0 bg-[#121212] z-50 flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#121212] flex-shrink-0">
        {/* Main header row */}
        <div className="flex items-center justify-between gap-3 px-3 sm:px-6 py-2 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 text-[#707070] hover:text-white transition-colors rounded-lg hover:bg-[#1a1a1a] flex-shrink-0"
            >
              <ArrowLeft size={18} className="sm:hidden" />
              <ArrowLeft size={20} className="hidden sm:block" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="hidden sm:flex items-center gap-2 text-xs text-[#707070] mb-1">
                <span>Setlists</span>
                <ChevronRight size={14} />
                <span className="text-[#a0a0a0]">Edit</span>
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
              className="sm:hidden p-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white hover:bg-[#1f1f1f] transition-colors"
              title="Cancel"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleSave}
              className="sm:hidden p-2 rounded-lg bg-[#f17827ff] text-white hover:bg-[#d66920] transition-colors"
              title="Save"
            >
              <Check size={18} />
            </button>

            {/* Desktop: Text buttons */}
            <button
              onClick={onBack}
              data-testid="cancel-setlist-button"
              className="hidden sm:block px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              data-testid="save-setlist-button"
              className="hidden sm:block px-6 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
            >
              Save Setlist
            </button>

            {/* Mobile: Details toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="sm:hidden p-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white hover:bg-[#1f1f1f] transition-colors"
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
          <div className="sm:hidden px-3 py-3 border-t border-[#2a2a2a] bg-[#0f0f0f] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#a0a0a0] mb-1.5">
                  Status
                </label>
                <select
                  name="status"
                  id="setlist-status"
                  data-testid="setlist-status-select"
                  value={editedSetlist.status}
                  onChange={e =>
                    setEditedSetlist({
                      ...editedSetlist,
                      status: e.target.value as 'draft' | 'active' | 'archived',
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#a0a0a0] mb-1.5">
                  Statistics
                </label>
                <div className="flex items-center gap-2 text-xs text-[#a0a0a0] h-9">
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
              <label className="block text-xs text-[#a0a0a0] mb-1.5">
                Associated Show
              </label>
              <select
                name="associatedShow"
                id="setlist-show"
                data-testid="setlist-show-select"
                value={editedSetlist.associatedShow?.id || ''}
                onChange={e => {
                  const show = availableShows.find(s => s.id === e.target.value)
                  setEditedSetlist({ ...editedSetlist, associatedShow: show })
                }}
                className="w-full h-9 px-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none"
              >
                <option value="">No show</option>
                {availableShows.map(show => (
                  <option key={show.id} value={show.id}>
                    {show.name} - {show.date}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#a0a0a0] mb-1.5">
                Notes
              </label>
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
                className="w-full h-9 px-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Desktop: Metadata Bar */}
        <div className="hidden sm:block px-6 py-4 border-t border-[#2a2a2a] bg-[#0f0f0f]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-[#a0a0a0] mb-2">
                Status
              </label>
              <select
                name="status"
                id="setlist-status"
                data-testid="setlist-status-select"
                value={editedSetlist.status}
                onChange={e =>
                  setEditedSetlist({
                    ...editedSetlist,
                    status: e.target.value as 'draft' | 'active' | 'archived',
                  })
                }
                className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#a0a0a0] mb-2">
                Associated Show
              </label>
              <select
                name="associatedShow"
                id="setlist-show"
                data-testid="setlist-show-select"
                value={editedSetlist.associatedShow?.id || ''}
                onChange={e => {
                  const show = availableShows.find(s => s.id === e.target.value)
                  setEditedSetlist({ ...editedSetlist, associatedShow: show })
                }}
                className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              >
                <option value="">No show</option>
                {availableShows.map(show => (
                  <option key={show.id} value={show.id}>
                    {show.name} - {show.date}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#a0a0a0] mb-2">Notes</label>
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
                className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              />
            </div>

            <div>
              <label className="block text-xs text-[#a0a0a0] mb-2">
                Statistics
              </label>
              <div className="flex items-center gap-3 text-sm text-[#a0a0a0] h-10">
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
                    className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors w-full sm:w-auto"
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
                      <div className="absolute right-0 top-12 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-20 py-1">
                        <button
                          onClick={() => {
                            setIsDrawerOpen(true)
                            setShowAddMenu(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        >
                          <Music2 size={14} />
                          Add Song
                        </button>
                        <button
                          onClick={addBreakToSetlist}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        >
                          <Coffee size={14} />
                          Add Break
                        </button>
                        <button
                          onClick={addSectionToSetlist}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
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
                  className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors w-full sm:w-auto"
                >
                  <Plus size={18} />
                  <span>Add Songs</span>
                </button>

                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => setShowPracticeMenu(!showPracticeMenu)}
                    className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg border border-[#f17827ff] bg-[#f17827ff]/10 text-[#f17827ff] text-sm font-medium hover:bg-[#f17827ff]/20 transition-colors w-full sm:w-auto whitespace-nowrap"
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
                      <div className="absolute right-0 top-12 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-20 py-1">
                        {availablePractices.map(practice => (
                          <button
                            key={practice.id}
                            onClick={() => handleAddToPractice(practice.id)}
                            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors"
                          >
                            <div className="font-medium">{practice.name}</div>
                            <div className="text-xs text-[#707070]">
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
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#2a2a2a] rounded-xl">
                <ListMusic size={48} className="text-[#2a2a2a] mb-3" />
                <p className="text-[#707070] text-sm mb-1">No items yet</p>
                <p className="text-[#505050] text-xs mb-4">
                  Add songs, breaks, or sections to your setlist
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
        {isDrawerOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setIsDrawerOpen(false)}
            />
            <div className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-[#0f0f0f] border-l border-[#2a2a2a] shadow-2xl z-50 flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] flex-shrink-0">
                <h3 className="text-white font-semibold text-lg">
                  Browse Songs
                </h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 text-[#707070] hover:text-white transition-colors rounded-lg hover:bg-[#1a1a1a]"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="px-6 py-4 border-b border-[#2a2a2a] space-y-3 flex-shrink-0">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]"
                  />
                  <input
                    type="text"
                    placeholder="Search songs..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  />
                </div>

                <select
                  value={selectedTuning}
                  onChange={e => setSelectedTuning(e.target.value)}
                  className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                >
                  <option value="">All Tunings</option>
                  {availableTunings.map(tuning => (
                    <option key={tuning} value={tuning}>
                      {tuning}
                    </option>
                  ))}
                </select>
              </div>

              {/* Songs List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-6 py-4">
                <div data-testid="available-songs-list" className="space-y-2">
                  {filteredSongs.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-[#707070] text-sm">
                        No songs available
                      </p>
                      <p className="text-[#505050] text-xs mt-1">
                        {songsInSetlist.size > 0
                          ? 'All songs have been added'
                          : 'Try adjusting your search'}
                      </p>
                    </div>
                  ) : (
                    filteredSongs.map(song => (
                      <button
                        key={song.id}
                        onClick={() => addSongToSetlist(song)}
                        data-testid={`available-song-${song.id}`}
                        className="w-full flex items-center gap-3 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#f17827ff] hover:bg-[#1f1f1f] transition-colors text-left group"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
                          style={{ backgroundColor: song.avatarColor }}
                        >
                          {song.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">
                            {song.title}
                          </div>
                          <div className="text-[#707070] text-xs truncate">
                            {song.artist}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[#505050]">
                            <span className="flex items-center gap-1">
                              <Guitar size={12} />
                              {song.tuning}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {song.duration}
                            </span>
                          </div>
                        </div>
                        <Plus
                          size={18}
                          className="text-[#505050] group-hover:text-[#f17827ff] transition-colors flex-shrink-0"
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Main Setlists Page Component
export const SetlistsPage: React.FC = () => {
  const navigate = useNavigate()

  // Get auth context for user info and sign out
  const { currentUser, currentBand, signOut } = useAuth()

  // DATABASE INTEGRATION: Get currentBandId from localStorage
  const [currentBandId] = useState(
    () => localStorage.getItem('currentBandId') || ''
  )

  // DATABASE INTEGRATION: Use hooks for setlist operations
  const { createSetlist } = useCreateSetlist()
  const { updateSetlist } = useUpdateSetlist()
  const { deleteSetlist } = useDeleteSetlist()

  // DATABASE INTEGRATION: State for UI data
  const [uiSetlists, setUISetlists] = useState<UISetlist[]>([])
  const [availableSongs, setAvailableSongs] = useState<UISong[]>([])
  const [availableShows, setAvailableShows] = useState<UIShow[]>([])
  const [availablePractices, setAvailablePractices] = useState<UIPractice[]>([])
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
        setError('No band selected')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load setlists for the band
        const dbSetlists = await db.setlists
          .where('bandId')
          .equals(currentBandId)
          .toArray()

        // Load songs for the band
        const dbSongs = await db.songs
          .where('contextType')
          .equals('band')
          .and(s => s.contextId === currentBandId)
          .toArray()

        // Convert songs to UI format
        const uiSongs: UISong[] = dbSongs.map(dbSongToUISong)

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
          dbSetlists.map(async dbSetlist => {
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
  }, [currentBandId])

  const filteredSetlists = uiSetlists.filter(setlist => {
    const matchesStatus =
      filterStatus === 'all' || setlist.status === filterStatus
    const matchesSearch = setlist.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // DATABASE INTEGRATION: Create new setlist
  const handleCreateNew = async () => {
    if (!currentBandId) {
      alert('No band selected')
      return
    }

    const newSetlist: UISetlist = {
      id: crypto.randomUUID(),
      name: 'New Setlist',
      bandId: currentBandId,
      songCount: 0,
      totalDuration: '0 min',
      status: 'draft',
      items: [],
      lastModified: 'Just now',
      notes: '',
    }
    setEditingSetlist(newSetlist)
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

      alert('Setlist duplicated successfully!')
    } catch (err) {
      console.error('Error duplicating setlist:', err)
      alert('Failed to duplicate setlist')
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
      alert('Setlist archived successfully!')
    } catch (err) {
      console.error('Error archiving setlist:', err)
      alert('Failed to archive setlist')
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

      for (const show of shows) {
        await db.practiceSessions.update(show.id!, { setlistId: undefined })
      }

      // Delete the setlist using hook
      await deleteSetlist(setlistId)

      // Update UI state
      setUISetlists(uiSetlists.filter(s => s.id !== setlistId))

      alert('Setlist deleted successfully!')
    } catch (err) {
      console.error('Error deleting setlist:', err)
      alert('Failed to delete setlist')
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
        await db.practiceSessions.update(updatedSetlist.associatedShow.id, {
          setlistId: updatedSetlist.id,
        })
      }

      // Reload data to ensure UI is in sync
      const dbSetlists = await db.setlists
        .where('bandId')
        .equals(currentBandId)
        .toArray()

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

      setUISetlists(reloadedSetlists)

      alert('Setlist saved successfully!')
    } catch (err) {
      console.error('Error saving setlist:', err)
      alert('Failed to save setlist')
    }
  }

  const handleSignOut = async () => {
    // signOut() now calls logout() internally to clear all state
    await signOut()
    navigate('/auth')
  }

  // DATABASE INTEGRATION: Show loading state
  if (loading) {
    return (
      <ModernLayout
        bandName={currentBand?.name || 'No Band Selected'}
        userEmail={currentUser?.email || 'Not logged in'}
        onSignOut={handleSignOut}
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f17827ff] mx-auto mb-4"></div>
            <p className="text-[#a0a0a0] text-sm">Loading setlists...</p>
          </div>
        </div>
      </ModernLayout>
    )
  }

  // DATABASE INTEGRATION: Show error state
  if (error) {
    return (
      <ModernLayout
        bandName={currentBand?.name || 'No Band Selected'}
        userEmail={currentUser?.email || 'Not logged in'}
        onSignOut={handleSignOut}
      >
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
      </ModernLayout>
    )
  }

  // If editing, show full-page editor
  if (editingSetlist) {
    return (
      <SetlistEditorPage
        setlist={editingSetlist}
        availableSongs={availableSongs}
        availableShows={availableShows}
        availablePractices={availablePractices}
        onBack={() => setEditingSetlist(null)}
        onSave={handleSave}
      />
    )
  }

  // Otherwise, show grid view
  return (
    <ModernLayout
      bandName={currentBand?.name || 'No Band Selected'}
      userEmail={currentUser?.email || 'Not logged in'}
      onSignOut={handleSignOut}
    >
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold text-white">Setlists</h1>
          <ChevronDown size={20} className="text-[#a0a0a0]" />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <select
            value={filterStatus}
            onChange={e =>
              setFilterStatus(e.target.value as typeof filterStatus)
            }
            className="h-10 px-4 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
          >
            <option value="all">All Setlists</option>
            <option value="active">Active</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
          </select>

          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]"
              />
              <input
                type="text"
                placeholder="Search setlists"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-11 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              />
            </div>
          </div>

          <button
            onClick={handleCreateNew}
            data-testid="create-setlist-button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
          >
            <Plus size={20} />
            <span>Create Setlist</span>
          </button>
        </div>
      </div>

      {filteredSetlists.length === 0 ? (
        <div
          data-testid="setlist-empty-state"
          className="flex flex-col items-center justify-center py-20"
        >
          <ListMusic size={64} className="text-[#2a2a2a] mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">
            No setlists yet
          </h3>
          <p className="text-[#707070] text-sm mb-6">
            Create your first setlist to get started
          </p>
          <button
            onClick={handleCreateNew}
            data-testid="create-setlist-button"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
          >
            <Plus size={20} />
            <span>Create Setlist</span>
          </button>
        </div>
      ) : (
        <div
          data-testid="setlist-list"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredSetlists.map(setlist => (
            <SetlistCard
              key={setlist.id}
              setlist={setlist}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </ModernLayout>
  )
}
