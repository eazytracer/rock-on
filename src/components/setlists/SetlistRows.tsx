/**
 * The set's rows (Setlist Editor 2–3, ab2-editor): song rows, a RETUNE line on
 * each song whose tuning differs from the song before, break and section rows
 * that edit in place. Drag by the grip (mouse, touch or keyboard). Desktop:
 * click selects, double-click opens the song, ⋯ / right-click opens the row
 * menu. Phone: hold a row for the menu. The timeline rail is a fixed gutter
 * left of the rows.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowRight,
  Clock,
  GripVertical,
  ListMusic,
  MoreHorizontal,
  SquareArrowOutUpRight,
  X,
} from 'lucide-react'
import type { SetlistItem } from '../../types'
import { BREAK_MINUTES, type EditorRow } from '../../domain/setlist'
import { toolsHref } from '../../domain/toolsLink'
import { songTuningParam } from '../../domain/tuner'
import { LineNumber, SongLine } from '../songs/SongLine'
import { TuningPill } from '../ui'
import { ForkIcon } from './SetlistStats'

type Row = EditorRow<SetlistItem>
type At = { x: number; y: number }

export interface SetlistRowsProps {
  rows: Row[]
  desktop: boolean
  selectedId: string | null
  editingId: string | null
  /** Rail labels per row ("8:30" / "3:14"), or null when the rail is off. */
  rail: string[] | null
  onSelect: (id: string) => void
  onOpenSong: (songId: string) => void
  onMenu: (id: string, at: At | null) => void
  onEdit: (id: string | null) => void
  onSaveItem: (
    id: string,
    patch: {
      breakDuration?: number
      breakNotes?: string
      sectionTitle?: string
    }
  ) => void
  onMove: (id: string, to: number) => void
  /** The row's ×: removes it (the page confirms). */
  onRemove: (id: string) => void
}

export const SetlistRows: React.FC<SetlistRowsProps> = props => {
  const { rows, onMove } = props
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const to = rows.findIndex(r => r.item.id === over.id)
    if (to >= 0) onMove(String(active.id), to)
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={rows.map(r => r.item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="flex flex-col" data-testid="setlist-rows">
          {rows.map((r, i) => (
            <SortableRow
              key={r.item.id}
              {...props}
              row={r}
              time={props.rail?.[i] ?? null}
              railOn={!!props.rail}
              afterSong={rows[i - 1]?.kind === 'song'}
              beforeSong={rows[i + 1]?.kind === 'song'}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

/**
 * Songs in a run share one surface, divided by 1 px (like every song list);
 * breaks and sections sit between runs.
 */
const SortableRow: React.FC<
  SetlistRowsProps & {
    row: Row
    time: string | null
    railOn: boolean
    afterSong: boolean
    beforeSong: boolean
  }
> = ({
  row,
  time,
  railOn,
  afterSong,
  beforeSong,
  desktop,
  selectedId,
  editingId,
  onSelect,
  onOpenSong,
  onMenu,
  onEdit,
  onSaveItem,
  onRemove,
}) => {
  const id = row.item.id
  const retuneFrom = row.kind === 'song' && row.song ? row.retuneFrom : null
  const retune = retuneFrom !== null
  const top = afterSong ? 'border-t border-divider' : 'rounded-t-[20px]'
  const round = `${retune ? '' : top} ${beforeSong ? '' : 'rounded-b-[20px]'}`
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const selected = selectedId === id
  const editing = editingId === id

  // Phone: hold a row (450 ms, no movement) for its menu.
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
  }
  const touch = desktop
    ? {}
    : {
        onTouchStart: () => {
          held.current = false
          hold.current = setTimeout(() => {
            held.current = true
            onMenu(id, null)
          }, 450)
        },
        onTouchMove: cancelHold,
        onTouchEnd: cancelHold,
      }

  const grip = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="w-7 self-stretch shrink-0 grid place-items-center text-ink-5 hover:text-ink-3 cursor-grab touch-none"
      data-testid="setlist-row-grip"
    >
      <GripVertical size={16} />
    </button>
  )

  // Phone rows have no ⋯: hold opens the menu (Setlist Editor 6).
  const menuButton = desktop && (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        const r = e.currentTarget.getBoundingClientRect()
        onMenu(id, { x: r.right - 288, y: r.bottom + 6 })
      }}
      aria-label="Row menu"
      className={`w-8 h-8 shrink-0 grid place-items-center rounded-full text-ink-3 hover:bg-bg-4 hover:text-ink-1 ${selected ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
      data-testid="setlist-row-menu"
    >
      <MoreHorizontal size={17} />
    </button>
  )

  const common = {
    onClick: () => {
      if (held.current) return
      onSelect(id)
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (!desktop) return
      e.preventDefault()
      onMenu(id, { x: e.clientX, y: e.clientY })
    },
    'data-selected': selected || undefined,
    ...touch,
  }

  let body: React.ReactNode
  if (row.kind === 'section') {
    body = (
      <div
        {...common}
        data-testid={`setlist-section-${id}`}
        className={`group flex items-center gap-2 min-h-[40px] mt-3 pr-2 rounded-xl ${selected ? 'bg-bg-2 ring-2 ring-accent' : ''}`}
      >
        {grip}
        {editing ? (
          <SectionEditor
            value={row.item.sectionTitle ?? ''}
            onDone={v => {
              if (v && v !== row.item.sectionTitle)
                onSaveItem(id, { sectionTitle: v })
              onEdit(null)
            }}
          />
        ) : (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onSelect(id)
              onEdit(id)
            }}
            className="flex-1 text-left font-mono text-[12px] tracking-[.16em] uppercase text-ink-2 py-2"
            data-testid="setlist-section-title"
          >
            {row.item.sectionTitle || 'Section'}
          </button>
        )}
        {!editing && menuButton}
      </div>
    )
  } else if (row.kind === 'break') {
    body = (
      <div
        {...common}
        data-testid={`setlist-break-${id}`}
        className={`group my-1.5 rounded-2xl ring-1 ring-inset ${selected ? 'ring-2 ring-accent' : 'ring-border-1'}`}
      >
        <div className="flex items-center gap-2 min-h-[48px] pr-2">
          {grip}
          <Clock size={17} className="text-ink-3 shrink-0" />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onSelect(id)
              onEdit(editing ? null : id)
            }}
            className="flex-1 min-w-0 text-left truncate py-2"
            data-testid="setlist-break-summary"
          >
            <b className="text-[15px] text-ink-1">
              Break · {row.item.breakDuration ?? 15} min
            </b>
            {row.item.breakNotes && (
              <span className="ml-2 text-[13.5px] text-ink-3">
                {row.item.breakNotes}
              </span>
            )}
          </button>
          {menuButton}
        </div>
        {editing && (
          <BreakEditor
            minutes={row.item.breakDuration ?? 15}
            note={row.item.breakNotes ?? ''}
            onSave={patch => onSaveItem(id, patch)}
            onDone={() => onEdit(null)}
          />
        )}
      </div>
    )
  } else {
    const song = row.song
    const open = () => row.item.songId && onOpenSong(row.item.songId)
    const reveal = selected
      ? ''
      : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
    body = (
      <div
        {...common}
        onDoubleClick={e => {
          if ((e.target as HTMLElement).closest('button')) return
          open()
        }}
        data-testid={`setlist-song-${id}`}
        data-song-id={row.item.songId}
        className={`group bg-bg-2 ${round} ${selected ? 'ring-2 ring-inset ring-accent' : ''}`}
      >
        <SongLine
          song={song}
          className="pl-0 pr-2"
          titleTestId="setlist-song-title"
          lead={
            <>
              {grip}
              <LineNumber n={row.number} />
            </>
          }
          sub={
            row.item.notes && (
              <p
                className="flex items-center gap-2 text-[13px] text-ink-2"
                data-testid="setlist-song-note"
              >
                <ListMusic size={14} className="text-ink-4 shrink-0" />
                <span className="truncate">{row.item.notes}</span>
              </p>
            )
          }
          trail={
            <>
              {desktop && song && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    open()
                  }}
                  aria-label={`Open ${song.title}`}
                  title="Open song"
                  className={`w-8 h-8 shrink-0 grid place-items-center rounded-full text-ink-3 hover:bg-bg-4 hover:text-ink-1 ${reveal}`}
                  data-testid="setlist-row-open-song"
                >
                  <SquareArrowOutUpRight size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onRemove(id)
                }}
                aria-label={`Remove ${song?.title ?? 'song'}`}
                title="Remove from set"
                className={`w-8 h-8 shrink-0 grid place-items-center rounded-full text-ink-3 hover:bg-bg-4 hover:text-danger ${desktop ? reveal : ''}`}
                data-testid="setlist-row-remove-x"
              >
                <X size={17} />
              </button>
              {menuButton}
            </>
          }
        />
      </div>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
    >
      {row.kind === 'song' && retuneFrom !== null && (
        <Gutter on={railOn}>
          <div className={`bg-bg-2 ${top}`}>
            <RetuneLine from={retuneFrom} to={row.song?.tuning} />
          </div>
        </Gutter>
      )}
      <Gutter on={railOn} time={row.kind === 'section' ? '' : time}>
        {body}
      </Gutter>
    </li>
  )
}

/** The timeline rail's fixed gutter left of a row (when the rail is on). */
const Gutter: React.FC<{
  on: boolean
  time?: string | null
  children: React.ReactNode
}> = ({ on, time, children }) =>
  on ? (
    <div className="grid grid-cols-[56px_1fr] gap-x-2">
      <span
        className="relative pr-2.5 pt-[18px] text-right font-mono text-[12px] text-ink-2"
        data-testid={time ? 'setlist-rail-time' : undefined}
      >
        {time}
        <span className="absolute right-0 -top-1.5 -bottom-1.5 w-px bg-border-1" />
        {time && (
          <span className="absolute -right-[3px] top-[23px] w-[7px] h-[7px] rounded-full bg-accent" />
        )}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  ) : (
    <>{children}</>
  )

/** "RETUNE E STD → D DROP  Tune": Tune opens the tuner on the new tuning. */
const RetuneLine: React.FC<{ from: string; to?: string | null }> = ({
  from,
  to,
}) => (
  <div
    className="flex items-center gap-2 pl-3 md:pl-10 pt-2 pb-0.5"
    data-testid="setlist-retune"
  >
    <span className="font-mono text-[11px] tracking-[.12em] text-warn">
      RETUNE
    </span>
    <TuningPill tuning={from} size="sm" />
    <ArrowRight size={13} className="text-warn" />
    <TuningPill tuning={to} size="sm" />
    <Link
      to={toolsHref('tuner', {
        tuning: songTuningParam({ guitarTuning: to }),
        prev: songTuningParam({ guitarTuning: from }),
      })}
      onClick={e => e.stopPropagation()}
      className="ml-1 h-8 px-3 rounded-full bg-bg-2 text-[13px] font-bold text-ink-1 flex items-center gap-1.5 hover:bg-bg-3"
      data-testid="setlist-retune-tune"
    >
      <ForkIcon className="text-warn" /> Tune
    </Link>
  </div>
)

const SectionEditor: React.FC<{
  value: string
  onDone: (value: string) => void
}> = ({ value, onDone }) => {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      id="setlist-section-input"
      name="sectionTitle"
      value={v}
      maxLength={40}
      onChange={e => setV(e.target.value)}
      onClick={e => e.stopPropagation()}
      onBlur={() => onDone(v.trim())}
      onKeyDown={e => {
        if (e.key === 'Enter') onDone(v.trim())
        if (e.key === 'Escape') onDone('')
      }}
      className="flex-1 h-9 px-3 rounded-lg bg-bg-3 font-mono text-[13px] tracking-[.12em] uppercase text-ink-1 outline-none focus:ring-2 focus:ring-accent/40"
      data-testid="setlist-section-input"
    />
  )
}

const BreakEditor: React.FC<{
  minutes: number
  note: string
  onSave: (patch: { breakDuration?: number; breakNotes?: string }) => void
  onDone: () => void
}> = ({ minutes, note, onSave, onDone }) => {
  const [n, setN] = useState(note)
  const saveNote = () => {
    if (n.trim() !== note) onSave({ breakNotes: n.trim() })
  }
  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 pb-3"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex gap-1.5" role="radiogroup" aria-label="Break length">
        {BREAK_MINUTES.map(m => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === minutes}
            onClick={() => m !== minutes && onSave({ breakDuration: m })}
            className={`h-9 min-w-[48px] px-2 rounded-xl font-mono text-[13.5px] font-bold ${m === minutes ? 'bg-accent text-on-accent' : 'bg-bg-3 text-ink-1'}`}
            data-testid={`setlist-break-minutes-${m}`}
          >
            {m}
          </button>
        ))}
      </div>
      <input
        id="setlist-break-note"
        name="breakNotes"
        value={n}
        maxLength={80}
        onChange={e => setN(e.target.value)}
        onBlur={saveNote}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            saveNote()
            onDone()
          }
          if (e.key === 'Escape') onDone()
        }}
        placeholder="Note (optional)"
        className="flex-1 min-w-[160px] h-9 px-3 rounded-xl bg-bg-3 text-[14px] text-ink-1 placeholder:text-ink-4 outline-none focus:ring-2 focus:ring-accent/40"
        data-testid="setlist-break-note-input"
      />
      <button
        type="button"
        onClick={() => {
          saveNote()
          onDone()
        }}
        className="h-9 px-4 rounded-full bg-bg-3 text-[13.5px] font-bold text-ink-1"
        data-testid="setlist-break-done"
      >
        Done
      </button>
    </div>
  )
}
