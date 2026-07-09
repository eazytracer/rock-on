import React from 'react'
import { Calendar, Clock, MapPin, Timer } from 'lucide-react'
import { InlineEditableField } from './InlineEditableField'

/**
 * ScheduleMetaRow — the shared "date · time · (end-time) · venue · duration" row.
 *
 * Field-name-agnostic: every field is a value + an optional `onXSave`. A field
 * renders as an inline `InlineEditableField` when its `onXSave` is supplied (and,
 * for date/time, a value is present); otherwise it renders as a static span. This
 * mirrors the metadata block that used to live inline in `EntityHeader`, so
 * Shows/Practices/Setlists output is unchanged.
 *
 * Adds an optional end-time — when `endTime`/`onEndTimeSave` is supplied it renders
 * as a `time – endTime` range. Location icon is standardized to `MapPin`.
 */
interface ScheduleMetaRowProps {
  // Date
  date?: string
  dateLabel?: string
  onDateSave?: (value: string | number) => void | Promise<void>

  // Start time
  time?: string
  timeLabel?: string
  onTimeSave?: (value: string | number) => void | Promise<void>

  // End time (renders as a start–end range when present)
  endTime?: string
  endTimeLabel?: string
  onEndTimeSave?: (value: string | number) => void | Promise<void>

  // Venue / location
  venue?: string
  location?: string
  onVenueSave?: (value: string | number) => void | Promise<void>
  // Placeholder shown when the venue/location field is editable but empty.
  venuePlaceholder?: string
  // Overrides the venue field's testid (default `${testId}-venue`), so callers
  // can label it semantically (e.g. `practice-location`).
  venueTestId?: string

  // Duration (in minutes)
  duration?: number
  durationLabel?: string
  onDurationSave?: (value: string | number) => void | Promise<void>

  // Styling for the outer flex row (e.g. alignment padding from the parent)
  className?: string

  // Test ID root — fields expose `${testId}-date/-time/-end-time/-venue/-duration`
  testId?: string
}

export const ScheduleMetaRow: React.FC<ScheduleMetaRowProps> = ({
  date,
  dateLabel,
  onDateSave,
  time,
  timeLabel,
  onTimeSave,
  endTime,
  endTimeLabel,
  onEndTimeSave,
  venue,
  location,
  onVenueSave,
  venuePlaceholder = 'Add venue',
  venueTestId,
  duration,
  durationLabel,
  onDurationSave,
  className = '',
  testId,
}) => {
  const locationDisplay = [venue, location].filter(Boolean).join(', ')

  const hasDate = !!(date || dateLabel)
  const hasTime = !!(time || timeLabel)
  const hasEndTime = !!(endTime || endTimeLabel || onEndTimeSave)
  // Render the venue/location field whenever it is editable, even when empty —
  // otherwise an empty value can never be filled (no affordance to click).
  const hasVenue = !!(venue || location || onVenueSave)
  const hasDuration = duration !== undefined || durationLabel !== undefined

  if (!hasDate && !hasTime && !hasVenue && !hasDuration) return null

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${className}`}
    >
      {/* Date */}
      {hasDate && (
        <div className="flex items-center gap-1.5">
          <Calendar size={16} className="text-accent" />
          {onDateSave && date ? (
            <InlineEditableField
              value={date}
              displayValue={dateLabel}
              onSave={onDateSave}
              type="date"
              name="date"
              data-testid={testId ? `${testId}-date` : undefined}
            />
          ) : (
            <span className="text-white">{dateLabel || date}</span>
          )}
        </div>
      )}

      {/* Separator */}
      {hasDate && hasTime && <span className="text-ink-6">•</span>}

      {/* Time (+ optional end-time range) */}
      {hasTime && (
        <div className="flex items-center gap-1.5">
          <Clock size={16} className="text-accent" />
          {onTimeSave && time ? (
            <InlineEditableField
              value={time}
              displayValue={timeLabel}
              onSave={onTimeSave}
              type="time"
              data-testid={testId ? `${testId}-time` : undefined}
            />
          ) : (
            <span className="text-white">{timeLabel || time}</span>
          )}
          {hasEndTime && (
            <>
              <span className="text-ink-6">–</span>
              {onEndTimeSave ? (
                <InlineEditableField
                  value={endTime || ''}
                  displayValue={endTimeLabel}
                  onSave={onEndTimeSave}
                  type="time"
                  placeholder="Add end time"
                  data-testid={testId ? `${testId}-end-time` : undefined}
                />
              ) : (
                <span className="text-white">{endTimeLabel || endTime}</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Venue */}
      {hasVenue && (
        <>
          <span className="text-ink-6">•</span>
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-accent" />
            {onVenueSave ? (
              <InlineEditableField
                value={venue || ''}
                displayValue={locationDisplay || undefined}
                onSave={onVenueSave}
                placeholder={venuePlaceholder}
                name="venue"
                data-testid={
                  venueTestId ?? (testId ? `${testId}-venue` : undefined)
                }
              />
            ) : (
              <span className="text-white">{locationDisplay}</span>
            )}
          </div>
        </>
      )}

      {/* Duration */}
      {hasDuration && (
        <>
          <span className="text-ink-6">•</span>
          <div className="flex items-center gap-1.5">
            <Timer size={16} className="text-accent" />
            {onDurationSave && duration !== undefined ? (
              <InlineEditableField
                value={duration}
                displayValue={durationLabel}
                onSave={onDurationSave}
                type="duration"
                placeholder="Duration"
                data-testid={testId ? `${testId}-duration` : undefined}
              />
            ) : (
              <span className="text-white">
                {durationLabel || `${duration} min`}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
