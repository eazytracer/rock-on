import React from 'react'

interface ContentLoadingSpinnerProps {
  isLoading: boolean
  children: React.ReactNode
}

/**
 * ContentLoadingSpinner
 *
 * Shows a themed loading spinner in the content area only (not full screen).
 * Used inside page components to show loading state while data fetches.
 *
 * The spinner uses the same dark theme as ModernLayout (bg-[#0a0a0a])
 * and amber-500 spinner color for consistency.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useMyData()
 *
 * return (
 *   <ContentLoadingSpinner isLoading={isLoading}>
 *     <div data-testid="my-page">
 *       {data.map(item => ...)}
 *     </div>
 *   </ContentLoadingSpinner>
 * )
 * ```
 */
export const ContentLoadingSpinner: React.FC<ContentLoadingSpinnerProps> = ({
  isLoading,
  children,
}) => {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-[#0a0a0a]"
        data-testid="content-loading-spinner"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
