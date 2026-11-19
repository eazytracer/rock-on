/**
 * The editor's sheets and menus (Setlist Editor 5–7). Each
 * is a kit Sheet: a popover at `at` on desktop, a bottom sheet on phones.
 */
import React, { useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  ListMusic,
  ListOrdered,
  Music2,
  Pencil,
  SquareArrowOutUpRight,
  Trash2,
  ArrowUpToLine,
} from 'lucide-react'
import { Button, Segmented, Sheet, SheetItem } from '../ui'
import { MarkdownWriter } from '../notes/MarkdownWriter'
import { BREAK_MINUTES, rowLabel, type EditorRow } from '../../domain/setlist'
import type { SetlistItem } from '../../types'
import { tuningShortLabel } from '../../utils/tunings'

type At = { x: number; y: number } | null
type Row = EditorRow<SetlistItem>

/**
 * A row's menu (Setlist Editor 6): Up / Down / To top / After… tiles, then the
 * per-set note and Open song (songs) or Edit (breaks, sections), then Remove.
 */
export const RowMenuSheet: React.FC<{
  row: Row
  setName: string
  at: At
  canUp: boolean
  canDown: boolean
  onMove: (where: 'up' | 'down' | 'top') => void
  onAfter: () => void
  onNote: () => void
  onOpen: () => void
  onEdit: () => void
  onRemove: () => void
  onClose: () => void
}> = ({
  row,
  setName,
  at,
  canUp,
  canDown,
  onMove,
  onAfter,
  onNote,
  onOpen,
  onEdit,
  onRemove,
  onClose,
}) => {
  const song = row.kind === 'song' ? row.song : null
  const sub =
    row.kind === 'song'
      ? [
          `#${row.number} in ${setName}`,
          song?.tuning ? tuningShortLabel(song.tuning) : null,
          song?.seconds
            ? `${Math.floor(song.seconds / 60)}:${String(song.seconds % 60).padStart(2, '0')}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : `In ${setName}`
  const tile = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    enabled: boolean,
    testId: string
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className="flex flex-col items-center justify-center gap-1 h-[52px] rounded-xl bg-bg-3 text-[12.5px] font-bold text-ink-1 disabled:opacity-35"
      data-testid={testId}
    >
      {icon}
      {label}
    </button>
  )
  return (
    <Sheet
      onClose={onClose}
      at={at}
      width={340}
      title={rowLabel(row)}
      sub={sub}
      data-testid="setlist-row-sheet"
    >
      <div className="grid grid-cols-4 gap-1.5 p-1 pb-2">
        {tile(
          'Up',
          <ChevronUp size={17} />,
          () => onMove('up'),
          canUp,
          'setlist-move-up'
        )}
        {tile(
          'Down',
          <ChevronDown size={17} />,
          () => onMove('down'),
          canDown,
          'setlist-move-down'
        )}
        {tile(
          'To top',
          <ArrowUpToLine size={17} />,
          () => onMove('top'),
          canUp,
          'setlist-move-top'
        )}
        {tile(
          'After…',
          <ArrowRight size={17} />,
          onAfter,
          true,
          'setlist-move-after'
        )}
      </div>
      {row.kind === 'song' ? (
        <>
          <SheetItem
            icon={<ListOrdered />}
            label="Note for this set"
            hint={row.item.notes ? undefined : 'This set only'}
            onClick={onNote}
            data-testid="setlist-row-note"
          />
          {song && (
            <SheetItem
              icon={<SquareArrowOutUpRight />}
              label="Open song"
              onClick={onOpen}
              data-testid="setlist-row-open"
            />
          )}
        </>
      ) : (
        <SheetItem
          icon={<Pencil />}
          label={row.kind === 'break' ? 'Edit break' : 'Rename section'}
          onClick={onEdit}
          data-testid="setlist-row-edit"
        />
      )}
      <SheetItem
        icon={<Trash2 />}
        label="Remove from set…"
        hint={row.kind === 'song' ? 'Stays in your songs' : undefined}
        danger
        onClick={onRemove}
        data-testid="setlist-row-remove"
      />
    </Sheet>
  )
}

/** After…: pick the row this one goes after (or the top). */
export const AfterSheet: React.FC<{
  rows: Row[]
  movingId: string
  onPick: (afterId: string | null) => void
  onClose: () => void
}> = ({ rows, movingId, onPick, onClose }) => (
  <Sheet
    onClose={onClose}
    title="Move after…"
    data-testid="setlist-after-sheet"
  >
    <SheetItem
      icon={<ArrowUpToLine />}
      label="Top of the set"
      onClick={() => onPick(null)}
      data-testid="setlist-after-top"
    />
    {rows
      .filter(r => r.item.id !== movingId)
      .map(r => (
        <SheetItem
          key={r.item.id}
          icon={
            r.kind === 'song' ? (
              <span className="font-mono text-[12px] w-[19px] text-center">
                {r.number}
              </span>
            ) : r.kind === 'break' ? (
              <Clock />
            ) : (
              <ListMusic />
            )
          }
          label={rowLabel(r)}
          onClick={() => onPick(r.item.id)}
          data-testid={`setlist-after-${r.item.id}`}
        />
      ))}
  </Sheet>
)

// ── Add (phone) ─────────────────────────────────────────────────────────────

/** One Add at the thumb: Songs (accent), Break, Section label. */
export const AddMenuSheet: React.FC<{
  setName: string
  catalogName: string
  onPick: (what: 'songs' | 'break' | 'section') => void
  onClose: () => void
}> = ({ setName, catalogName, onPick, onClose }) => {
  const choice = (
    what: 'songs' | 'break' | 'section',
    icon: React.ReactNode,
    label: string,
    hint: string
  ) => (
    <button
      type="button"
      onClick={() => onPick(what)}
      className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-bg-3 text-left"
      data-testid={`setlist-addmenu-${what}`}
    >
      <span
        className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${what === 'songs' ? 'bg-accent text-on-accent' : 'bg-bg-4 text-ink-2'}`}
      >
        {icon}
      </span>
      <span>
        <b className="block text-[16px] text-ink-1">{label}</b>
        <span className="block text-[13px] text-ink-3">{hint}</span>
      </span>
    </button>
  )
  return (
    <Sheet
      onClose={onClose}
      title={`Add to ${setName}`}
      data-testid="setlist-add-sheet"
    >
      <div className="flex flex-col gap-2 pb-1">
        {choice(
          'songs',
          <Music2 size={20} />,
          'Songs',
          `Pick one or many from ${catalogName}`
        )}
        {choice(
          'break',
          <Clock size={20} />,
          'Break',
          'Timed gap · 15 min default'
        )}
        {choice(
          'section',
          <ListMusic size={20} />,
          'Section label',
          'Set 3, Encore, Acoustic…'
        )}
      </div>
    </Sheet>
  )
}

/** Insert a break (5–60 min, 15 preselected, optional note) or a section. */
export const InsertSheet: React.FC<{
  type: 'break' | 'section'
  defaultLabel: string
  afterLabel: string
  onAfter: () => void
  onInsert: (
    item:
      | { type: 'break'; minutes: number; note: string }
      | { type: 'section'; label: string }
  ) => void
  onClose: () => void
}> = ({
  type: initial,
  defaultLabel,
  afterLabel,
  onAfter,
  onInsert,
  onClose,
}) => {
  const [type, setType] = useState(initial)
  const [minutes, setMinutes] = useState(15)
  const [note, setNote] = useState('')
  const [label, setLabel] = useState(defaultLabel)
  const valid = type === 'break' || label.trim().length > 0
  const insert = () =>
    valid &&
    onInsert(
      type === 'break'
        ? { type, minutes, note: note.trim() }
        : { type, label: label.trim() }
    )
  return (
    <Sheet onClose={onClose} title="Insert" data-testid="setlist-insert-sheet">
      <Segmented
        label="Insert"
        value={type}
        onChange={setType}
        options={[
          { value: 'break', label: 'Break' },
          { value: 'section', label: 'Section' },
        ]}
        data-testid="setlist-insert-type"
      />
      {type === 'break' ? (
        <>
          <p className="mt-4 mb-2 font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3">
            Length
          </p>
          <div className="grid grid-cols-5 gap-2">
            {BREAK_MINUTES.map(m => (
              <button
                key={m}
                type="button"
                aria-pressed={m === minutes}
                onClick={() => setMinutes(m)}
                className={`h-12 rounded-xl font-mono text-[15px] font-bold ${m === minutes ? 'bg-accent text-on-accent' : 'bg-bg-3 text-ink-1'}`}
                data-testid={`setlist-insert-minutes-${m}`}
              >
                {m}
              </button>
            ))}
          </div>
          <label
            htmlFor="setlist-insert-note"
            className="block mt-3 rounded-xl bg-bg-3 px-3.5 pt-2.5 pb-2"
          >
            <span className="block font-mono text-[10px] tracking-[.14em] uppercase text-ink-3">
              Note · optional
            </span>
            <input
              id="setlist-insert-note"
              name="breakNote"
              value={note}
              maxLength={80}
              onChange={e => setNote(e.target.value)}
              placeholder="Swap to backup kit"
              className="w-full bg-transparent text-[15px] text-ink-1 placeholder:text-ink-4 outline-none py-1"
              data-testid="setlist-insert-note-input"
            />
          </label>
        </>
      ) : (
        <label
          htmlFor="setlist-insert-label"
          className="block mt-4 rounded-xl bg-bg-3 px-3.5 pt-2.5 pb-2"
        >
          <span className="block font-mono text-[10px] tracking-[.14em] uppercase text-ink-3">
            Label
          </span>
          <input
            id="setlist-insert-label"
            name="sectionLabel"
            value={label}
            maxLength={40}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && insert()}
            className="w-full bg-transparent text-[15px] text-ink-1 outline-none py-1"
            data-testid="setlist-insert-label-input"
          />
        </label>
      )}
      <p className="mt-4 mb-1 font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3">
        Goes after
      </p>
      <button
        type="button"
        onClick={onAfter}
        className="w-full flex items-center gap-3 min-h-[48px] px-1 text-left"
        data-testid="setlist-insert-after"
      >
        <ListOrdered size={18} className="text-ink-3" />
        <span className="flex-1 truncate text-[15px] font-semibold text-ink-1">
          {afterLabel}
        </span>
        <span className="text-ink-3">›</span>
      </button>
      <div className="grid grid-cols-2 gap-2.5 pt-3">
        <Button size="lg" onClick={onClose} data-testid="setlist-insert-cancel">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={!valid}
          onClick={insert}
          data-testid="setlist-insert-confirm"
        >
          Insert {type}
        </Button>
      </div>
    </Sheet>
  )
}

// ── Notes ───────────────────────────────────────────────────────────────────

/** The set's Markdown notes (FP 12), or a song's note for this set (plain). */
export const NotesSheet: React.FC<{
  title: string
  sub?: string
  value: string
  markdown: boolean
  onSave: (value: string) => void
  onClose: () => void
  'data-testid': string
}> = ({
  title,
  sub,
  value,
  markdown,
  onSave,
  onClose,
  'data-testid': testId,
}) => {
  const [v, setV] = useState(value)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const done = () => {
    if (v.trim() !== value.trim()) onSave(v)
    onClose()
  }
  return (
    <Sheet onClose={onClose} title={title} sub={sub} data-testid={testId}>
      {markdown ? (
        <MarkdownWriter
          value={v}
          onChange={setV}
          mode={mode}
          onModeChange={setMode}
          onDone={done}
          onCancel={onClose}
          rows={8}
          maxLength={4000}
          placeholder="Two sets. Keep Set 1 under 25…"
        />
      ) : (
        <textarea
          id="setlist-item-note"
          name="itemNote"
          autoFocus
          value={v}
          maxLength={150}
          rows={3}
          onChange={e => setV(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) done()
          }}
          placeholder="Breakdown at 2:40: watch Sarah"
          className="w-full rounded-xl bg-bg-3 p-3 text-[15px] text-ink-1 placeholder:text-ink-4 outline-none focus:ring-2 focus:ring-accent/40 resize-none"
          data-testid="setlist-item-note-input"
        />
      )}
      <div className="grid grid-cols-2 gap-2.5 pt-3">
        <Button size="lg" onClick={onClose} data-testid={`${testId}-cancel`}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={done}
          data-testid={`${testId}-save`}
        >
          Save
        </Button>
      </div>
    </Sheet>
  )
}
