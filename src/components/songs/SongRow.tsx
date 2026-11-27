/**
 * Song row (design/demo/screens/Song Row.html · "Grouped, quieter").
 * No ⋯: tap opens the song (desktop pane: click selects, double-click or Enter
 * opens), swipe left for Hide / Add to set, press and hold
 * (or right-click) for the full menu. The row is a SongLine (two lines on
 * phones, the table's columns on desktop); desktop adds hover actions.
 */
import React, { useRef, useState } from 'react'
import { EyeOff, Eye, ListPlus, Link as LinkIcon } from 'lucide-react'
import type { Song } from '../../models/Song'
import { toSongLine, type ListView, type NoteMark } from '../../domain/songs'
import { NoteMarkIcon, SongLine } from './SongLine'

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
  /** Double-click / Enter: open the song page (the pane's click only selects). */
  onActivate?: () => void
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
  onActivate = onOpen,
  onMenu,
  onHide,
  onAddToSet,
}) => {
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
    'data-selected': selected || undefined,
    onClick: handleClick,
    onDoubleClick: () => {
      if (onActivate !== onOpen) onActivate()
    },
    onContextMenu,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') onActivate()
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))
        onMenu(null)
    },
    'data-testid': `song-row-${song.id}`,
    'aria-label': song.title,
  }

  const marks = (
    <>
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
    </>
  )
  const next = view.nextShow && nextShow && (
    <p className="font-mono text-[11.5px] text-accent-ink truncate">
      Next: {nextShow}
    </p>
  )
  const line = (className: string, trail?: React.ReactNode) => (
    <SongLine
      song={toSongLine(song)}
      density={view.density}
      fields={{
        artist: view.artist,
        key: view.key,
        bpm: view.bpm,
        links: view.links,
      }}
      marks={marks}
      sub={next}
      trail={trail}
      className={className}
    />
  )

  if (layout === 'table') {
    return (
      <div
        {...rowProps}
        className={`group relative border-b border-divider cursor-pointer outline-none focus-visible:bg-bg-3 ${selected ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg-1))] before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:bg-accent' : 'hover:bg-bg-2'} ${
          hidden ? 'opacity-55' : ''
        }`}
      >
        {line(
          'pl-7 pr-4',
          <span className="flex items-center justify-end gap-1 w-[72px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
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
              title="Add to setlist or practice"
              aria-label="Add to setlist or practice"
              className="grid place-items-center w-8 h-8 rounded-lg text-ink-3 hover:bg-bg-3 hover:text-ink-1"
            >
              <ListPlus size={17} />
            </button>
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
            Add to…
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
        className={`relative bg-bg-2 select-none outline-none focus-visible:bg-bg-3 [-webkit-touch-callout:none] ${
          hidden ? 'opacity-55' : ''
        }`}
      >
        {line('px-4')}
      </div>
    </div>
  )
}
