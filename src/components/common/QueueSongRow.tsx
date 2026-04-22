import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { KebabMenu, type KebabMenuItem } from './KebabMenu'
import { SongAvatar } from './SongAvatar'

export type { KebabMenuItem }

interface QueueSongRowSong {
  id: string
  title: string
  artist?: string
}

interface QueueSongRowProps {
  song: QueueSongRowSong
  /** 1-based display position number */
  position: number
  /** Whether a drag is in progress on this row */
  isDragging?: boolean
  showDragHandle?: boolean
  /** Kebab menu items — if empty/undefined, no menu is shown */
  actions?: KebabMenuItem[]
  /** Optional right-side badge (e.g. participant count) */
  badge?: React.ReactNode
  onClick?: () => void
  'data-testid'?: string
  className?: string
}

/**
 * Lightweight reorderable song row for the jam setlist builder.
 *
 * Intentionally lighter than SongListItem (no session notes, castings,
 * or practice links). Supports drag-to-reorder via dnd-kit.
 * Use SortableQueueSongRow for the drag-enabled version.
 */
export function QueueSongRow({
  song,
  position,
  isDragging = false,
  showDragHandle = true,
  actions,
  badge,
  onClick,
  'data-testid': testId,
  className = '',
}: QueueSongRowProps) {
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      className={[
        'flex items-center gap-3 px-3 py-2.5 rounded-lg',
        'bg-[#1a1a1a] border border-[#2a2a2a] group',
        isDragging ? 'opacity-50 ring-1 ring-[#f17827ff]/50' : '',
        onClick ? 'cursor-pointer hover:bg-[#1f1f1f] transition-colors' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Drag handle */}
      {showDragHandle && (
        <GripVertical
          size={14}
          className="text-[#404040] group-hover:text-[#707070] flex-shrink-0 cursor-grab active:cursor-grabbing"
        />
      )}

      {/* Position number */}
      <span className="text-[#707070] text-xs w-5 text-right tabular-nums flex-shrink-0">
        {position}
      </span>

      {/* Avatar */}
      <SongAvatar title={song.title} artist={song.artist} size="sm" />

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{song.title}</p>
        {song.artist && (
          <p className="text-[#707070] text-xs truncate">{song.artist}</p>
        )}
      </div>

      {/* Optional badge */}
      {badge && <div className="flex-shrink-0">{badge}</div>}

      {/* Kebab menu */}
      {actions && actions.length > 0 && (
        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
          <KebabMenu items={actions} triggerSize="sm" align="right" />
        </div>
      )}
    </div>
  )
}

/**
 * Drag-enabled version via dnd-kit/sortable.
 * Drop this in wherever you need a drag-to-reorder list.
 *
 * Usage:
 *   <DndContext ...>
 *     <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
 *       {songs.map((song, i) => (
 *         <SortableQueueSongRow key={song.id} id={song.id} song={song} position={i + 1} ... />
 *       ))}
 *     </SortableContext>
 *   </DndContext>
 */
interface SortableQueueSongRowProps extends QueueSongRowProps {
  /** Must match song.id — used as the dnd-kit sortable id */
  id: string
}

export function SortableQueueSongRow({
  id,
  ...props
}: SortableQueueSongRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <QueueSongRow {...props} isDragging={isDragging} />
    </div>
  )
}
