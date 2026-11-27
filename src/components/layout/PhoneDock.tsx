/**
 * The phone dock: one bottom row. On a page with a main action (Start
 * practice, a setlist's Add, Open set, the metronome's Start) the tab bar
 * tucks into a small pill on the left and the action fills the rest of the
 * row. Tap or swipe right on the pill for the full tab bar; picking a tab,
 * swiping left, tapping the content or 4 s idle tucks it back. A fade with a
 * blur sits under the bottom of every phone page so content softens into the
 * bar instead of sliding under it.
 *
 * Pages put their action in `<DockAction>`: portalled into the dock on phones,
 * rendered in place from md up (where the page lays it out itself).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useResponsive'
import { BottomNavigation } from '../common/BottomNavigation'

interface DockState {
  slot: HTMLElement | null
  register: () => () => void
}

const DockContext = createContext<DockState | null>(null)

/** A page's main action: in the phone dock, or in place from md up. */
export const DockAction: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dock = useContext(DockContext)
  const desktop = useMediaQuery('(min-width: 768px)')
  const docked = !!dock && !desktop
  const register = dock?.register
  useLayoutEffect(
    () => (docked && register ? register() : undefined),
    [docked, register]
  )
  if (!docked) return <>{children}</>
  return dock.slot ? createPortal(children, dock.slot) : null
}

const IDLE_MS = 4000
const SWIPE_PX = 30

export const DockProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [actions, setActions] = useState(0)
  const register = useCallback(() => {
    setActions(n => n + 1)
    return () => setActions(n => n - 1)
  }, [])
  return (
    <DockContext.Provider value={{ slot, register }}>
      {children}
      <div className="md:hidden">
        <Dock hasAction={actions > 0} onSlot={setSlot} />
      </div>
    </DockContext.Provider>
  )
}

/** The handle between the tabs and the action: the part that stays in view. */
const HANDLE = 64
/** Gap to the screen edge at the bar's rounded end. */
const EDGE = 16

const useViewportWidth = () => {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

const Dock: React.FC<{
  hasAction: boolean
  onSlot: (el: HTMLElement | null) => void
}> = ({ hasAction, onSlot }) => {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const tucked = hasAction && !open

  // One strip, [tabs][handle][action], wider than the screen, that slides:
  // tucked, the tabs hang off the left edge and the handle sits against it;
  // open, the action hangs off the right edge behind the handle.
  const width = useViewportWidth()
  const panel = width - EDGE - HANDLE
  const atOpen = EDGE
  const atTucked = -panel
  const x = Math.min(
    atOpen,
    Math.max(atTucked, (tucked ? atTucked : atOpen) + (drag ?? 0))
  )

  // A new page starts tucked.
  useEffect(() => setOpen(false), [pathname])

  // Idle, or a tap anywhere but the bar, tucks it back.
  useEffect(() => {
    if (!open || !hasAction) return
    const t = window.setTimeout(() => setOpen(false), IDLE_MS)
    const away = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-dock]')) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('pointerdown', away)
    }
  }, [open, hasAction])

  // The strip follows a drag on the tabs or the handle (a slide across the
  // action is a press) and settles on the nearer side, or flips on a flick.
  // Moves are read on the window: the action is portalled in from the page,
  // so React bubbles its pointer events through the page, not the dock.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!hasAction) return
    if ((e.target as HTMLElement).closest('[data-testid="dock-action"]')) return
    const x0 = e.clientX
    const move = (m: PointerEvent) => {
      const dx = m.clientX - x0
      if (Math.abs(dx) > 4) setDrag(dx)
    }
    const up = (u: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      const dx = u.clientX - x0
      setDrag(null)
      if (dx > SWIPE_PX) setOpen(true)
      else if (dx < -SWIPE_PX) setOpen(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  return (
    <>
      {/* Content fades and blurs into the bar. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[118px] backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black_45%,transparent)]"
        style={{
          background:
            'linear-gradient(to top, var(--bg-1) 22%, color-mix(in srgb, var(--bg-1) 70%, transparent) 55%, transparent)',
        }}
        data-testid="dock-fade"
      />
      {!hasAction ? (
        <div
          data-dock
          className="fixed inset-x-4 z-40 h-16 flex justify-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}
          data-testid="phone-dock"
          data-tucked={false}
        >
          <BottomNavigation />
          <div ref={onSlot} className="hidden" data-testid="dock-action" />
        </div>
      ) : (
        // Clips the strip at the screen edges; tall enough for its shadow.
        <div
          className="pointer-events-none fixed inset-x-0 z-40 h-24 overflow-hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 2px)' }}
        >
          <div
            data-dock
            className={`pointer-events-auto absolute top-4 left-0 h-16 rounded-full bg-bg-3 shadow-float flex items-center px-1.5 touch-pan-y ${
              drag === null ? 'transition-transform duration-300 ease-rock' : ''
            }`}
            style={{
              width: 2 * panel + HANDLE,
              transform: `translateX(${x}px)`,
            }}
            data-testid="phone-dock"
            data-tucked={tucked}
            onPointerDown={onPointerDown}
          >
            <div
              className="flex"
              style={{ width: panel - 6 }}
              aria-hidden={tucked}
            >
              <BottomNavigation inBar onPick={() => setOpen(false)} />
            </div>
            {/* The handle: ☰ › for the tabs, or a grip ‹ back to the action. */}
            <div
              className="relative shrink-0 h-[52px]"
              style={{ width: HANDLE }}
            >
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Show the tab bar"
                className={`absolute inset-y-0 inset-x-1.5 rounded-full bg-bg-2 flex items-center justify-center gap-0.5 pl-1.5 text-ink-3 transition-opacity duration-300 ${
                  tucked ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden={!tucked}
                tabIndex={tucked ? 0 : -1}
                data-testid="dock-tab-pill"
              >
                <Menu size={22} />
                <ChevronRight size={17} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Back to this page's action"
                className={`absolute inset-y-0 inset-x-1.5 rounded-full bg-bg-2 flex items-center justify-center gap-1 text-ink-3 hover:text-ink-1 transition-opacity duration-300 ${
                  tucked ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
                aria-hidden={tucked}
                tabIndex={tucked ? -1 : 0}
                data-testid="dock-back-to-action"
              >
                <ChevronLeft size={18} />
                <span className="h-6 w-1 rounded-full bg-current opacity-60" />
              </button>
            </div>
            <div
              ref={onSlot}
              // Hidden while open so no sliver shows past the screen edge.
              className={`flex items-center gap-1.5 transition-opacity duration-300 [&_button]:!h-[52px] [&_button]:!rounded-full [&_button]:!shadow-none ${
                tucked || drag !== null ? '' : 'opacity-0'
              }`}
              style={{ width: panel - 6 }}
              aria-hidden={!tucked}
              data-testid="dock-action"
            />
          </div>
        </div>
      )}
    </>
  )
}
