import React from 'react'
import { MoreHorizontal } from 'lucide-react'

/**
 * A detail page's ⋯ menu button (song, setlist, practice, show): round, at
 * the right end of the title row.
 */
export const MoreButton: React.FC<{
  label: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  'data-testid': string
}> = ({ label, onClick, 'data-testid': testId }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-bg-3 text-ink-1 hover:bg-bg-4"
    data-testid={testId}
  >
    <MoreHorizontal size={19} />
  </button>
)
