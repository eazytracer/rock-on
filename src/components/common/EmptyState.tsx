import type { LucideIcon } from 'lucide-react'

interface EmptyStateAction {
  label: string
  onClick: () => void
  icon?: LucideIcon
  variant?: 'primary' | 'secondary'
  'data-testid'?: string
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  /** Controls padding and icon size */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CONFIG = {
  sm: { padding: 'py-8', gap: 'gap-2', iconSize: 24 },
  md: { padding: 'py-12', gap: 'gap-3', iconSize: 32 },
  lg: { padding: 'py-16', gap: 'gap-3', iconSize: 40 },
}

/**
 * Unified empty-state panel.
 *
 * Replaces 9+ inline icon+headline+subtext+CTA patterns across SongsPage,
 * SetlistsPage, ShowsPage, PracticesPage, JamSessionPage, and BrowseSongsDrawer.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const { padding, gap, iconSize } = SIZE_CONFIG[size]

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${padding} ${gap} ${className}`}
    >
      <Icon size={iconSize} className="text-[#404040]" />

      <p className="text-[#a0a0a0] text-sm font-medium">{title}</p>

      {description && (
        <p className="text-[#606060] text-xs max-w-xs">{description}</p>
      )}

      {action && (
        <ActionButton action={action} variant={action.variant ?? 'primary'} />
      )}

      {secondaryAction && (
        <ActionButton
          action={secondaryAction}
          variant={secondaryAction.variant ?? 'secondary'}
        />
      )}
    </div>
  )
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction
  variant: 'primary' | 'secondary'
}) {
  const Icon = action.icon
  const base =
    'mt-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5'
  const styles =
    variant === 'primary'
      ? `${base} bg-[#f17827ff]/10 text-[#f17827ff] hover:bg-[#f17827ff]/20`
      : `${base} text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a]`

  return (
    <button
      type="button"
      onClick={action.onClick}
      data-testid={action['data-testid']}
      className={styles}
    >
      {Icon && <Icon size={14} />}
      {action.label}
    </button>
  )
}
