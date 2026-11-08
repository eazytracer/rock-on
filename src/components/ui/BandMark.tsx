/**
 * Context mark (`r-ctx i`): a rounded tile with the band's initials, or the
 * user's initial for Personal. Bands use the band accent, Personal the indigo.
 */
import React from 'react'
import { markInitials } from '../../domain/marks'

interface BandMarkProps {
  name: string
  personal?: boolean
  size?: number
  className?: string
}

export const BandMark: React.FC<BandMarkProps> = ({
  name,
  personal = false,
  size = 28,
  className = '',
}) => (
  <span
    aria-hidden
    className={`grid place-items-center shrink-0 font-extrabold ${
      personal ? 'bg-[#7c86f5] text-[#0b0d2b]' : 'bg-[#ff7a1a] text-[#1a0c02]'
    } ${className}`}
    style={{
      width: size,
      height: size,
      borderRadius: Math.round(size / 3.1),
      fontSize: Math.max(10, Math.round(size * 0.4)),
    }}
  >
    {personal ? name.trim().charAt(0).toUpperCase() : markInitials(name)}
  </span>
)
