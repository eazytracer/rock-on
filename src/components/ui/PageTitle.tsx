/**
 * Screen title (`r-ttl` / desktop `.hd`): optional mono eyebrow, the big display
 * name, an optional count, and actions on the right.
 */
import React from 'react'

interface PageTitleProps {
  title: string
  eyebrow?: string
  count?: number
  actions?: React.ReactNode
  testId?: string
}

export const PageTitle: React.FC<PageTitleProps> = ({
  title,
  eyebrow,
  count,
  actions,
  testId,
}) => (
  <header className="flex items-end gap-4 flex-wrap mb-5" data-testid={testId}>
    <div className="flex-1 min-w-0">
      {eyebrow && (
        <p className="font-mono text-[11px] tracking-[.12em] uppercase text-ink-3 mb-1.5 truncate">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display font-extrabold uppercase leading-[.9] text-ink-1 text-[46px] md:text-[50px]">
        {title}
        {count !== undefined && (
          <span className="font-mono font-medium text-[15px] text-ink-3 ml-2.5 align-middle normal-case">
            {count}
          </span>
        )}
      </h1>
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </header>
)
