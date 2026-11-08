/**
 * Event type label (`r-ty`): icon + word + colour, never colour alone.
 */
import React from 'react'
import { Ticket, CalendarDays, PartyPopper } from 'lucide-react'

export type EventType = 'show' | 'practice' | 'jam'

const TYPES: Record<
  EventType,
  { word: string; icon: React.ElementType; className: string }
> = {
  show: { word: 'Show', icon: Ticket, className: 'text-type-show' },
  practice: {
    word: 'Practice',
    icon: CalendarDays,
    className: 'text-type-practice',
  },
  jam: { word: 'Jam', icon: PartyPopper, className: 'text-type-jam' },
}

export const TypeLabel: React.FC<{ type: EventType }> = ({ type }) => {
  const t = TYPES[type]
  const Icon = t.icon
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] ${t.className}`}
      data-testid={`type-label-${type}`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {t.word}
    </span>
  )
}
