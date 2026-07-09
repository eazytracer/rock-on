import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGoBack } from '../../hooks/useGoBack'

interface BackLinkProps {
  /** Destination to fall back to when there's no in-app history. History-aware. */
  to?: string
  /** Names the destination: renders "Back to {label}". Omit for a generic "Back". */
  label?: string
  className?: string
  'data-testid'?: string
}

/**
 * Standard back affordance: a simple (unboxed) arrow on its own line, meant to
 * sit above a page/entity header. When `to` is provided the navigation is
 * history-aware (returns to the real referrer, falling back to `to`); otherwise
 * it pops one history entry via navigate(-1).
 */
export const BackLink: React.FC<BackLinkProps> = ({
  to,
  label,
  className = '',
  'data-testid': testId = 'back-link',
}) => {
  const navigate = useNavigate()
  const goBack = useGoBack(to)
  const handleClick = () => {
    if (to) {
      goBack()
    } else {
      navigate(-1)
    }
  }

  return (
    <button
      onClick={handleClick}
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink-1 transition-colors ${className}`}
    >
      <ArrowLeft size={16} /> Back{label ? ` to ${label}` : ''}
    </button>
  )
}
