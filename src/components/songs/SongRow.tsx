/**
 * Song row (design/demo/screens/Song Row.html · "Grouped, quieter").
 * No ⋯: tap opens the song, swipe left for Hide / Add to set, press and hold
 * (or right-click) for the full menu. Phones get the two-line row; desktop
 * gets a table row with hover actions.
 */
import React, { useRef, useState } from 'react'
import {
  FileText,
  FileLock2,
  Files,
  Clock,
  Hash,
  Activity,
  EyeOff,
  Eye,
  ListPlus,
  Link as LinkIcon,
} from 'lucide-react'
import type { Song } from '../../models/Song'
import type { ReferenceLink } from '../../types'
import { TuningPill } from '../ui'
import { formatSeconds } from '../../domain/format'
import { linkGlyph } from './linkGlyphs'
import { type ListView, type NoteMark } from '../../domain/songs'

/** 30 px outlined tile, 16 px glyph, 44 px hit area. Opens the link. */
export const LinkTile: React.FC<{ link: ReferenceLink }> = ({ link }) => {
  const g = linkGlyph(link)
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={link.description || g.name}
      aria-label={`${g.name}: ${link.description || link.url}`}
      data-testid="song-link-tile"
      className="grid place-items-center w-11 h-11 -m-[7px] shrink-0"
    >
      <span
        className={`grid place-items-center w-[30px] h-[30px] rounded-[9px] border border-border-1 bg-bg-2 [&>svg]:w-4 [&>svg]:h-4 ${g.tone}`}
      >
        {g.icon}
      </span>
    </a>
  )
}

/** Grey mark after the title: band notes, mine (lock), or both (stacked). */
export const NoteMarkIcon: React.FC<{ mark: NoteMark }> = ({ mark }) => {
  if (mark === 'none') return null
  const Icon = mark === 'both' ? Files : mark === 'mine' ? FileLock2 : FileText
  const label =
    mark === 'both'
      ? 'Band and my notes'
      : mark === 'mine'
        ? 'My notes'
        : 'Band notes'
  return (
    <Icon
      size={15}
      className="inline-block shrink-0 text-ink-4"
      aria-label={label}
      data-testid="song-notes-mark"
    />
  )
}

export interface SongRowProps {
  song: Song
  view: ListView
  layout: 'list' | 'table'
  mark: NoteMark
  nextShow?: string
  hidden?: boolean
  linked?: boolean
  selected?: boolean
  onOpen: () => void
  onMenu: (at: { x: number; y: number } | null) => void
  onHide: () => void
  onAddToSet: () => void
}

const HOLD_MS = 450
const SWIPE_OPEN = -148

export const SongRow: React.FC<SongRowProps> = ({
  song,
  view,
  layout,
  mark,
  nextShow,
  hidden,
  linked,
  selected,
  onOpen,
  onMenu,
  onHide,
  onAddToSet,
}) => {
  const compact = view.density === 'compact'
  const links = view.links ? (song.referenceLinks ?? []).slice(0, 2) : []
  const tuning = song.guitarTuning || 'Standard'

  // Press and hold → menu; horizontal drag → swipe actions (touch only).
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [dx, setDx] = useState(0)
  const [swiping, setSwiping] = useState(false)

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
  }

  const touch = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
      held.current = false
      hold.current = setTimeout(() => {
        held.current = true
        navigator.vibrate?.(10)
        onMenu(null)
      }, HOLD_MS)
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!start.current) return
      const t = e.touches[0]
      const mx = t.clientX - start.current.x
      const my = t.clientY - start.current.y
      if (Math.abs(mx) > 8 || Math.abs(my) > 8) cancelHold()
      if (!swiping && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my))
        setSwiping(true)
      if (swiping)
        setDx(
          Math.max(SWIPE_OPEN - 20, Math.min(0, mx + (dx < 0 ? SWIPE_OPEN : 0)))
        )
    },
    onTouchEnd: () => {
      cancelHold()
      start.current = null
      if (swiping) {
        setDx(dx < SWIPE_OPEN / 2 ? SWIPE_OPEN : 0)
        setTimeout(() => setSwiping(false), 0)
      }
    },
  }

  const handleClick = () => {
    if (held.current || swiping) return
    if (dx !== 0) return setDx(0)
    onOpen()
  }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    cancelHold()
    onMenu({ x: e.clientX, y: e.clientY })
  }

  const rowProps = {
    role: 'button' as const,
    tabIndex: 0,
    onClick: handleClick,
    onContextMenu,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') onOpen()
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))
        onMenu(null)
    },
    'data-testid': `song-row-${song.id}`,
    'aria-label': song.title,
  }

  const titleLine = (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="truncate">
        <b className="font-bold text-ink-1" data-testid="song-title">
          {song.title}
        </b>
        {layout === 'list' && view.artist && song.artist && (
          <span className="font-semibold text-ink-3"> · {song.artist}</span>
        )}
      </span>
      <NoteMarkIcon mark={mark} />
      {linked && (
        <LinkIcon
          size={13}
          className="shrink-0 text-info"
          aria-label="In My Songs"
          data-testid="song-linked-indicator"
        />
      )}
      {hidden && (
        <EyeOff size={13} className="shrink-0 text-ink-4" aria-label="Hidden" />
      )}
    </span>
  )

  if (layout === 'table') {
    return (
      <div
        {...rowProps}
        className={`group relative grid grid-cols-[minmax(0,1fr)_96px_52px_52px_64px_92px_72px] items-center gap-2 pl-7 pr-4 border-b border-divider cursor-pointer outline-none focus-visible:bg-bg-3 ${
          compact ? 'h-12' : 'h-14'
        } ${selected ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-1))] before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:bg-accent' : 'hover:bg-bg-2'} ${
          hidden ? 'opacity-55' : ''
        }`}
      >
        <span className="min-w-0 text-[15px]">
          {titleLine}
          {!compact && view.artist && song.artist && (
            <span className="block truncate text-[12.5px] text-ink-3">
              {song.artist}
            </span>
          )}
        </span>
        <span>
          <TuningPill tuning={tuning} size="sm" />
        </span>
        <span className="font-mono text-[13.5px] text-ink-2">
          {view.key ? song.key || '—' : ''}
        </span>
        <span className="font-mono text-[13.5px] text-ink-2">
          {view.bpm ? song.bpm || '—' : ''}
        </span>
        <span className="font-mono text-[13.5px] text-ink-2">
          {formatSeconds(song.duration) || '—'}
        </span>
        <span className="flex items-center gap-1.5">
          {links.map((l, i) => (
            <LinkTile key={i} link={l} />
          ))}
        </span>
        <span className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onHide()
            }}
            title={hidden ? 'Show again' : 'Hide'}
            aria-label={hidden ? 'Show again' : 'Hide'}
            className="grid place-items-center w-8 h-8 rounded-lg text-ink-3 hover:bg-bg-3 hover:text-ink-1"
          >
            {hidden ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onAddToSet()
            }}
            title="Add to setlist"
            aria-label="Add to setlist"
            className="grid place-items-center w-8 h-8 rounded-lg text-ink-3 hover:bg-bg-3 hover:text-ink-1"
          >
            <ListPlus size={17} />
          </button>
        </span>
        {view.nextShow && nextShow && (
          <span className="col-span-full -mt-1 pb-1 font-mono text-[11px] text-accent-ink truncate">
            Next: {nextShow}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden border-b border-divider last:border-0">
      {/* Swipe actions (mounted only while swiping, so nothing shows at the corners) */}
      {(dx !== 0 || swiping) && (
        <div className="absolute inset-y-0 right-0 flex">
          <button
            type="button"
            onClick={() => {
              setDx(0)
              onHide()
            }}
            className="w-[74px] flex flex-col items-center justify-center gap-1 bg-bg-4 text-ink-1 text-[12px] font-semibold"
          >
            {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
            {hidden ? 'Show' : 'Hide'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDx(0)
              onAddToSet()
            }}
            className="w-[74px] flex flex-col items-center justify-center gap-1 bg-accent text-on-accent text-[12px] font-semibold"
          >
            <ListPlus size={18} />
            Add to set
          </button>
        </div>
      )}

      <div
        {...rowProps}
        {...touch}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: start.current ? 'none' : 'transform .2s',
        }}
        className={`relative bg-bg-2 px-4 select-none outline-none focus-visible:bg-bg-3 [-webkit-touch-callout:none] ${
          compact ? 'py-2.5' : 'py-3'
        } ${hidden ? 'opacity-55' : ''}`}
      >
        <div className="flex items-center gap-2 text-[15.5px]">
          <span className="flex-1 min-w-0">{titleLine}</span>
          {compact && (
            <>
              <TuningPill tuning={tuning} size="sm" />
              <span className="font-mono text-[13px] text-ink-2 w-10 text-right">
                {formatSeconds(song.duration)}
              </span>
            </>
          )}
        </div>
        {!compact && (
          <div className="mt-2 flex items-center gap-3 font-mono text-[13.5px] font-semibold text-ink-1">
            <TuningPill tuning={tuning} size="md" />
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-ink-4" />
              {formatSeconds(song.duration) || '—'}
            </span>
            {view.key && (
              <span className="flex items-center gap-1">
                <Hash size={13} className="text-ink-4" />
                {song.key || '—'}
              </span>
            )}
            {view.bpm && (
              <span className="flex items-center gap-1">
                <Activity size={13} className="text-ink-4" />
                {song.bpm || '–'}
              </span>
            )}
            <span className="ml-auto flex items-center gap-2.5">
              {links.map((l, i) => (
                <LinkTile key={i} link={l} />
              ))}
            </span>
          </div>
        )}
        {view.nextShow && nextShow && (
          <p className="mt-1.5 font-mono text-[11.5px] text-accent-ink truncate">
            Next: {nextShow}
          </p>
        )}
      </div>
    </div>
  )
}
