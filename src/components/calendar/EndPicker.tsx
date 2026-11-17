/**
 * A practice's End: a list starting after Start, each choice with its length
 * ("9:00 PM (2 hrs)"); the value is the duration in minutes.
 */
import React, { useMemo, useState } from 'react'
import { Check, ChevronDown, Clock } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useResponsive'
import { Sheet } from '../ui'
import { endOptions } from '../../domain/calendar'

export const EndPicker: React.FC<{
  start: Date
  minutes: number
  onChange: (m: number) => void
  className: string
}> = ({ start, minutes, onChange, className }) => {
  const [at, setAt] = useState<{ x: number; y: number } | null | false>(false)
  const desktop = useMediaQuery('(min-width: 768px)')
  const options = useMemo(() => endOptions(start), [start])
  const current = options.find(o => o.minutes === minutes)
  return (
    <>
      <button
        type="button"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect()
          setAt(desktop ? { x: r.left, y: r.bottom + 6 } : null)
        }}
        className={className + ' flex items-center gap-2 text-left'}
        data-testid="practice-end-input"
        id="practice-end"
      >
        <Clock size={16} className="text-ink-3 shrink-0" />
        <span className="flex-1 truncate">
          {current ? (
            <>
              {current.label.replace(/ \(.*/, '')}{' '}
              <em className="not-italic text-ink-3">
                {current.label.match(/\(.*\)/)?.[0]}
              </em>
            </>
          ) : (
            `${minutes} min`
          )}
        </span>
        <ChevronDown size={16} className="text-ink-3" />
      </button>
      {at !== false && (
        <Sheet
          onClose={() => setAt(false)}
          at={at}
          title="Ends"
          width={260}
          data-testid="practice-end-sheet"
        >
          <div
            className="max-h-[50vh] overflow-y-auto custom-scrollbar-thin pb-1"
            ref={el =>
              el
                ?.querySelector('[aria-selected="true"]')
                ?.scrollIntoView({ block: 'center' })
            }
          >
            {options.map(o => (
              <button
                key={o.minutes}
                type="button"
                role="option"
                aria-selected={o.minutes === minutes}
                onClick={() => {
                  onChange(o.minutes)
                  setAt(false)
                }}
                className={`flex items-center w-full px-4 h-10 text-left text-[14.5px] hover:bg-bg-3 ${
                  o.minutes === minutes
                    ? 'text-accent-ink font-semibold'
                    : 'text-ink-1'
                }`}
                data-testid={`practice-end-option-${o.minutes}`}
              >
                {o.label}
                {o.minutes === minutes && (
                  <Check size={15} className="ml-auto" />
                )}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}
