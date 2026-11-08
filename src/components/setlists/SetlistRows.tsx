/**
 * The set's rows (Setlist Editor 2–3, ab2-editor): song rows, a RETUNE line on
 * each song whose tuning differs from the song before, break and section rows
 * that edit in place. Drag by the grip (mouse, touch or keyboard). Desktop:
 * click selects, double-click opens the song, ⋯ / right-click opens the row
 * menu. Phone: hold a row for the menu. The timeline rail is a fixed gutter
 * left of the rows.
 */
import React, { useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import type { SetlistItem } from '../../types'
import { BREAK_MINUTES, songLength, type EditorRow } from '../../domain/setlist'
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
        <ol className="flex flex-col gap-1.5" data-testid="setlist-rows">
          {rows.map((r, i) => (
            <SortableRow
              key={r.item.id}
              {...props}
              row={r}
              time={props.rail?.[i] ?? null}
              railOn={!!props.rail}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

const SortableRow: React.FC<
  SetlistRowsProps & { row: Row; time: string | null; railOn: boolean }
> = ({
  row,
  time,
  railOn,
  desktop,
  selectedId,
  editingId,
  onSelect,
  onOpenSong,
  onMenu,
  onEdit,
  onSaveItem,
}) => {
  const id = row.item.id
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
        className={`group flex items-center gap-2 min-h-[40px] pr-2 rounded-xl ${selected ? 'bg-bg-2 ring-2 ring-accent' : ''}`}
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
        className={`group rounded-2xl ring-1 ring-inset ${selected ? 'ring-2 ring-accent' : 'ring-border-1'}`}
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
    body = (
      <div
        {...common}
        onDoubleClick={e => {
          if ((e.target as HTMLElement).closest('button')) return
          open()
        }}
        data-testid={`setlist-song-${id}`}
        className={`group rounded-2xl bg-bg-2 ${selected ? 'ring-2 ring-accent' : ''}`}
      >
        <div className="flex items-center gap-2 min-h-[56px] pr-2">
          {grip}
          <span className="w-5 text-right font-mono text-[12.5px] text-ink-3 shrink-0">
            {row.number}
          </span>
          {desktop ? (
            <>
              <span className="flex-1 min-w-0 py-2 flex items-baseline gap-2">
                <span
                  className="truncate text-[15.5px] font-bold text-ink-1"
                  data-testid="setlist-song-title"
                >
                  {song?.title ?? 'Song removed from catalog'}
                </span>
                {song?.artist && (
                  <span className="truncate text-[13px] text-ink-3">
                    {song.artist}
                  </span>
                )}
              </span>
              {song && <TuningPill tuning={song.tuning} />}
              <span className="w-12 text-center font-mono text-[13px] text-ink-2">
                {song?.key ?? ''}
              </span>
              <span className="w-11 text-right font-mono text-[13px] text-ink-2">
                {songLength(song?.seconds)}
              </span>
              {song && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    open()
                  }}
                  aria-label={`Open ${song.title}`}
                  title="Open song"
                  className="w-8 h-8 shrink-0 grid place-items-center rounded-full text-ink-3 hover:bg-bg-4 hover:text-ink-1"
                  data-testid="setlist-row-open-song"
                >
                  <SquareArrowOutUpRight size={16} />
                </button>
              )}
              {menuButton}
            </>
          ) : (
            // Phone (m2): the title, then tuning · length · key.
            <span className="flex-1 min-w-0 py-2.5">
              <span
                className="block truncate text-[16px] font-bold text-ink-1"
                data-testid="setlist-song-title"
              >
                {song?.title ?? 'Song removed from catalog'}
              </span>
              {song && (
                <span className="flex items-center gap-3 mt-1.5 font-mono text-[13px] text-ink-2">
                  <TuningPill tuning={song.tuning} size="sm" />
                  {song.seconds > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-ink-4" />
                      {songLength(song.seconds)}
                    </span>
                  )}
                  {song.key && (
                    <span>
                      <span className="text-ink-4"># </span>
                      {song.key}
                    </span>
                  )}
                </span>
              )}
            </span>
          )}
        </div>
        {row.item.notes && (
          <p
            className="flex items-center gap-2 pl-[60px] pr-4 pb-2.5 -mt-1 text-[13px] text-ink-2"
            data-testid="setlist-song-note"
          >
            <ListMusic size={14} className="text-ink-4 shrink-0" />
            <span className="truncate">{row.item.notes}</span>
          </p>
        )}
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
      {row.kind === 'song' && row.retuneFrom !== null && row.song && (
        <Gutter on={railOn}>
          <RetuneLine from={row.retuneFrom} to={row.song.tuning} />
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

/** "RETUNE E STD → D DROP  Tune": Tune opens the tuner once it exists. */
const RetuneLine: React.FC<{ from: string; to?: string | null }> = ({
  from,
  to,
}) => (
  <div
    className="flex items-center gap-2 pl-3 md:pl-10 pt-0.5 pb-1.5"
    data-testid="setlist-retune"
  >
    <span className="font-mono text-[11px] tracking-[.12em] text-warn">
      RETUNE
    </span>
    <TuningPill tuning={from} size="sm" />
    <ArrowRight size={13} className="text-warn" />
    <TuningPill tuning={to} size="sm" />
    <button
      type="button"
      disabled
      title="The tuner arrives with Tools"
      className="ml-1 h-8 px-3 rounded-full bg-bg-2 text-[13px] font-bold text-ink-1 flex items-center gap-1.5 disabled:opacity-60"
      data-testid="setlist-retune-tune"
    >
      <ForkIcon className="text-warn" /> Tune
    </button>
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
