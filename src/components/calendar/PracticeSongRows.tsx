/**
 * A practice's songs, edited in place like a setlist: drag by the grip to
 * reorder (mouse, touch or keyboard), × removes. Rows are SongLines with BPM
 * and links on; under the title, the note for this practice (when there is
 * one) and Played / Skipped once it was played. The row opens the song.
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
import { GripVertical, StickyNote, X } from 'lucide-react'
import { LineNumber, SongLine } from '../songs/SongLine'
import { toSongLine } from '../../domain/songs'
import type { Song } from '../../models/Song'
import type { SessionSong } from '../../types'

export const PracticeSongRows: React.FC<{
  songs: SessionSong[]
  songsById: Map<string, Song>
  onChange: (songs: SessionSong[]) => void
  onOpenSong: (songId: string) => void
  onNote: (index: number) => void
}> = ({ songs, songsById, onChange, onOpenSong, onNote }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = songs.findIndex(s => s.songId === active.id)
    const to = songs.findIndex(s => s.songId === over.id)
    if (from >= 0 && to >= 0) onChange(arrayMove(songs, from, to))
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={songs.map(s => s.songId)}
        strategy={verticalListSortingStrategy}
      >
        <ol
          className="rounded-[20px] bg-bg-2 shadow-group divide-y divide-divider"
          data-testid="practice-songs"
        >
          {songs.map((ps, i) => (
            <Row
              key={ps.songId}
              ps={ps}
              n={i + 1}
              song={songsById.get(ps.songId)}
              onOpen={() => onOpenSong(ps.songId)}
              onNote={() => onNote(i)}
              onRemove={() => onChange(songs.filter((_, j) => j !== i))}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

const Row: React.FC<{
  ps: SessionSong
  n: number
  song: Song | undefined
  onOpen: () => void
  onNote: () => void
  onRemove: () => void
}> = ({ ps, n, song: s, onOpen, onNote, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ps.songId })
  const status =
    ps.status === 'completed' ? (
      <span className="font-mono text-[10.5px] uppercase text-success">
        Played
      </span>
    ) : ps.status === 'skipped' ? (
      <span className="font-mono text-[10.5px] uppercase text-ink-3">
        Skipped
      </span>
    ) : null
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
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
      onClick={onOpen}
      className="relative bg-bg-2 cursor-pointer hover:bg-bg-3/40 first:rounded-t-[20px] last:rounded-b-[20px]"
      data-testid={`practice-song-${ps.songId}`}
      data-song-id={ps.songId}
    >
      <SongLine
        song={s ? toSongLine(s) : null}
        fields={{ artist: true, key: true, bpm: true, links: true }}
        className="pl-0 pr-1.5"
        lead={
          <>
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              onClick={e => e.stopPropagation()}
              aria-label="Drag to reorder"
              className="w-8 self-stretch shrink-0 grid place-items-center text-ink-5 hover:text-ink-3 cursor-grab touch-none"
              data-testid="practice-song-grip"
            >
              <GripVertical size={16} />
            </button>
            <LineNumber n={n} />
          </>
        }
        marks={status}
        sub={
          ps.notes && (
            <button
              type="button"
              onClick={stop(onNote)}
              className="flex items-start gap-2 text-left text-[13.5px] text-ink-2"
              data-testid="practice-song-note-text"
            >
              <StickyNote size={14} className="mt-0.5 shrink-0 text-ink-4" />
              {ps.notes}
            </button>
          )
        }
        trail={
          <>
            <button
              type="button"
              aria-label={
                ps.notes ? 'Edit note' : 'Add a note for this practice'
              }
              title={ps.notes ? 'Edit note' : 'Note for this practice'}
              onClick={stop(onNote)}
              className="grid place-items-center w-9 h-9 shrink-0 text-ink-4 hover:text-ink-1"
              data-testid="practice-song-note"
            >
              <StickyNote size={16} />
            </button>
            <button
              type="button"
              aria-label={`Remove ${s?.title ?? 'song'}`}
              onClick={stop(onRemove)}
              className="grid place-items-center w-9 h-9 shrink-0 text-ink-3 hover:text-danger"
              data-testid="practice-song-remove"
            >
              <X size={17} />
            </button>
          </>
        }
      />
    </li>
  )
}
