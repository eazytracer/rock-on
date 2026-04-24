/**
 * ScrollableNotes — notes panel for the practice session viewer with
 * Kindle-style full-width tap zones at the top and bottom for page-by-page
 * scrolling. Keyboard + BT foot-pedal shortcuts (PageUp/PageDown,
 * Space/Shift+Space) are window-scoped while the panel is mounted so a
 * dedicated session page listener isn't required.
 *
 * See `.claude/specifications/2025-10-22T14:01_design-style-guide.md` §
 * "Notes scroll controls (Kindle-style)" for the full design contract.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { MarkdownRenderer } from '../notes/MarkdownRenderer'

export type NotesFontSize = 'sm' | 'md' | 'lg'
export type NotesButtonSize = 'sm' | 'md' | 'lg'

const FONT_CLASSES: Record<NotesFontSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

export interface ScrollableNotesProps {
  notes: string | undefined
  fontSize?: NotesFontSize
  /** sm/md/lg sizing for the page-turner tap zones (per viewport class). */
  buttonSize?: NotesButtonSize
  /**
   * When true, the panel attaches PageUp/PageDown/Space keyboard handlers
   * at window scope. Enable on the active practice session page; leave off
   * in preview contexts where multiple panels would fight.
   */
  windowShortcuts?: boolean
  emptyMessage?: string
  'data-testid'?: string
}

export const ScrollableNotes: React.FC<ScrollableNotesProps> = ({
  notes,
  fontSize = 'md',
  buttonSize = 'md',
  windowShortcuts = false,
  emptyMessage = 'No notes for this song',
  'data-testid': testId,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) {
      setCanScrollUp(false)
      setCanScrollDown(false)
      return
    }
    const isScrollable = el.scrollHeight > el.clientHeight + 2
    setCanScrollUp(isScrollable && el.scrollTop > 2)
    setCanScrollDown(
      isScrollable && el.scrollTop + el.clientHeight < el.scrollHeight - 2
    )
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, notes, fontSize])

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el) return
    const pageSize = Math.floor(el.clientHeight * 0.7)
    el.scrollBy({ top: pageSize * dir, behavior: 'smooth' })
  }, [])

  // Element-scoped keyboard handler — used when windowShortcuts is off
  const handleElementKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'PageDown' || (e.code === 'Space' && !e.shiftKey)) {
      e.preventDefault()
      scrollByPage(1)
      return
    }
    if (e.key === 'PageUp' || (e.code === 'Space' && e.shiftKey)) {
      e.preventDefault()
      scrollByPage(-1)
    }
  }

  // Window-scoped keyboard handler — used when windowShortcuts is on
  useEffect(() => {
    if (!windowShortcuts) return
    const handler = (e: KeyboardEvent) => {
      // Don't steal keys from inputs / textareas
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.key === 'PageDown' || (e.code === 'Space' && !e.shiftKey)) {
        e.preventDefault()
        scrollByPage(1)
        return
      }
      if (e.key === 'PageUp' || (e.code === 'Space' && e.shiftKey)) {
        e.preventDefault()
        scrollByPage(-1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [windowShortcuts, scrollByPage])

  if (!notes) {
    return (
      <div
        className="h-full flex items-center justify-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#505050] italic text-sm"
        data-testid={testId}
      >
        {emptyMessage}
      </div>
    )
  }

  const zoneHeight = {
    sm: 'h-9', // 36px
    md: 'h-12', // 48px
    lg: 'h-16', // 64px
  }[buttonSize]
  const iconSize = buttonSize === 'lg' ? 32 : buttonSize === 'md' ? 24 : 18

  return (
    <div
      className="relative h-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-[#f17827ff]/30"
      data-testid={testId}
    >
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={windowShortcuts ? undefined : handleElementKeyDown}
        className={`h-full overflow-y-auto custom-scrollbar px-4 py-3 focus:outline-none ${FONT_CLASSES[fontSize]}`}
        data-testid="notes-scroll-container"
      >
        <MarkdownRenderer content={notes} />
      </div>

      {/* Top page-turner zone */}
      {canScrollUp && (
        <button
          onClick={() => scrollByPage(-1)}
          data-testid="notes-scroll-up"
          aria-label="Scroll notes up"
          className={`absolute top-0 left-0 right-0 ${zoneHeight} flex items-center justify-center text-[#f17827ff] hover:text-white bg-gradient-to-b from-black/70 via-black/30 to-transparent hover:from-[#f17827ff]/30 hover:via-[#f17827ff]/15 transition-colors group`}
        >
          <ChevronUp
            size={iconSize}
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] group-hover:scale-110 transition-transform"
          />
        </button>
      )}

      {/* Bottom page-turner zone */}
      {canScrollDown && (
        <button
          onClick={() => scrollByPage(1)}
          data-testid="notes-scroll-down"
          aria-label="Scroll notes down"
          className={`absolute bottom-0 left-0 right-0 ${zoneHeight} flex items-center justify-center text-[#f17827ff] hover:text-white bg-gradient-to-t from-black/70 via-black/30 to-transparent hover:from-[#f17827ff]/30 hover:via-[#f17827ff]/15 transition-colors group`}
        >
          <ChevronDown
            size={iconSize}
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] group-hover:scale-110 transition-transform"
          />
        </button>
      )}
    </div>
  )
}

export default ScrollableNotes
