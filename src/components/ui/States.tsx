/**
 * List states (DECISIONS: every list has three): skeleton while loading,
 * empty with its action, error with Retry.
 */
import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

export const SkeletonRow: React.FC<{ lines?: number }> = ({ lines = 2 }) => (
  <div className="px-4 py-3 space-y-2" aria-hidden data-testid="skeleton-row">
    {Array.from({ length: lines }, (_, i) => (
      <span
        key={i}
        className="block h-3.5 rounded-md bg-gradient-to-r from-bg-3 via-bg-4 to-bg-3 bg-[length:200%_100%] animate-skeleton"
        style={{ width: i === 0 ? '62%' : '38%' }}
      />
    ))}
  </div>
)

export const RetryCard: React.FC<{
  message: string
  onRetry: () => void
}> = ({ message, onRetry }) => (
  <div
    role="alert"
    data-testid="retry-card"
    className="mx-3 mb-2.5 flex items-center gap-3 rounded-2xl bg-bg-3 px-4 py-3 text-sm text-ink-1"
  >
    <AlertTriangle className="w-[18px] h-[18px] text-warn shrink-0" />
    <span className="flex-1">{message}</span>
    <Button size="md" onClick={onRetry} data-testid="retry-button">
      Retry
    </Button>
  </div>
)

export const Empty: React.FC<{
  icon: React.ReactNode
  title: string
  why: string
  action?: React.ReactNode
  'data-testid'?: string
}> = ({ icon, title, why, action, 'data-testid': testId }) => (
  <div
    data-testid={testId}
    className="flex flex-col items-center text-center gap-2.5 px-8 py-12"
  >
    <div className="grid place-items-center w-16 h-16 rounded-[20px] bg-bg-3 text-ink-3">
      {icon}
    </div>
    <b className="text-lg text-ink-1">{title}</b>
    <p className="text-[14.5px] leading-snug text-ink-3 max-w-[280px]">{why}</p>
    {action}
  </div>
)
