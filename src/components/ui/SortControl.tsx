/**
 * Sort control: what to sort by (opens the field menu) and, beside it, a
 * direction toggle that names the order (A–Z, Newest, Soonest…) with an arrow.
 */
import React from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react'
import { dirLabel, type SortDir, type SortKind } from '../../domain/sort'

export const SortControl: React.FC<{
  label: string
  kind: SortKind
  dir: SortDir
  onPick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onFlip: () => void
  testId: string
}> = ({ label, kind, dir, onPick, onFlip, testId }) => {
  const order = dirLabel(kind, dir)
  const Arrow = dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <span className="inline-flex items-center h-[38px] rounded-full shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))] text-[13.5px] font-semibold text-ink-2">
      <button
        type="button"
        onClick={onPick}
        aria-haspopup="menu"
        aria-label={`Sort by ${label}`}
        className="inline-flex items-center gap-[7px] h-full pl-[13px] pr-2.5 rounded-l-full whitespace-nowrap hover:text-ink-1"
        data-testid={testId}
      >
        <ArrowUpDown size={15} />
        {label}
        <ChevronDown size={14} className="text-ink-3" />
      </button>
      <span className="w-px h-5 bg-border-1" aria-hidden />
      <button
        type="button"
        onClick={onFlip}
        aria-label={`Order: ${order}. Reverse`}
        title="Reverse order"
        className="inline-flex items-center gap-1 h-full pl-2.5 pr-[13px] rounded-r-full whitespace-nowrap text-ink-1 hover:bg-bg-3"
        data-testid={`${testId}-dir`}
        data-dir={dir}
      >
        <Arrow size={15} />
        {order}
      </button>
    </span>
  )
}
