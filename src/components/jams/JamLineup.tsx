/**
 * The planned jam's lineup (Jam Plan 3, 8): SongLine rows with the number, who
 * added it, and its part chips (gaps outlined, hands counted, yours in the
 * accent). Hosts drag by the grip to reorder, tap a part to cast it and use ⋯
 * for parts / remove; everyone else taps a song to raise a hand. Signed-in
 * rows end with the My Songs action (decision 11).
 */
import React from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, MoreHorizontal, Plus } from 'lucide-react'
import { LineNumber, SongLine } from '../songs/SongLine'
import type { JamItem } from '../../hooks/useJam'
import { SlotChips } from './PartChip'
import { toJamSongLine } from './parts'

type Slot = JamItem['slots'][number]

/** none → Add to My Songs; matched, untagged → Add to jam songs; tagged → a mark. */
export const MineAction: React.FC<{
  item: JamItem
  busy: boolean
  onAdd: (item: JamItem) => void
}> = ({ item, busy, onAdd }) => {
  if (item.mine?.is_jam_song)
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10.5px] tracking-[.08em] uppercase text-success"
        data-testid={`jam-mine-${item.id}`}
        data-mine="jam-song"
        title="One of your jam songs"
      >
        <Check size={13} strokeWidth={3} /> Jam song
      </span>
    )
  return (
    <button
      type="button"
      disabled={busy}
      onClick={e => {
        e.stopPropagation()
        onAdd(item)
      }}
      className="inline-flex items-center gap-1 h-7 px-2 -mx-2 rounded-full text-[12.5px] font-semibold text-accent-ink hover:bg-bg-3 disabled:opacity-50"
      data-testid={`jam-mine-${item.id}`}
      data-mine={item.mine ? 'untagged' : 'none'}
    >
      <Plus size={14} />
      {item.mine ? 'Add to jam songs' : 'Add to My Songs'}
    </button>
  )
}

export interface JamLineupProps {
  items: JamItem[]
  me: string | null
  manage: boolean
  /** Signed in (not a web guest): show the My Songs action. */
  showMine: boolean
  busy: boolean
  onReorder?: (ids: string[]) => void
  onSlot: (item: JamItem, slot: Slot) => void
  onOpen: (item: JamItem) => void
  onMenu?: (item: JamItem, at: { x: number; y: number }) => void
  onMine: (item: JamItem) => void
  testId?: string
}

export const JamLineup: React.FC<JamLineupProps> = ({
  items,
  onReorder,
  testId = 'jam-lineup',
  ...row
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !onReorder) return
    const from = items.findIndex(i => i.id === active.id)
    const to = items.findIndex(i => i.id === over.id)
    if (from >= 0 && to >= 0)
      onReorder(arrayMove(items, from, to).map(i => i.id))
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol
          className="rounded-[20px] bg-bg-2 shadow-group divide-y divide-divider"
          data-testid={testId}
        >
          {items.map((it, i) => (
            <Row key={it.id} item={it} n={i + 1} drag={!!onReorder} {...row} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

const Row: React.FC<
  Omit<JamLineupProps, 'items' | 'onReorder' | 'testId'> & {
    item: JamItem
    n: number
    drag: boolean
  }
> = ({
  item,
  n,
  drag,
  me,
  manage,
  showMine,
  busy,
  onSlot,
  onOpen,
  onMenu,
  onMine,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !drag })
  const sub = (
    <>
      <SlotChips
        item={item}
        me={me}
        onSlot={manage ? s => onSlot(item, s) : undefined}
      />
      <span className="flex items-center gap-3 pt-1.5 text-[12px] text-ink-3">
        {item.pitched_by_name && (
          <span className="truncate">Added by {item.pitched_by_name}</span>
        )}
        {showMine && <MineAction item={item} busy={busy} onAdd={onMine} />}
      </span>
    </>
  )
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
      onClick={() => onOpen(item)}
      className="relative bg-bg-2 cursor-pointer hover:bg-bg-3/40 first:rounded-t-[20px] last:rounded-b-[20px]"
      data-testid={`jam-item-${item.id}`}
      data-state={item.state}
    >
      <SongLine
        song={toJamSongLine(item)}
        className={drag ? 'pl-0 pr-1.5' : 'pl-3 pr-1.5'}
        titleTestId={`jam-item-title-${item.id}`}
        lead={
          <>
            {drag && (
              <button
                type="button"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                onClick={e => e.stopPropagation()}
                aria-label="Drag to reorder"
                className="w-8 self-stretch shrink-0 grid place-items-center text-ink-5 hover:text-ink-3 cursor-grab touch-none"
                data-testid={`jam-item-grip-${item.id}`}
              >
                <GripVertical size={16} />
              </button>
            )}
            <LineNumber n={n} />
          </>
        }
        trail={
          onMenu && (
            <button
              type="button"
              aria-label={`${item.title} menu`}
              onClick={e => {
                e.stopPropagation()
                const r = e.currentTarget.getBoundingClientRect()
                onMenu(item, { x: r.right - 260, y: r.bottom + 6 })
              }}
              className="grid place-items-center w-9 h-9 rounded-full text-ink-3 hover:bg-bg-3"
              data-testid={`jam-item-menu-${item.id}`}
            >
              <MoreHorizontal size={18} />
            </button>
          )
        }
        sub={sub}
      />
    </li>
  )
}
