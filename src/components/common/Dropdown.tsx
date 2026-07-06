import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Anchored-menu Dropdown — the design system's "C0 · Inputs & pickers" control.
 * Replaces native `<select>` everywhere (never a native select, never a mobile
 * sheet): grouped options with mono eyebrows, a colored dot / icon per option,
 * a check on the active value, optional footer actions, and full keyboard nav.
 */

export interface DropdownOption {
  value: string
  label: string
  color?: string
  icon?: React.ReactNode
  disabled?: boolean
  /** Muted trailing tag, e.g. "custom". */
  tag?: string
}

export interface DropdownGroup {
  /** Renders as a mono uppercase eyebrow above the group. */
  label?: string
  options: DropdownOption[]
}

export interface DropdownAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
}

export interface DropdownProps {
  value: string | null
  onChange: (value: string) => void
  groups: DropdownGroup[]
  placeholder?: string
  footerActions?: DropdownAction[]
  disabled?: boolean
  'data-testid'?: string
  /** Optional custom trigger content given the selected option (or null). */
  renderTriggerLabel?: (opt: DropdownOption | null) => React.ReactNode
}

const ColorDot: React.FC<{ color: string }> = ({ color }) => (
  <span
    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
    style={{ backgroundColor: color }}
    aria-hidden
  />
)

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  groups,
  placeholder = 'Select…',
  footerActions,
  disabled = false,
  'data-testid': testid,
  renderTriggerLabel,
}) => {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Flat list of options (for keyboard nav + selected lookup).
  const flat = useMemo(() => groups.flatMap(g => g.options), [groups])
  const selected = useMemo(
    () => flat.find(o => o.value === value) ?? null,
    [flat, value]
  )

  const firstEnabledFrom = (start: number, dir: 1 | -1): number => {
    let i = start
    for (let n = 0; n < flat.length; n++) {
      if (i < 0) i = flat.length - 1
      if (i >= flat.length) i = 0
      if (!flat[i]?.disabled) return i
      i += dir
    }
    return -1
  }

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const openMenu = () => {
    if (disabled) return
    setOpen(true)
    const selIdx = flat.findIndex(o => o.value === value && !o.disabled)
    setHighlight(selIdx >= 0 ? selIdx : firstEnabledFrom(0, 1))
  }

  const close = (refocus = true) => {
    setOpen(false)
    setHighlight(-1)
    if (refocus) triggerRef.current?.focus()
  }

  const select = (opt: DropdownOption) => {
    if (opt.disabled) return
    onChange(opt.value)
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        close(false)
        break
      case 'ArrowDown':
        e.preventDefault()
        setHighlight(h => firstEnabledFrom(h + 1, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlight(h => firstEnabledFrom(h - 1, -1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (flat[highlight]) select(flat[highlight])
        break
    }
  }

  let flatIdx = -1 // running index across groups for highlight matching

  return (
    <div ref={containerRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        data-testid={testid ? `${testid}-trigger` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
          disabled
            ? 'bg-bg-2 border-border-1 text-ink-5 cursor-not-allowed'
            : 'bg-bg-2 border-border-1 text-ink-1 hover:border-border-2'
        }`}
      >
        <span className="flex-1 flex items-center gap-2 min-w-0">
          {renderTriggerLabel ? (
            renderTriggerLabel(selected)
          ) : selected ? (
            <>
              {selected.color && <ColorDot color={selected.color} />}
              {selected.icon}
              <span className="truncate">{selected.label}</span>
            </>
          ) : (
            <span className="text-ink-4 truncate">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-ink-4 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          data-testid={testid ? `${testid}-menu` : undefined}
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-2 border border-border-1 rounded-lg shadow-lg py-1 max-h-72 overflow-y-auto custom-scrollbar-thin"
        >
          {groups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`}>
              {group.label && (
                <div className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-ink-4">
                  {group.label}
                </div>
              )}
              {group.options.map(opt => {
                flatIdx += 1
                const idx = flatIdx
                const active = opt.value === value
                const highlighted = idx === highlight
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-disabled={opt.disabled}
                    disabled={opt.disabled}
                    data-testid={
                      testid ? `${testid}-option-${opt.value}` : undefined
                    }
                    onMouseEnter={() => !opt.disabled && setHighlight(idx)}
                    onClick={() => select(opt)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                      opt.disabled
                        ? 'text-ink-5 cursor-not-allowed'
                        : highlighted
                          ? 'bg-bg-3 text-ink-1'
                          : 'text-ink-2 hover:bg-bg-3'
                    }`}
                  >
                    {opt.color && <ColorDot color={opt.color} />}
                    {opt.icon}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.tag && (
                      <span className="text-[10px] text-ink-4 flex-shrink-0">
                        {opt.tag}
                      </span>
                    )}
                    {active && (
                      <Check size={15} className="text-accent flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {footerActions && footerActions.length > 0 && (
            <>
              <div className="my-1 border-t border-border-1" />
              {footerActions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  data-testid={testid ? `${testid}-action-${i}` : undefined}
                  onClick={() => {
                    setOpen(false)
                    action.onClick()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-ink-3 hover:bg-bg-3 hover:text-white transition-colors"
                >
                  {action.icon}
                  <span className="flex-1 truncate">{action.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
