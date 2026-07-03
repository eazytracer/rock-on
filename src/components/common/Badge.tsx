/**
 * Badge — static semantic status pill (mobile-redesign-port).
 *
 * A read-only tone-colored pill: info / success / warn / danger / neutral / accent.
 * Colors come from the design tokens (`BADGE_TONE` in src/utils/tokens.ts) so the whole
 * app stays in sync with the single source of truth.
 *
 * This is the non-interactive counterpart to `InlineStatusBadge` (which is a clickable
 * status dropdown). Use `Badge` for display-only status, source tags, counts, etc.
 */

import React from 'react'
import { BADGE_TONE, type BadgeTone } from '../../utils/tokens'

export interface BadgeProps {
  tone?: BadgeTone
  children: React.ReactNode
  /** Leading dot (default true). */
  dot?: boolean
  /** `sm` is denser; `md` (default) matches list/detail chrome. */
  size?: 'sm' | 'md'
  className?: string
  'data-testid'?: string
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  children,
  dot = true,
  size = 'md',
  className = '',
  'data-testid': testId = 'badge',
}) => {
  const t = BADGE_TONE[tone]
  const pad =
    size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[10.5px]'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold capitalize tracking-wide whitespace-nowrap ${pad} ${className}`}
      style={{
        color: t.color,
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
      }}
      data-testid={testId}
    >
      {dot && (
        <span
          className="inline-block rounded-full"
          style={{ width: 5, height: 5, backgroundColor: 'currentColor' }}
        />
      )}
      {children}
    </span>
  )
}
