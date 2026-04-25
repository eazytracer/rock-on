import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { KebabMenu, type KebabMenuItem } from './KebabMenu'
import { SongAvatar } from './SongAvatar'

export type { KebabMenuItem }

/**
 * dnd-kit's `useSortable` returns a map of pointer/keyboard event
 * handlers to install on the drag handle. The concrete type is
 * internal (`SyntheticListenerMap`) and not re-exported from
 * `@dnd-kit/sortable`'s public entry, so we match its public shape:
 * a record of DOM event handlers keyed by handler name.
 */
type DragHandleListeners = Record<string, (event: unknown) => void>

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
  /**
   * dnd-kit drag listeners — when provided, attached to the grip
   * handle ONLY, so clicks on the kebab menu / body of the row
   * reach their own handlers instead of being swallowed by the
   * drag sensor. Undefined when the row is not sortable.
   */
  dragHandleListeners?: DragHandleListeners
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
  dragHandleListeners,
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
      {/* Drag handle — receives the dnd-kit listeners so drags only
          initiate when the user grabs the grip, NOT when they click
          the kebab menu or anywhere else on the row. */}
      {showDragHandle && (
        <span
          // `touch-none` disables the browser's default touch-scroll
          // behaviour on the handle so drag gestures register cleanly
          // on mobile.
          {...(dragHandleListeners ?? {})}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical
            size={14}
            className="text-[#404040] group-hover:text-[#707070]"
          />
        </span>
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

  // IMPORTANT: do NOT spread `{...listeners}` on the outer div. dnd-kit
  // treats the pointer-down event as the start of a drag gesture, which
  // cancels subsequent `click` events — including clicks on the kebab
  // menu. Instead, pass listeners down so QueueSongRow can attach them
  // only to the grip handle. `attributes` (ARIA metadata) stays on the
  // outer element because it's inert WRT click dispatch.
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <QueueSongRow
        {...props}
        isDragging={isDragging}
        dragHandleListeners={
          listeners as unknown as DragHandleListeners | undefined
        }
      />
    </div>
  )
}
