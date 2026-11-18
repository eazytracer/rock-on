/**
 * A tool opened over a stage screen (docs/redesign/12 · 2.3): the practice
 * session opens the tuner (and later the chart) in this full-screen layer so
 * its own state stays put. × or Esc closes it.
 */
import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export const ToolLayer: React.FC<{
  title: string
  sub?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  'data-testid'?: string
}> = ({ title, sub, onClose, children, 'data-testid': testId }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // A sheet inside the layer closes first.
      if (document.querySelector('[role="dialog"]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[58] bg-bg-0 text-ink-1 flex flex-col"
      role="region"
      aria-label={title}
      data-testid={testId}
    >
      <header className="flex items-center gap-3 px-4 md:px-6 pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
          className="grid place-items-center w-11 h-11 rounded-full bg-bg-2 shrink-0"
          data-testid="tool-layer-close"
        >
          <X size={19} />
        </button>
        <div className="flex-1 min-w-0">
          <b className="block text-[17px] font-bold">{title}</b>
          {sub && (
            <small className="block font-mono text-[11px] uppercase tracking-[.12em] text-ink-3 truncate">
              {sub}
            </small>
          )}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-thin px-4 md:px-6 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}
