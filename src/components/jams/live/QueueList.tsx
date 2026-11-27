/**
 * "After that · N" (Jam Host 4b–4c, desktop console). Phone: swipe right =
 * up next, swipe left = Played / Left / Remove, hold or tap = the song's
 * sheet; a hint line and a one-time peek teach it. Desktop: drag the grip,
 * hover for ↑ ↓ and the same actions, right-click for the menu.
 */
import React, { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Check,
  GripVertical,
  LogOut,
  X,
} from 'lucide-react'
import type { JamItem } from '../../../hooks/useJam'
import { castLine, needsLine } from './live'
import type { ConsoleActions } from './useConsoleActions'

const PEEK_KEY = 'rockon.jam.queuePeek'
const TRAY = 246
const RIGHT = 96

interface RowProps {
  item: JamItem
  index: number
  /** Position in the whole queue (up next = 0). */
  qIndex: number
  last: boolean
  actions: ConsoleActions
  onOpen: (item: JamItem, at?: { x: number; y: number } | null) => void
}

const Body: React.FC<{ item: JamItem; n: number }> = ({ item, n }) => {
  const cast = castLine(item)
  return (
    <>
      <span className="w-5 font-mono text-[12px] text-ink-3 shrink-0">{n}</span>
      <span className="flex-1 min-w-0">
        <b className="block text-[16px] text-ink-1 truncate">{item.title}</b>
        <small className="block text-[12.5px] text-ink-3 truncate">
          {[item.artist, cast, needsLine(item)].filter(Boolean).join(' · ')}
        </small>
      </span>
    </>
  )
}

const iconBtn =
  'w-11 h-11 grid place-items-center rounded-full text-ink-2 hover:bg-bg-4 hover:text-ink-1 disabled:opacity-30'

const DesktopRow: React.FC<RowProps> = ({
  item,
  index,
  qIndex,
  last,
  actions,
  onOpen,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-2 min-h-16 pl-1 pr-2 bg-bg-2 ${
        isDragging ? 'relative z-10 shadow-float' : ''
      }`}
      onContextMenu={e => {
        e.preventDefault()
        onOpen(item, { x: e.clientX, y: e.clientY })
      }}
      data-testid={`queue-row-${index}`}
      data-item-id={item.id}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="w-8 self-stretch grid place-items-center text-ink-5 hover:text-ink-3 cursor-grab touch-none"
        data-testid="queue-row-grip"
      >
        <GripVertical size={17} />
      </button>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex-1 min-w-0 flex items-center gap-2 text-left py-2"
        data-testid="queue-row-open"
      >
        <Body item={item} n={qIndex + 1} />
      </button>
      <span className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          className={iconBtn}
          title="Move up"
          aria-label="Move up"
          disabled={qIndex <= 1}
          onClick={() => actions.move(item, qIndex - 1)}
          data-testid="queue-row-up"
        >
          <ArrowUp size={18} />
        </button>
        <button
          type="button"
          className={iconBtn}
          title="Move down"
          aria-label="Move down"
          disabled={last}
          onClick={() => actions.move(item, qIndex + 1)}
          data-testid="queue-row-down"
        >
          <ArrowDown size={18} />
        </button>
        <button
          type="button"
          className={iconBtn}
          title="Up next"
          aria-label="Up next"
          onClick={() => actions.makeUpNext(item)}
          data-testid="queue-row-next"
        >
          <ArrowUpToLine size={18} />
        </button>
        <button
          type="button"
          className={iconBtn}
          title="Played"
          aria-label="Played"
          onClick={() => actions.clear(item, 'played')}
          data-testid="queue-row-played"
        >
          <Check size={18} />
        </button>
        <button
          type="button"
          className={iconBtn}
          title="Left"
          aria-label="Left"
          onClick={() => actions.clear(item, 'left')}
          data-testid="queue-row-left"
        >
          <LogOut size={18} />
        </button>
        <button
          type="button"
          className={`${iconBtn} hover:!text-danger`}
          title="Remove"
          aria-label="Remove"
          onClick={() => actions.clear(item, 'removed')}
          data-testid="queue-row-remove"
        >
          <X size={18} />
        </button>
      </span>
    </li>
  )
}

const PhoneRow: React.FC<RowProps & { peek: boolean }> = ({
  item,
  index,
  qIndex,
  actions,
  onOpen,
  peek,
}) => {
  const [dx, setDx] = useState(0)
  const [open, setOpen] = useState<'left' | 'right' | null>(null)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const swiped = useRef(false)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const front = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!peek || !front.current?.animate) return
    front.current.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-56px)' },
        { transform: 'translateX(40px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 1600, delay: 600, easing: 'ease-in-out' }
    )
  }, [peek])

  const offset = dragging
    ? dx
    : open === 'left'
      ? -TRAY
      : open === 'right'
        ? RIGHT
        : 0
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, base: offset }
    swiped.current = false
    held.current = false
    cancelHold()
    hold.current = setTimeout(() => {
      held.current = true
      onOpen(item)
    }, 450)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    if (!swiped.current && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
      swiped.current = true
      setDragging(true)
      cancelHold()
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } else if (Math.abs(my) > 8) cancelHold()
    if (swiped.current)
      setDx(Math.max(-TRAY, Math.min(RIGHT + 30, s.base + mx)))
  }
  const onPointerUp = () => {
    cancelHold()
    const s = start.current
    start.current = null
    if (!s) return
    if (!swiped.current) {
      if (held.current) return
      if (open) setOpen(null)
      else onOpen(item)
      return
    }
    setDragging(false)
    if (dx > 70) {
      setOpen(null)
      void actions.makeUpNext(item)
    } else if (dx < -70) setOpen('left')
    else setOpen(null)
  }

  const act = (to: 'played' | 'left' | 'removed') => {
    setOpen(null)
    void actions.clear(item, to)
  }

  return (
    <li
      className="relative overflow-hidden"
      data-testid={`queue-row-${index}`}
      data-item-id={item.id}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(null)
          void actions.makeUpNext(item)
        }}
        className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-1 text-[12px] font-extrabold bg-accent text-on-accent"
        style={{ width: RIGHT }}
        tabIndex={open === 'right' ? 0 : -1}
        data-testid="queue-swipe-next"
      >
        <ArrowUpToLine size={20} />
        Up next
      </button>
      <span className="absolute inset-y-0 right-0 flex">
        {(
          [
            [
              'played',
              'Played',
              <Check key="i" size={20} />,
              'bg-success text-[#06140c]',
            ],
            [
              'left',
              'Left',
              <LogOut key="i" size={20} />,
              'bg-bg-4 text-ink-1',
            ],
            [
              'removed',
              'Remove',
              <X key="i" size={20} />,
              'bg-danger-fill text-white',
            ],
          ] as const
        ).map(([to, label, icon, cls]) => (
          <button
            key={to}
            type="button"
            onClick={() => act(to)}
            className={`w-[82px] flex flex-col items-center justify-center gap-1 text-[12px] font-extrabold ${cls}`}
            tabIndex={open === 'left' ? 0 : -1}
            data-testid={`queue-swipe-${to}`}
          >
            {icon}
            {label}
          </button>
        ))}
      </span>
      <div
        ref={front}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onOpen(item)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          cancelHold()
          start.current = null
          setDragging(false)
        }}
        onContextMenu={e => e.preventDefault()}
        className={`relative z-[1] flex items-center gap-2 min-h-16 px-3.5 bg-bg-2 touch-pan-y select-none ${
          dragging ? '' : 'transition-transform duration-200 ease-rock'
        }`}
        style={{ transform: `translateX(${offset}px)` }}
        data-testid="queue-row-open"
      >
        <Body item={item} n={qIndex + 1} />
        <GripVertical size={17} className="text-ink-5 shrink-0" />
      </div>
    </li>
  )
}

export const QueueList: React.FC<{
  items: JamItem[]
  /** Queue index of the first row (1 when up next is shown above). */
  offset: number
  desktop: boolean
  actions: ConsoleActions
  onOpen: RowProps['onOpen']
}> = ({ items, offset, desktop, actions, onOpen }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const [peek] = useState(() => {
    try {
      if (localStorage.getItem(PEEK_KEY)) return false
      localStorage.setItem(PEEK_KEY, '1')
      return true
    } catch {
      return false
    }
  })

  if (!desktop)
    return (
      <>
        <p
          className="px-6 pb-2 text-[12.5px] text-ink-3"
          data-testid="queue-hint"
        >
          Swipe right: up next · Swipe left: clear · Hold: all options
        </p>
        <ol
          className="mx-3 mb-2.5 rounded-[20px] overflow-hidden bg-bg-2 shadow-group divide-y divide-divider"
          data-testid="queue-list"
        >
          {items.map((item, i) => (
            <PhoneRow
              key={item.id}
              item={item}
              index={i}
              qIndex={i + offset}
              last={i === items.length - 1}
              actions={actions}
              onOpen={onOpen}
              peek={peek && i === 0}
            />
          ))}
        </ol>
      </>
    )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const to = items.findIndex(i => i.id === over.id)
    const item = items.find(i => i.id === active.id)
    if (item && to >= 0) void actions.move(item, to + offset)
  }
  return (
    <>
      <p
        className="px-6 pb-2 text-[12.5px] text-ink-3"
        data-testid="queue-hint"
      >
        Hover a row for actions, right-click for the menu, or drag to reorder.
        Nothing has to be logged.
      </p>
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
            className="mx-3 mb-2.5 rounded-[20px] overflow-hidden bg-bg-2 shadow-group divide-y divide-divider"
            data-testid="queue-list"
          >
            {items.map((item, i) => (
              <DesktopRow
                key={item.id}
                item={item}
                index={i}
                qIndex={i + offset}
                last={i === items.length - 1}
                actions={actions}
                onOpen={onOpen}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  )
}
