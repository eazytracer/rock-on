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
    <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#2a2a2a]">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Back button - hidden on mobile, shown on desktop */}
            <button
              onClick={() => navigate(backPath)}
              className="hidden md:flex p-2 text-[#a0a0a0] hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
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
                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-[#f17827ff]/20 text-[#f17827ff] rounded">
                    New
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-[#707070] truncate">{subtitle}</p>
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
