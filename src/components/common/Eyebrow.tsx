/**
 * Eyebrow — small uppercase mono section label (mobile-redesign-port).
 *
 * Used above cards / sections as a quiet caption. Renders in JetBrains Mono
 * (font-mono) per the design system, letter-spaced, in the --ink-4 tone.
 */

import React from 'react'

export interface EyebrowProps {
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export const Eyebrow: React.FC<EyebrowProps> = ({
  children,
  className = '',
  'data-testid': testId,
}) => (
  <div
    className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-4 ${className}`}
    data-testid={testId}
  >
    {children}
  </div>
)
