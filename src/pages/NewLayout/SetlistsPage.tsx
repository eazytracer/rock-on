import React, { useState } from 'react'
import { ModernLayout } from '../../components/layout/ModernLayout'
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
  Play
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Types
interface Song {
  id: string
  title: string
  artist: string
  duration: string
  durationSeconds: number
  key: string
  tuning: string
  bpm: string
  album?: string
  initials: string
  avatarColor: string
}

interface SetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number
  song?: Song
  breakDuration?: number // in minutes
  breakNotes?: string
  sectionTitle?: string
  notes?: string // notes for individual songs in setlist
}

interface Setlist {
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
  items: SetlistItem[]
  lastModified: string
  notes: string
}

interface Show {
  id: string
  name: string
  date: string
}

interface Practice {
  id: string
  name: string
  date: string
}

// Mock Songs Library
const MOCK_SONGS: Song[] = [
  {
    id: 's1',
    title: 'All Star',
    artist: 'Smash Mouth',
    album: 'Astro Lounge',
    duration: '3:14',
    durationSeconds: 194,
    key: 'F#',
    tuning: 'Standard',
    bpm: '104',
    initials: 'AS',
    avatarColor: '#3b82f6'
  },
  {
    id: 's2',
    title: 'Man in the Box',
    artist: 'Alice In Chains',
    album: 'Facelift',
    duration: '4:47',
    durationSeconds: 287,
    key: 'Ebm',
    tuning: 'Half-step down',
    bpm: '108',
    initials: 'MB',
    avatarColor: '#8b5cf6'
  },
  {
    id: 's3',
    title: 'No Rain',
    artist: 'Blind Melon',
    album: 'Blind Melon',
    duration: '3:33',
    durationSeconds: 213,
    key: 'E',
    tuning: 'Standard',
    bpm: '150',
    initials: 'NR',
    avatarColor: '#ec4899'
  },
  {
    id: 's4',
    title: 'Monkey Wrench',
    artist: 'Foo Fighters',
    album: 'The Colour and the Shape',
    duration: '3:51',
    durationSeconds: 231,
    key: 'B',
    tuning: 'Drop D',
    bpm: '175',
    initials: 'MW',
    avatarColor: '#f59e0b'
  },
  {
    id: 's5',
    title: 'Everlong',
    artist: 'Foo Fighters',
    album: 'The Colour and the Shape',
    duration: '4:10',
    durationSeconds: 250,
    key: 'D',
    tuning: 'Drop D',
    bpm: '158',
    initials: 'EV',
    avatarColor: '#f43f5e'
  },
  {
    id: 's6',
    title: 'Wonderwall',
    artist: 'Oasis',
    album: '(What\'s the Story) Morning Glory?',
    duration: '4:18',
    durationSeconds: 258,
    key: 'F#m',
    tuning: 'Standard',
    bpm: '87',
    initials: 'WW',
    avatarColor: '#14b8a6'
  },
  {
    id: 's7',
    title: 'Sweet Child O Mine',
    artist: "Guns N' Roses",
    album: 'Appetite for Destruction',
    duration: '5:56',
    durationSeconds: 356,
    key: 'D',
    tuning: 'Half-step down',
    bpm: '125',
    initials: 'SC',
    avatarColor: '#ef4444'
  },
  {
    id: 's8',
    title: 'Black',
    artist: 'Pearl Jam',
    album: 'Ten',
    duration: '5:44',
    durationSeconds: 344,
    key: 'E',
    tuning: 'Standard',
    bpm: '107',
    initials: 'BL',
    avatarColor: '#6366f1'
  },
  {
    id: 's9',
    title: 'Livin on a Prayer',
    artist: 'Bon Jovi',
    album: 'Slippery When Wet',
    duration: '4:09',
    durationSeconds: 249,
    key: 'Em',
    tuning: 'Standard',
    bpm: '123',
    initials: 'LP',
    avatarColor: '#a855f7'
  },
  {
    id: 's10',
    title: 'Dont Stop Believin',
    artist: 'Journey',
    album: 'Escape',
    duration: '4:11',
    durationSeconds: 251,
    key: 'E',
    tuning: 'Standard',
    bpm: '119',
    initials: 'DS',
    avatarColor: '#84cc16'
  },
  {
    id: 's11',
    title: 'I Want You to Want Me',
    artist: 'Cheap Trick',
    album: 'At Budokan',
    duration: '3:03',
    durationSeconds: 183,
    key: 'A',
    tuning: 'Standard',
    bpm: '135',
    initials: 'IW',
    avatarColor: '#eab308'
  },
  {
    id: 's12',
    title: 'Brown Eyed Girl',
    artist: 'Van Morrison',
    album: 'Blowin\' Your Mind!',
    duration: '3:05',
    durationSeconds: 185,
    key: 'G',
    tuning: 'Standard',
    bpm: '140',
    initials: 'BE',
    avatarColor: '#10b981'
  },
  {
    id: 's13',
    title: 'Thinking Out Loud',
    artist: 'Ed Sheeran',
    album: 'x',
    duration: '4:41',
    durationSeconds: 281,
    key: 'D',
    tuning: 'Standard',
    bpm: '79',
    initials: 'TO',
    avatarColor: '#06b6d4'
  },
  {
    id: 's14',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    album: 'Divide',
    duration: '4:23',
    durationSeconds: 263,
    key: 'Ab',
    tuning: 'Standard',
    bpm: '63',
    initials: 'PE',
    avatarColor: '#d946ef'
  },
  {
    id: 's15',
    title: 'All of Me',
    artist: 'John Legend',
    album: 'Love in the Future',
    duration: '4:29',
    durationSeconds: 269,
    key: 'Ab',
    tuning: 'Standard',
    bpm: '126',
    initials: 'AO',
    avatarColor: '#f97316'
  }
]

// Mock Shows
const MOCK_SHOWS: Show[] = [
  { id: 'sh1', name: 'Toys 4 Tots', date: 'Dec 8th, 2025' },
  { id: 'sh2', name: 'The Wedding Barn', date: 'Jan 15th, 2026' },
  { id: 'sh3', name: 'Downtown Brewery', date: 'Feb 3rd, 2026' },
  { id: 'sh4', name: 'Summer Fest', date: 'Jul 12th, 2026' }
]

// Mock Practices
const MOCK_PRACTICES: Practice[] = [
  { id: 'p1', name: 'Practice Session', date: 'Nov 1st, 2025' },
  { id: 'p2', name: 'Band Practice', date: 'Nov 8th, 2025' },
  { id: 'p3', name: 'Rehearsal', date: 'Nov 15th, 2025' }
]

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
const calculateSetlistDuration = (items: SetlistItem[]): number => {
  return items.reduce((total, item) => {
    if (item.type === 'song' && item.song) {
      return total + item.song.durationSeconds
    } else if (item.type === 'break' && item.breakDuration) {
      return total + item.breakDuration * 60
    }
    return total
  }, 0)
}

// Mock Setlists with Items
const INITIAL_SETLISTS: Setlist[] = [
  {
    id: '1',
    name: 'Rock Night at Brewery',
    songCount: 8,
    totalDuration: '35 min',
    status: 'active',
    associatedShow: MOCK_SHOWS[2],
    items: [
      { id: 'i1', type: 'song', position: 1, song: MOCK_SONGS[0] },
      { id: 'i2', type: 'song', position: 2, song: MOCK_SONGS[1] },
      { id: 'i3', type: 'song', position: 3, song: MOCK_SONGS[2] },
      { id: 'i4', type: 'break', position: 4, breakDuration: 15 },
      { id: 'i5', type: 'song', position: 5, song: MOCK_SONGS[3] },
      { id: 'i6', type: 'song', position: 6, song: MOCK_SONGS[4] },
      { id: 'i7', type: 'section', position: 7, sectionTitle: 'Classic Rock' },
      { id: 'i8', type: 'song', position: 8, song: MOCK_SONGS[6] },
      { id: 'i9', type: 'song', position: 9, song: MOCK_SONGS[7] }
    ],
    lastModified: '2 days ago',
    notes: 'Start with high energy, slow down mid-set'
  },
  {
    id: '2',
    name: 'Wedding Reception Set',
    songCount: 12,
    totalDuration: '48 min',
    status: 'active',
    associatedShow: MOCK_SHOWS[1],
    items: [
      { id: 'i10', type: 'song', position: 1, song: MOCK_SONGS[12] },
      { id: 'i11', type: 'song', position: 2, song: MOCK_SONGS[13] },
      { id: 'i12', type: 'song', position: 3, song: MOCK_SONGS[14] }
    ],
    lastModified: '5 days ago',
    notes: 'Keep it family-friendly, romantic vibe early on'
  },
  {
    id: '3',
    name: 'Toys 4 Tots Charity Show',
    songCount: 10,
    totalDuration: '42 min',
    status: 'active',
    associatedShow: MOCK_SHOWS[0],
    items: [
      { id: 'i13', type: 'song', position: 1, song: MOCK_SONGS[0] },
      { id: 'i14', type: 'song', position: 2, song: MOCK_SONGS[2] }
    ],
    lastModified: '1 week ago',
    notes: 'Holiday themed, upbeat and fun'
  },
  {
    id: '4',
    name: '90s Grunge Set',
    songCount: 6,
    totalDuration: '28 min',
    status: 'draft',
    items: [
      { id: 'i15', type: 'song', position: 1, song: MOCK_SONGS[1] },
      { id: 'i16', type: 'song', position: 2, song: MOCK_SONGS[2] }
    ],
    lastModified: '2 weeks ago',
    notes: 'All 90s alternative/grunge'
  }
]

// Draggable Setlist Item Component
interface SortableSetlistItemProps {
  item: SetlistItem
  onRemove: (itemId: string) => void
  onUpdateItem: (itemId: string, updates: Partial<SetlistItem>) => void
  onAddToPractice?: (songId: string) => void
}

const SortableSetlistItem: React.FC<SortableSetlistItemProps> = ({ item, onRemove, onUpdateItem, onAddToPractice }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  // Render Break Item
  if (item.type === 'break') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex flex-col gap-2 p-4 bg-[#0f0f0f] border border-dashed border-[#3a3a3a] rounded-lg group hover:border-[#4a4a4a] transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-[#505050] hover:text-[#a0a0a0] transition-colors"
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
            onChange={(e) => onUpdateItem(item.id, { breakNotes: e.target.value })}
            className="flex-1 h-8 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
          />

          <input
            type="number"
            placeholder="15"
            value={item.breakDuration || ''}
            onChange={(e) => onUpdateItem(item.id, { breakDuration: parseInt(e.target.value) || 0 })}
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
        className={`flex items-center gap-3 p-4 bg-gradient-to-r from-[#f17827ff]/10 to-transparent border border-[#f17827ff]/30 rounded-lg group hover:border-[#f17827ff]/50 transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-[#505050] hover:text-[#a0a0a0] transition-colors"
        >
          <GripVertical size={18} />
        </button>

        <div className="w-6 text-center">
          <Layers size={18} className="text-[#f17827ff]" />
        </div>

        <div className="flex-1">
          <div className="text-[#f17827ff] text-sm font-semibold">{item.sectionTitle}</div>
        </div>

        <button
          onClick={() => onRemove(item.id)}
          className="opacity-0 group-hover:opacity-100 text-[#707070] hover:text-red-500 transition-all"
        >
          <X size={18} />
        </button>
      </div>
    )
  }

  // Render Song Item (matching Songs page layout with notes on new line)
  if (item.type === 'song' && item.song) {
    const song = item.song
    const [isEditingNotes, setIsEditingNotes] = useState(false)

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex flex-col bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg group hover:border-[#3a3a3a] transition-colors ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
      >
        {/* Main row */}
        <div className="flex items-center gap-3 p-4">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
          >
            <GripVertical size={18} />
          </button>

          <div className="w-6 text-center text-[#707070] text-sm font-medium flex-shrink-0">{item.position}</div>

          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
            style={{ backgroundColor: song.avatarColor }}
          >
            {song.initials}
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="text-white text-sm font-semibold truncate">{song.title}</div>
            <div className="text-[#707070] text-xs truncate">{song.artist}</div>
          </div>

          <div className="w-[90px] text-[#a0a0a0] text-sm flex-shrink-0">{song.duration}</div>

          <div className="w-[60px] text-[#a0a0a0] text-sm flex-shrink-0">{song.key}</div>

          <div className="w-[130px] text-[#a0a0a0] text-sm flex-shrink-0">{song.tuning}</div>

          <div className="flex items-center gap-2 flex-shrink-0">
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
              className="opacity-0 group-hover:opacity-100 p-1.5 text-[#707070] hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
              title="Remove from Setlist"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Notes row */}
        <div className="px-4 pb-4 pt-0">
          {isEditingNotes ? (
            <textarea
              value={item.notes || ''}
              onChange={(e) => onUpdateItem(item.id, { notes: e.target.value })}
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
  setlist: Setlist
  onEdit: (setlist: Setlist) => void
  onDuplicate: (setlist: Setlist) => void
  onArchive: (setlistId: string) => void
  onDelete: (setlistId: string) => void
}

const SetlistCard: React.FC<SetlistCardProps> = ({
  setlist,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete
}) => {
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

  const songItems = setlist.items.filter((item) => item.type === 'song')

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-base mb-1 truncate">{setlist.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(setlist.status)}`}>
              {setlist.status.charAt(0).toUpperCase() + setlist.status.slice(1)}
            </span>
            {setlist.associatedShow && (
              <div className="flex items-center gap-1 text-[#a0a0a0] text-xs">
                <Calendar size={12} />
                <span>{setlist.associatedShow.name}</span>
              </div>
            )}
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
              <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
              <div className="absolute right-0 top-8 w-40 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => {
                    onEdit(setlist)
                    setShowActions(false)
                  }}
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
          <span>{songItems.length} songs</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={14} />
          <span>{formatTotalDuration(calculateSetlistDuration(setlist.items))}</span>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {songItems.slice(0, 5).map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span className="text-[#505050] w-4">{index + 1}.</span>
            <span className="text-[#a0a0a0] truncate flex-1">{item.song?.title}</span>
            <span className="text-[#707070]">{item.song?.duration}</span>
          </div>
        ))}
        {songItems.length > 5 && (
          <div className="text-[#505050] text-xs pl-6">+{songItems.length - 5} more...</div>
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
            className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg mb-2">Delete Setlist?</h3>
            <p className="text-[#a0a0a0] text-sm mb-6">
              Are you sure you want to delete "{setlist.name}"? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(setlist.id)
                  setShowDeleteConfirm(false)
                }}
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
  setlist: Setlist
  availableSongs: Song[]
  availableShows: Show[]
  availablePractices: Practice[]
  onBack: () => void
  onSave: (setlist: Setlist) => void
}

const SetlistEditorPage: React.FC<SetlistEditorPageProps> = ({
  setlist,
  availableSongs,
  availableShows,
  availablePractices,
  onBack,
  onSave
}) => {
  const [editedSetlist, setEditedSetlist] = useState<Setlist>(setlist)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTuning, setSelectedTuning] = useState<string>('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showPracticeMenu, setShowPracticeMenu] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setEditedSetlist((prev) => {
        const oldIndex = prev.items.findIndex((item) => item.id === active.id)
        const newIndex = prev.items.findIndex((item) => item.id === over.id)

        const newItems = arrayMove(prev.items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          position: index + 1
        }))

        return {
          ...prev,
          items: newItems
        }
      })
    }
  }

  const addSongToSetlist = (song: Song) => {
    const newPosition = editedSetlist.items.length + 1
    const newItem: SetlistItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      type: 'song',
      position: newPosition,
      song: song
    }

    setEditedSetlist((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
      songCount: prev.items.filter((i) => i.type === 'song').length + 1
    }))
  }

  const addBreakToSetlist = () => {
    const newPosition = editedSetlist.items.length + 1
    const newItem: SetlistItem = {
      id: `break-${Date.now()}`,
      type: 'break',
      position: newPosition,
      breakDuration: 15, // default 15 min
      breakNotes: ''
    }

    setEditedSetlist((prev) => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
    setShowAddMenu(false)
  }

  const updateItemInSetlist = (itemId: string, updates: Partial<SetlistItem>) => {
    setEditedSetlist((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    }))
  }

  const addSectionToSetlist = () => {
    const sectionTitle = prompt('Enter section title:')
    if (!sectionTitle) return

    const newPosition = editedSetlist.items.length + 1
    const newItem: SetlistItem = {
      id: `section-${Date.now()}`,
      type: 'section',
      position: newPosition,
      sectionTitle
    }

    setEditedSetlist((prev) => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
    setShowAddMenu(false)
  }

  const removeItemFromSetlist = (itemId: string) => {
    setEditedSetlist((prev) => {
      const newItems = prev.items
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({ ...item, position: index + 1 }))

      return {
        ...prev,
        items: newItems,
        songCount: newItems.filter((i) => i.type === 'song').length
      }
    })
  }

  const handleSave = () => {
    onSave(editedSetlist)
    onBack()
  }

  const handleAddToPractice = (practiceId: string) => {
    const practice = availablePractices.find((p) => p.id === practiceId)
    if (practice) {
      alert(`Added ${editedSetlist.items.filter((i) => i.type === 'song').length} songs to ${practice.name}`)
      setShowPracticeMenu(false)
    }
  }

  const handleAddSongToPractice = (songId: string) => {
    const song = editedSetlist.items.find((i) => i.type === 'song' && i.song?.id === songId)?.song
    if (song) {
      // For now, add to first practice (in real app, would show menu)
      alert(`Added "${song.title}" to practice`)
    }
  }

  // Filter songs that are already in the setlist
  const songsInSetlist = new Set(
    editedSetlist.items.filter((item) => item.type === 'song' && item.song).map((item) => item.song!.id)
  )

  const filteredSongs = availableSongs
    .filter((song) => !songsInSetlist.has(song.id))
    .filter((song) => {
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTuning = !selectedTuning || song.tuning === selectedTuning
      return matchesSearch && matchesTuning
    })

  const availableTunings = Array.from(new Set(availableSongs.map((s) => s.tuning))).sort()

  const totalDuration = calculateSetlistDuration(editedSetlist.items)
  const songCount = editedSetlist.items.filter((i) => i.type === 'song').length

  return (
    <div className="fixed inset-0 bg-[#121212] z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] bg-[#121212] flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-[#707070] hover:text-white transition-colors rounded-lg hover:bg-[#1a1a1a]"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-[#707070] mb-1">
              <span>Setlists</span>
              <ChevronRight size={14} />
              <span className="text-[#a0a0a0]">Edit</span>
            </div>
            <input
              type="text"
              value={editedSetlist.name}
              onChange={(e) => setEditedSetlist({ ...editedSetlist, name: e.target.value })}
              className="text-xl font-bold text-white bg-transparent border-0 outline-none focus:ring-0 p-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
          >
            Save Setlist
          </button>
        </div>
      </div>

      {/* Metadata Bar */}
      <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#0f0f0f] flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-[#a0a0a0] mb-2">Status</label>
            <select
              value={editedSetlist.status}
              onChange={(e) =>
                setEditedSetlist({
                  ...editedSetlist,
                  status: e.target.value as 'draft' | 'active' | 'archived'
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
            <label className="block text-xs text-[#a0a0a0] mb-2">Associated Show</label>
            <select
              value={editedSetlist.associatedShow?.id || ''}
              onChange={(e) => {
                const show = availableShows.find((s) => s.id === e.target.value)
                setEditedSetlist({ ...editedSetlist, associatedShow: show })
              }}
              className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
            >
              <option value="">No show</option>
              {availableShows.map((show) => (
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
              value={editedSetlist.notes}
              onChange={(e) => setEditedSetlist({ ...editedSetlist, notes: e.target.value })}
              placeholder="Add notes..."
              className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
            />
          </div>

          <div>
            <label className="block text-xs text-[#a0a0a0] mb-2">Statistics</label>
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Setlist Items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-lg">Setlist Items</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
                  >
                    <Plus size={18} />
                    <span>Add Item</span>
                  </button>

                  {showAddMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
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
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
                >
                  <Plus size={18} />
                  <span>Add Songs</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowPracticeMenu(!showPracticeMenu)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#f17827ff] bg-[#f17827ff]/10 text-[#f17827ff] text-sm font-medium hover:bg-[#f17827ff]/20 transition-colors"
                  >
                    <Play size={18} />
                    <span>Add All to Practice</span>
                  </button>

                  {showPracticeMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowPracticeMenu(false)} />
                      <div className="absolute right-0 top-12 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-20 py-1">
                        {availablePractices.map((practice) => (
                          <button
                            key={practice.id}
                            onClick={() => handleAddToPractice(practice.id)}
                            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2a2a2a] transition-colors"
                          >
                            <div className="font-medium">{practice.name}</div>
                            <div className="text-xs text-[#707070]">{practice.date}</div>
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
                <p className="text-[#505050] text-xs mb-4">Add songs, breaks, or sections to your setlist</p>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
                >
                  <Plus size={18} />
                  <span>Add Songs</span>
                </button>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={editedSetlist.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {editedSetlist.items.map((item) => (
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
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setIsDrawerOpen(false)} />
            <div className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-[#0f0f0f] border-l border-[#2a2a2a] shadow-2xl z-50 flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] flex-shrink-0">
                <h3 className="text-white font-semibold text-lg">Browse Songs</h3>
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
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
                  <input
                    type="text"
                    placeholder="Search songs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  />
                </div>

                <select
                  value={selectedTuning}
                  onChange={(e) => setSelectedTuning(e.target.value)}
                  className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                >
                  <option value="">All Tunings</option>
                  {availableTunings.map((tuning) => (
                    <option key={tuning} value={tuning}>
                      {tuning}
                    </option>
                  ))}
                </select>
              </div>

              {/* Songs List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-6 py-4">
                <div className="space-y-2">
                  {filteredSongs.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-[#707070] text-sm">No songs available</p>
                      <p className="text-[#505050] text-xs mt-1">
                        {songsInSetlist.size > 0 ? 'All songs have been added' : 'Try adjusting your search'}
                      </p>
                    </div>
                  ) : (
                    filteredSongs.map((song) => (
                      <button
                        key={song.id}
                        onClick={() => addSongToSetlist(song)}
                        className="w-full flex items-center gap-3 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#f17827ff] hover:bg-[#1f1f1f] transition-colors text-left group"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
                          style={{ backgroundColor: song.avatarColor }}
                        >
                          {song.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{song.title}</div>
                          <div className="text-[#707070] text-xs truncate">{song.artist}</div>
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
                        <Plus size={18} className="text-[#505050] group-hover:text-[#f17827ff] transition-colors flex-shrink-0" />
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
  const [setlists, setSetlists] = useState<Setlist[]>(INITIAL_SETLISTS)
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'active' | 'archived'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null)

  const filteredSetlists = setlists.filter((setlist) => {
    const matchesStatus = filterStatus === 'all' || setlist.status === filterStatus
    const matchesSearch = setlist.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const handleCreateNew = () => {
    const newSetlist: Setlist = {
      id: Date.now().toString(),
      name: 'New Setlist',
      songCount: 0,
      totalDuration: '0 min',
      status: 'draft',
      items: [],
      lastModified: 'Just now',
      notes: ''
    }
    setEditingSetlist(newSetlist)
  }

  const handleEdit = (setlist: Setlist) => {
    setEditingSetlist({ ...setlist })
  }

  const handleDuplicate = (setlist: Setlist) => {
    const duplicated: Setlist = {
      ...setlist,
      id: Date.now().toString(),
      name: `${setlist.name} (Copy)`,
      status: 'draft',
      associatedShow: undefined,
      lastModified: 'Just now',
      items: setlist.items.map((item) => ({
        ...item,
        id: `${item.id}-copy-${Date.now()}`
      }))
    }
    setSetlists([duplicated, ...setlists])
  }

  const handleArchive = (setlistId: string) => {
    setSetlists(setlists.map((s) => (s.id === setlistId ? { ...s, status: 'archived' as const } : s)))
  }

  const handleDelete = (setlistId: string) => {
    setSetlists(setlists.filter((s) => s.id !== setlistId))
  }

  const handleSave = (updatedSetlist: Setlist) => {
    const exists = setlists.find((s) => s.id === updatedSetlist.id)
    if (exists) {
      setSetlists(setlists.map((s) => (s.id === updatedSetlist.id ? updatedSetlist : s)))
    } else {
      setSetlists([updatedSetlist, ...setlists])
    }
  }

  // If editing, show full-page editor
  if (editingSetlist) {
    return (
      <SetlistEditorPage
        setlist={editingSetlist}
        availableSongs={MOCK_SONGS}
        availableShows={MOCK_SHOWS}
        availablePractices={MOCK_PRACTICES}
        onBack={() => setEditingSetlist(null)}
        onSave={handleSave}
      />
    )
  }

  // Otherwise, show grid view
  return (
    <ModernLayout bandName="iPod Shuffle" userEmail="eric@example.com">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold text-white">Setlists</h1>
          <ChevronDown size={20} className="text-[#a0a0a0]" />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="h-10 px-4 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
          >
            <option value="all">All Setlists</option>
            <option value="active">Active</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
          </select>

          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
              <input
                type="text"
                placeholder="Search setlists"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-11 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              />
            </div>
          </div>

          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
          >
            <Plus size={20} />
            <span>Create Setlist</span>
          </button>
        </div>
      </div>

      {filteredSetlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <ListMusic size={64} className="text-[#2a2a2a] mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">No setlists yet</h3>
          <p className="text-[#707070] text-sm mb-6">Create your first setlist to get started</p>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
          >
            <Plus size={20} />
            <span>Create Setlist</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSetlists.map((setlist) => (
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
