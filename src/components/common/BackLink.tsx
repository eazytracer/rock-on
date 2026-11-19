import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoBack } from '../../hooks/useGoBack'
import { BackCrumb } from '../layout/MobileHeader'

interface BackLinkProps {
  /** Destination to fall back to when there's no in-app history. History-aware. */
  to?: string
  /** Names the destination: "‹ {label}". Omit for a generic "‹ Back". */
  label?: string
  className?: string
  'data-testid'?: string
}

/**
 * A history-aware `BackCrumb` (in the app bar on phones). When `to` is
 * provided it returns to the real referrer, falling back to `to`; otherwise
 * it pops one history entry via navigate(-1).
 */
export const BackLink: React.FC<BackLinkProps> = ({
  to,
  label,
  className,
  'data-testid': testId = 'back-link',
}) => {
  const navigate = useNavigate()
  const goBack = useGoBack(to)
  return (
    <BackCrumb
      label={label ?? 'Back'}
      onClick={() => (to ? goBack() : navigate(-1))}
      className={className}
      data-testid={testId}
    />
  )
}
