import type { LucideIcon } from 'lucide-react'

interface TabItem<T extends string = string> {
  value: T
  label: string
  icon?: LucideIcon
  /** Numeric badge shown on the tab */
  badge?: number
  /** When true, the icon pulses (used to indicate "computing") */
  badgeAnimate?: boolean
}

interface TabSwitcherProps<T extends string = string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
  'data-testid'?: string
}

/**
 * Pill-container tab switcher.
 *
 * Replaces hand-rolled implementations in SongsPage (Band/Personal) and
 * JamSessionPage (Common Songs/My Song Queue). Standardises on a single
 * active color (unified --accent orange) — the jam page previously used amber for
 * one tab and orange for another, which was inconsistent.
 */
export function TabSwitcher<T extends string = string>({
  tabs,
  value,
  onChange,
  size = 'md',
  className = '',
  'data-testid': testId,
}: TabSwitcherProps<T>) {
  const isSm = size === 'sm'
  const tabBase = `flex items-center gap-1.5 rounded-md font-medium transition-colors ${
    isSm ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
  }`
  const tabActive = 'bg-accent text-white'
  const tabInactive = 'text-ink-3 hover:text-white'

  return (
    <div
      className={`flex gap-1 bg-bg-2 rounded-lg p-1 ${className}`}
      data-testid={testId}
      role="tablist"
    >
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = tab.value === value

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`tab-${tab.value}`}
            onClick={() => onChange(tab.value)}
            className={`${tabBase} ${isActive ? tabActive : tabInactive}`}
          >
            {Icon && (
              <Icon
                size={12}
                className={
                  tab.badgeAnimate && isActive ? 'animate-pulse' : undefined
                }
              />
            )}
            {tab.label}
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-white/20 rounded-full text-xs tabular-nums">
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
