/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import { GripVertical, X, Coffee, Layers, Pencil } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExpandableSongNotes } from '../songs/ExpandableSongNotes'

// Shared UI song type
export interface UISong {
  id: string
  title: string
  artist: string
  duration: string // Formatted duration (e.g., "3:14")
  durationSeconds: number
  key?: string
  tuning?: string
  bpm?: string
  initials: string
  avatarColor: string
}

// For setlist items that can be song, break, or section
export interface UISetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number
  song?: UISong
  songId?: string
  breakDuration?: number
  breakNotes?: string
  sectionTitle?: string
  notes?: string
}

interface SongListItemProps {
  item: UISetlistItem
  isEditing: boolean
  onRemove?: () => void
  onEdit?: () => void // Open song edit modal
  showDragHandle?: boolean
  'data-testid'?: string
  // Optional expandable notes props
  userId?: string
  bandId?: string
  isNotesExpanded?: boolean
  onToggleNotes?: () => void
}

// Sortable wrapper for drag-and-drop
export const SortableSongListItem: React.FC<SongListItemProps> = props => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.item.id,
    disabled: !props.isEditing,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <SongListItem
        {...props}
        isDragging={isDragging}
        dragHandleProps={
          props.isEditing ? { ...attributes, ...listeners } : undefined
        }
      />
    </div>
  )
}

interface InternalSongListItemProps extends SongListItemProps {
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  onEdit?: () => void
}

export const SongListItem: React.FC<InternalSongListItemProps> = ({
  item,
  isEditing,
  onRemove,
  onEdit,
  showDragHandle = true,
  isDragging = false,
  dragHandleProps,
  'data-testid': testId,
  userId,
  bandId,
  isNotesExpanded,
  onToggleNotes,
}) => {
  // Check if expandable notes should be shown
  const canShowNotes = userId && bandId && onToggleNotes !== undefined
  // Render Break Item
  if (item.type === 'break') {
    return (
      <div
        className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-[#0f0f0f] border border-dashed border-[#3a3a3a] rounded-lg ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
        data-testid={testId || `list-item-break-${item.position}`}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {isEditing && showDragHandle && (
            <button
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
            >
              <GripVertical size={18} />
            </button>
          )}
          <div className="w-6 text-center flex-shrink-0">
            <Coffee size={18} className="text-[#707070]" />
          </div>
          <span className="text-sm font-medium text-[#a0a0a0] flex-shrink-0">
            Break
          </span>
          {item.breakDuration && (
            <span className="text-sm text-[#707070]">
              {item.breakDuration} min
            </span>
          )}
        </div>
        {item.breakNotes && (
          <span className="text-sm text-[#707070] pl-8 sm:pl-0">
            {item.breakNotes}
          </span>
        )}
        {isEditing && onRemove && (
          <button
            onClick={onRemove}
            className="ml-auto p-1.5 text-[#707070] hover:text-red-500 hover:bg-red-500/10 rounded transition-all flex-shrink-0"
            title="Remove"
          >
            <X size={16} />
          </button>
        )}
      </div>
    )
  }

  // Render Section Item
  if (item.type === 'section') {
    return (
      <div
        className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-[#f17827ff]/10 to-transparent border border-[#f17827ff]/30 rounded-lg ${
          isDragging ? 'shadow-lg shadow-black/50' : ''
        }`}
        data-testid={testId || `list-item-section-${item.position}`}
      >
        {isEditing && showDragHandle && (
          <button
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
          >
            <GripVertical size={18} />
          </button>
        )}
        <div className="w-6 text-center flex-shrink-0">
          <Layers size={18} className="text-[#f17827ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[#f17827ff] text-sm font-semibold truncate">
            {item.sectionTitle}
          </div>
        </div>
        {isEditing && onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-[#707070] hover:text-red-500 hover:bg-red-500/10 rounded transition-all flex-shrink-0"
            title="Remove"
          >
            <X size={16} />
          </button>
        )}
      </div>
    )
  }

  // Render Song Item
  if (item.type === 'song' && item.song) {
    const song = item.song

    return (
      <div
        data-testid={testId || `list-item-song-${item.position}`}
        className={`group flex flex-col bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg ${
          isEditing ? 'hover:border-[#3a3a3a]' : ''
        } ${isDragging ? 'shadow-lg shadow-black/50' : ''} transition-colors`}
      >
        {/* Main row */}
        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
          {isEditing && showDragHandle && (
            <button
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
              data-testid={`drag-handle-${item.position}`}
            >
              <GripVertical size={18} />
            </button>
          )}

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
              {song.key && (
                <>
                  <span className="text-[#505050]">•</span>
                  <span className="flex-shrink-0">{song.key}</span>
                </>
              )}
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

          {song.key && (
            <div className="hidden sm:block w-[60px] text-[#a0a0a0] text-sm flex-shrink-0">
              {song.key}
            </div>
          )}

          {song.tuning && (
            <div className="hidden sm:block w-[130px] text-[#a0a0a0] text-sm flex-shrink-0">
              {song.tuning}
            </div>
          )}

          {/* Action buttons - visible on hover in edit mode */}
          {isEditing && (
            <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0">
              {onEdit && (
                <button
                  onClick={onEdit}
                  data-testid={`edit-song-${item.position}`}
                  className="p-1.5 text-[#707070] hover:text-[#f17827ff] hover:bg-[#f17827ff]/10 rounded transition-all"
                  title="Edit song"
                >
                  <Pencil size={16} />
                </button>
              )}
              {onRemove && (
                <button
                  onClick={onRemove}
                  data-testid={`remove-song-${item.position}`}
                  className="p-1.5 text-[#707070] hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                  title="Remove"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notes row (if present) */}
        {item.notes && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
            <div className="text-[#a0a0a0] text-sm">{item.notes}</div>
          </div>
        )}

        {/* Expandable Band/Personal Notes */}
        {canShowNotes && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <ExpandableSongNotes
              songId={song.id}
              bandNotes={undefined} // Will fetch from song in the hook
              userId={userId!}
              bandId={bandId!}
              isExpanded={isNotesExpanded || false}
              onToggle={onToggleNotes!}
            />
          </div>
        )}
      </div>
    )
  }

  return null
}

// Helper functions to generate avatar data
export const generateAvatarColor = (title: string): string => {
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

export const generateInitials = (title: string): string => {
  const words = title.split(' ').filter(w => w.length > 0)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return title.substring(0, 2).toUpperCase()
}
