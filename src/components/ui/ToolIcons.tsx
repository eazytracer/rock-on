/**
 * The kit's tool glyphs (design/source/kit/rock.js `metro`, `chordbox`); the
 * tuning fork lives with the setlist stats (`ForkIcon`).
 */
import React from 'react'

interface IconProps {
  size?: number
  className?: string
}

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 20,
  className = '',
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
)

export const MetroIcon: React.FC<IconProps> = props => (
  <Svg {...props}>
    <path d="M9 3h6l4 18H5z" />
    <path d="M12 17 16.5 6.5" />
    <path d="M7.5 14h9" />
  </Svg>
)

export const ChordBoxIcon: React.FC<IconProps> = props => (
  <Svg {...props}>
    <rect x="5" y="3.5" width="14" height="17" rx="2" />
    <path d="M5 8.5h14M5 13h14M9.7 3.5v17M14.3 3.5v17" />
  </Svg>
)
