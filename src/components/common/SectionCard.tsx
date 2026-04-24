/**
 * SectionCard — unified container for the recurring "dark card with section
 * heading" pattern seen across SetlistView / ShowView / PracticeView and
 * other detail pages.
 *
 * Replaces the hand-rolled:
 *   <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
 *     <h2 className="text-lg font-semibold text-white mb-4">Title</h2>
 *     {...}
 *   </div>
 *
 * With:
 *   <SectionCard title="Title">{...}</SectionCard>
 */

import React from 'react'

export interface SectionCardProps {
  /** Optional section heading rendered at the top. */
  title?: string
  /** Optional right-aligned actions slot next to the title (e.g. buttons). */
  actions?: React.ReactNode
  /** Optional helper text rendered below the title and above content. */
  description?: string
  /** Extra class names merged into the outer card element. */
  className?: string
  /** data-testid passthrough for E2E tests. */
  'data-testid'?: string
  children: React.ReactNode
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  actions,
  description,
  className = '',
  'data-testid': testId,
  children,
}) => {
  return (
    <div
      className={`bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6 ${className}`}
      data-testid={testId}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && (
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {description && (
        <p className="text-sm text-[#707070] mb-4">{description}</p>
      )}
      {children}
    </div>
  )
}

export default SectionCard
