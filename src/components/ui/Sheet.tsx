/**
 * Kit sheet (`r-sheet`): a bottom sheet with a grabber on phones, a centred
 * card on desktop. When `at` is given on desktop it opens there instead, as a
 * context menu (right-click).
 */
import React, { useEffect, useLayoutEffect, useRef } from 'react'

export interface SheetProps {
  onClose: () => void
  title?: React.ReactNode
  sub?: React.ReactNode
  /** Desktop only: open as a popover at this point. */
  at?: { x: number; y: number } | null
  /** Popover width in px (default 288). */
  width?: number
  children: React.ReactNode
  'data-testid'?: string
}

export const Sheet: React.FC<SheetProps> = ({
  onClose,
  title,
  sub,
  at,
  width = 288,
  children,
  'data-testid': testId,
}) => {
  useEffect(() => {
    // preventDefault: Esc closes only this sheet, not the screen under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const pop = at && window.innerWidth >= 768
  const top = pop ? Math.max(8, Math.min(at.y, window.innerHeight - 420)) : 0
  const style: React.CSSProperties | undefined = pop
    ? {
        left: Math.max(8, Math.min(at.x, window.innerWidth - width - 12)),
        top,
        width,
        // A long list scrolls inside the popover instead of running off-screen.
        maxHeight: window.innerHeight - top - 8,
      }
    : undefined

  // A popover taller than the room below its anchor moves up until it fits.
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!pop || !el) return
    const fit = Math.max(8, window.innerHeight - 8 - el.scrollHeight)
    if (fit < top) {
      el.style.top = `${fit}px`
      el.style.maxHeight = `${window.innerHeight - fit - 8}px`
    }
  })

  return (
    <div
      className={`fixed inset-0 z-[60] ${pop ? '' : 'bg-black/50 md:grid md:place-items-center'}`}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
      onContextMenu={e => {
        e.preventDefault()
        onClose()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        data-testid={testId}
        style={style}
        className={
          pop
            ? 'fixed max-h-[calc(100vh-16px)] overflow-y-auto custom-scrollbar-thin rounded-2xl bg-bg-2 p-1.5 shadow-float ring-1 ring-border-1'
            : 'absolute md:static inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto custom-scrollbar-thin rounded-t-[28px] md:rounded-[24px] bg-bg-2 shadow-sheet md:w-[420px] px-4 pb-[max(16px,env(safe-area-inset-bottom))]'
        }
      >
        {!pop && (
          <span className="mx-auto mt-2.5 mb-3 block w-10 h-[5px] rounded-full bg-border-1 md:hidden" />
        )}
        {(title || sub) && (
          <div
            className={pop ? 'px-2.5 pt-1.5 pb-1' : 'px-1 pt-1 md:pt-5 pb-3'}
          >
            {title && (
              <div
                className={
                  pop
                    ? 'font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 truncate'
                    : 'text-[19px] font-bold text-ink-1'
                }
              >
                {title}
              </div>
            )}
            {sub && !pop && (
              <div className="text-[13px] text-ink-3 mt-0.5">{sub}</div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** One action in a sheet or context menu. */
export const SheetItem: React.FC<{
  icon: React.ReactNode
  label: string
  hint?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  'data-testid'?: string
}> = ({
  icon,
  label,
  hint,
  danger,
  disabled,
  onClick,
  'data-testid': testId,
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
    className={`w-full flex items-center gap-3 min-h-[48px] md:min-h-[40px] px-2.5 rounded-xl text-left text-[15.5px] md:text-[14px] font-semibold hover:bg-bg-3 disabled:opacity-45 disabled:hover:bg-transparent [&>svg]:w-[19px] [&>svg]:h-[19px] [&>svg]:shrink-0 ${
      danger
        ? 'text-danger [&>svg]:text-danger'
        : 'text-ink-1 [&>svg]:text-ink-3'
    }`}
  >
    {icon}
    <span className="flex-1 truncate">{label}</span>
    {hint && (
      <span
        className={`font-mono text-[10.5px] tracking-[.08em] uppercase truncate max-w-[45%] ${danger ? 'text-danger normal-case tracking-normal font-sans text-[12px]' : 'text-ink-3'}`}
      >
        {hint}
      </span>
    )}
  </button>
)
