/**
 * The jam's kicker + title on the join, web guest and kiosk screens:
 * "JAM · TONIGHT 8 PM · LUCKY'S" (LIVE when live), then the name.
 */
import React from 'react'
import { TypeLabel } from '../../ui'
import { whenText } from './helpers'

export const LiveMark: React.FC = () => (
  <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-[.12em] uppercase text-danger">
    <i className="w-2 h-2 rounded-full bg-danger animate-pulse" />
    Live
  </span>
)

export const JamHeader: React.FC<{
  name: string
  status?: string | null
  at?: string | null
  venue?: string | null
  className?: string
}> = ({ name, status, at, venue, className = '' }) => {
  const when = whenText(status, at)
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3">
        {status === 'live' ? <LiveMark /> : <TypeLabel type="jam" />}
        {when && <span>· {when}</span>}
        {venue && <span className="truncate">· {venue}</span>}
      </div>
      <h1
        className="font-display font-extrabold uppercase text-[40px] leading-[.92] text-ink-1 mt-1.5"
        data-testid="jam-preview-name"
      >
        {name}
      </h1>
    </div>
  )
}
