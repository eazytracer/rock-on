import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ViewPageHeaderProps {
  title: string
  backPath: string
  subtitle?: string
  isNew?: boolean
  actions?: React.ReactNode
}

/**
 * Simplified header for view pages.
 * Does NOT manage edit state - that's handled by MetadataCard.
 * Use the `actions` slot for delete, share, or other action buttons.
 *
 * Note: On mobile, the back button is hidden because ModernLayout's
 * MobileHeader provides hamburger menu navigation instead.
 */
export const ViewPageHeader: React.FC<ViewPageHeaderProps> = ({
  title,
  backPath,
  subtitle,
  isNew = false,
  actions,
}) => {
  const navigate = useNavigate()

  return (
    <div className="sticky top-0 z-10 bg-bg-0 border-b border-border-1">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Back button - hidden on mobile, shown on desktop */}
            <button
              onClick={() => navigate(backPath)}
              className="hidden md:flex p-2 text-ink-3 hover:text-white hover:bg-bg-4 rounded-lg transition-colors"
              data-testid="view-back-button"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1
                  className="text-lg sm:text-xl font-bold text-white truncate"
                  data-testid="view-page-title"
                >
                  {title}
                </h1>
                {isNew && (
                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded">
                    New
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-ink-4 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {actions && (
            <div
              className="flex items-center gap-2"
              data-testid="view-page-actions"
            >
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
