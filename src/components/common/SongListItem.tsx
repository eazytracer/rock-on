/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react'
import {
  GripVertical,
  X,
  Coffee,
  Layers,
  MoreVertical,
  Pencil,
  Trash2,
  FileText,
  Clock,
  Guitar,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LinkIcons } from '../songs/LinkIcons'
import { InlineEditableField } from './InlineEditableField'
import type { ReferenceLink } from '../../types'

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
  referenceLinks?: ReferenceLink[]
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
  showLinks?: boolean // Show quick-access link icons
  'data-testid'?: string
  // Session notes (inline editable)
  onSaveSessionNotes?: (notes: string) => Promise<void>
  // Song notes modal
  onOpenSongNotes?: () => void
  // Display position (for song-only numbering, overrides item.position)
  songNumber?: number
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
}

export const SongListItem: React.FC<InternalSongListItemProps> = ({
  item,
  isEditing,
  onRemove,
  onEdit,
  showDragHandle = true,
  showLinks = false,
  isDragging = false,
  dragHandleProps,
  'data-testid': testId,
  onSaveSessionNotes,
  onOpenSongNotes,
  songNumber,
}) => {
  // Use songNumber for display if provided (for song-only numbering), otherwise use item.position
  const displayPosition = songNumber ?? item.position
  // Kebab menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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

  // Render Song Item - Card style matching SongsPage
  if (item.type === 'song' && item.song) {
    const song = item.song

    // Shared kebab menu content
    const renderKebabMenu = () =>
      isEditing &&
      (onEdit || onRemove) && (
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 text-[#707070] hover:text-white rounded transition-colors"
            data-testid={`song-actions-menu-${item.position}`}
          >
            <MoreVertical size={18} />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-40 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden">
                {onEdit && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      onEdit()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-white text-sm hover:bg-[#2a2a2a] transition-colors"
                    data-testid={`edit-song-${item.position}`}
                  >
                    <Pencil size={16} />
                    <span>Edit Song</span>
                  </button>
                )}
                {onRemove && (
                  <>
                    {onEdit && <div className="h-px bg-[#2a2a2a]" />}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false)
                        onRemove()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[#D7263D] text-sm hover:bg-[#2a2a2a] transition-colors"
                      data-testid={`remove-song-${item.position}`}
                    >
                      <Trash2 size={16} />
                      <span>Remove</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )

    // Shared session notes content
    const renderSessionNotes = () => (
      <>
        {onSaveSessionNotes && (
          <InlineEditableField
            value={item.notes || ''}
            onSave={async val => {
              await onSaveSessionNotes(String(val))
            }}
            type="text"
            placeholder="Add session notes..."
            validate={val => {
              if (String(val).length > 150) {
                return 'Maximum 150 characters'
              }
              return null
            }}
            data-testid={`session-notes-${item.position}`}
          />
        )}
        {!onSaveSessionNotes && item.notes && (
          <div className="text-[#a0a0a0] text-sm">{item.notes}</div>
        )}
      </>
    )

    return (
      <div
        data-testid={testId || `list-item-song-${displayPosition}`}
        className={`group bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] ${
          isEditing ? 'hover:border-[#3a3a3a]' : ''
        } ${isDragging ? 'shadow-lg shadow-black/50' : ''} transition-colors`}
      >
        {/* Mobile/Tablet Layout (< 1280px) */}
        <div className="xl:hidden p-4">
          {/* Row 1: Position, Avatar, Title/Artist, Actions */}
          <div className="flex items-start gap-3">
            <div className="w-6 text-center text-[#707070] text-sm font-medium flex-shrink-0 pt-1">
              {displayPosition}
            </div>

            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
              style={{ backgroundColor: song.avatarColor }}
            >
              {song.initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">
                {song.title}
              </div>
              <div className="text-[#a0a0a0] text-xs">{song.artist}</div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {onOpenSongNotes && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onOpenSongNotes()
                  }}
                  className="p-1.5 text-[#707070] hover:text-[#f17827ff] rounded transition-colors"
                  title="Song Notes"
                  data-testid={`song-notes-icon-${item.position}`}
                >
                  <FileText size={18} />
                </button>
              )}
              {renderKebabMenu()}
            </div>
          </div>

          {/* Row 2: Metadata and Links - aligned with avatar */}
          <div className="mt-3 flex items-start gap-3">
            {isEditing && showDragHandle ? (
              <button
                {...dragHandleProps}
                className="w-6 flex justify-center cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
                data-testid={`drag-handle-${item.position}`}
              >
                <GripVertical size={18} />
              </button>
            ) : (
              <div className="w-6 flex-shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
                  <Clock size={14} className="flex-shrink-0 text-[#606060]" />
                  <span>{song.duration}</span>
                </div>
                <div className="flex items-center gap-2 text-[#a0a0a0] text-xs">
                  <Guitar size={14} className="flex-shrink-0 text-[#606060]" />
                  <span className="truncate">{song.tuning || 'Standard'}</span>
                </div>
              </div>

              {showLinks &&
                song.referenceLinks &&
                song.referenceLinks.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[#606060] text-xs">Links:</span>
                    <LinkIcons
                      links={song.referenceLinks}
                      size="sm"
                      maxVisible={4}
                    />
                  </div>
                )}

              {(onSaveSessionNotes || item.notes) && (
                <div className="pt-2 border-t border-[#2a2a2a]">
                  {renderSessionNotes()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Layout (≥ 1280px) */}
        <div className="hidden xl:block p-4">
          {/* Row 1: All metadata inline */}
          <div className="flex items-center gap-4">
            {isEditing && showDragHandle && (
              <button
                {...dragHandleProps}
                className="cursor-grab active:cursor-grabbing touch-none text-[#505050] hover:text-[#a0a0a0] transition-colors flex-shrink-0"
                data-testid={`drag-handle-${item.position}`}
              >
                <GripVertical size={18} />
              </button>
            )}

            <div className="w-6 text-center text-[#707070] text-sm font-medium flex-shrink-0">
              {displayPosition}
            </div>

            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
              style={{ backgroundColor: song.avatarColor }}
            >
              {song.initials}
            </div>

            {/* Title/Artist - takes available space */}
            <div className="flex-1 min-w-[200px]">
              <div className="text-white font-semibold text-sm truncate">
                {song.title}
              </div>
              <div className="text-[#a0a0a0] text-xs truncate">
                {song.artist}
              </div>
            </div>

            {/* Links */}
            {showLinks && (
              <div className="w-[100px] flex-shrink-0">
                {song.referenceLinks && song.referenceLinks.length > 0 ? (
                  <LinkIcons
                    links={song.referenceLinks}
                    size="sm"
                    maxVisible={3}
                  />
                ) : (
                  <span className="text-[#404040] text-sm">—</span>
                )}
              </div>
            )}

            {/* Duration with icon */}
            <div className="w-[80px] flex items-center gap-2 text-[#a0a0a0] text-sm flex-shrink-0">
              <Clock size={14} className="text-[#606060]" />
              <span>{song.duration}</span>
            </div>

            {/* Tuning with icon */}
            <div className="w-[120px] flex items-center gap-2 text-[#a0a0a0] text-sm flex-shrink-0">
              <Guitar size={14} className="text-[#606060]" />
              <span className="truncate">{song.tuning || 'Standard'}</span>
            </div>

            {/* Song Notes button */}
            {onOpenSongNotes && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  onOpenSongNotes()
                }}
                className="p-1.5 text-[#707070] hover:text-[#f17827ff] rounded transition-colors flex-shrink-0"
                title="Song Notes"
                data-testid={`song-notes-icon-${item.position}`}
              >
                <FileText size={18} />
              </button>
            )}

            {renderKebabMenu()}
          </div>

          {/* Row 2: Session Notes */}
          {(onSaveSessionNotes || item.notes) && (
            <div className="mt-3 pl-[76px] border-t border-[#2a2a2a] pt-3">
              {renderSessionNotes()}
            </div>
          )}
        </div>
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
