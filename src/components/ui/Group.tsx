/**
 * Kit group (`r-grp` + `r-gl`): one surface per section, rows divided by 1 px,
 * a mono label above with an optional trailing action.
 */
import React from 'react'

export interface GroupProps {
  label?: string
  action?: { label: string; onClick: () => void; 'data-testid'?: string }
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export const Group: React.FC<GroupProps> = ({
  label,
  action,
  children,
  className = '',
  'data-testid': testId,
}) => (
  <section className={className} data-testid={testId}>
    {label && (
      <div className="flex items-center px-6 pt-3 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3">
        {label}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            data-testid={action['data-testid']}
            className="ml-auto text-accent-ink tracking-[.06em]"
          >
            {action.label}
          </button>
        )}
      </div>
    )}
    <div className="mx-3 mb-2.5 rounded-[20px] overflow-hidden bg-bg-2 shadow-group divide-y divide-divider">
      {children}
    </div>
  </section>
)

/** Kit list row (`r-item`): lead, title, sub, trail. */
export const ListRow: React.FC<{
  lead?: React.ReactNode
  title: React.ReactNode
  sub?: React.ReactNode
  trail?: React.ReactNode
  onClick?: () => void
  'data-testid'?: string
}> = ({ lead, title, sub, trail, onClick, 'data-testid': testId }) => {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      className="flex items-center gap-3 w-full min-h-14 py-2 pl-4 pr-2.5 text-left"
    >
      {lead}
      <span className="flex-1 min-w-0">
        <b className="block text-[15px] font-semibold text-ink-1">{title}</b>
        {sub && (
          <small className="block text-[12.5px] text-ink-3 truncate">
            {sub}
          </small>
        )}
      </span>
      {trail && (
        <span className="grid place-items-center w-11 h-11 text-ink-4 shrink-0">
          {trail}
        </span>
      )}
    </Tag>
  )
}
