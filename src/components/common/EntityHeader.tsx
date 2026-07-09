import React from 'react'
import { Calendar, PartyPopper, Ticket, ListMusic } from 'lucide-react'
import { BackLink } from './BackLink'
import { InlineEditableField } from './InlineEditableField'
import { ScheduleMetaRow } from './ScheduleMetaRow'
import {
  InlineStatusBadge,
  SHOW_STATUS_OPTIONS,
  PRACTICE_STATUS_OPTIONS,
  SETLIST_STATUS_OPTIONS,
} from './InlineStatusBadge'

type EntityType = 'show' | 'practice' | 'setlist' | 'event'

// Entity type icons for visual flair (matches sidebar navigation)
const ENTITY_ICONS = {
  show: Ticket,
  practice: Calendar,
  setlist: ListMusic,
  event: PartyPopper,
} as const

interface StatusConfig {
  value: string
  onSave: (value: string) => void | Promise<void>
  options?: typeof SHOW_STATUS_OPTIONS
  disabled?: boolean
}

interface EntityHeaderProps {
  // Navigation
  backPath: string
  backLabel?: string // e.g., "Shows" → renders "Back to Shows"

  // Title - can be editable or static
  title: string
  onTitleSave?: (value: string | number) => void | Promise<void>
  titlePlaceholder?: string
  titleEditable?: boolean

  // Subtitle / entity type indicator
  entityType: EntityType

  // Date & Time (optional, for shows/practices)
  date?: string
  time?: string
  onDateSave?: (value: string | number) => void | Promise<void>
  onTimeSave?: (value: string | number) => void | Promise<void>
  dateLabel?: string // e.g., "Dec 15, 2025"
  timeLabel?: string // e.g., "8:00 PM"

  // Optional end time — renders as a start–end range (events)
  endTime?: string
  endTimeLabel?: string
  onEndTimeSave?: (value: string | number) => void | Promise<void>

  // Location/Venue (optional)
  venue?: string
  location?: string
  onVenueSave?: (value: string | number) => void | Promise<void>
  venuePlaceholder?: string
  venueTestId?: string

  // Duration (optional, for shows/practices)
  duration?: number // in minutes
  durationLabel?: string // e.g., "2 hours" or "45 min"
  onDurationSave?: (value: string | number) => void | Promise<void>

  // Status
  status?: StatusConfig

  // Test ID
  'data-testid'?: string
}

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  backPath,
  backLabel,
  title,
  onTitleSave,
  titlePlaceholder = 'Enter name',
  titleEditable = true,
  entityType,
  date,
  time,
  onDateSave,
  onTimeSave,
  dateLabel,
  timeLabel,
  endTime,
  endTimeLabel,
  onEndTimeSave,
  venue,
  location,
  onVenueSave,
  venuePlaceholder,
  venueTestId,
  duration,
  durationLabel,
  onDurationSave,
  status,
  'data-testid': testId = 'entity-header',
}) => {
  // Get status options based on entity type
  const getStatusOptions = () => {
    if (status?.options) return status.options
    switch (entityType) {
      case 'show':
        return SHOW_STATUS_OPTIONS
      case 'practice':
        return PRACTICE_STATUS_OPTIONS
      case 'setlist':
        return SETLIST_STATUS_OPTIONS
      case 'event':
        return SHOW_STATUS_OPTIONS
      default:
        return SHOW_STATUS_OPTIONS
    }
  }

  // Get entity icon
  const EntityIcon = ENTITY_ICONS[entityType]

  return (
    <div
      className="sticky top-0 z-10 bg-bg-0 border-b border-border-1"
      data-testid={testId}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        {/* Row 0: Back link on its own line above the title */}
        <BackLink
          to={backPath}
          label={backLabel}
          className="mb-2"
          data-testid={`${testId}-back-button`}
        />

        {/* Row 1: Icon + Title + Status */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Entity icon */}
            <EntityIcon size={20} className="text-accent flex-shrink-0" />

            {/* Title */}
            <div className="min-w-0 flex-1">
              {titleEditable && onTitleSave ? (
                <InlineEditableField
                  value={title}
                  onSave={onTitleSave}
                  type="title"
                  placeholder={titlePlaceholder}
                  required
                  name="name"
                  data-testid={`${testId}-name`}
                />
              ) : (
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                  {title}
                </h1>
              )}
            </div>
          </div>

          {/* Status badge - right side of row 1 */}
          {status && (
            <InlineStatusBadge
              value={status.value}
              options={getStatusOptions()}
              onSave={status.onSave}
              disabled={status.disabled}
              data-testid={`${testId}-status`}
            />
          )}
        </div>

        {/* Row 2: Metadata - date, time, (end-time), venue, duration */}
        <ScheduleMetaRow
          className="pl-12"
          date={date}
          dateLabel={dateLabel}
          onDateSave={onDateSave}
          time={time}
          timeLabel={timeLabel}
          onTimeSave={onTimeSave}
          endTime={endTime}
          endTimeLabel={endTimeLabel}
          onEndTimeSave={onEndTimeSave}
          venue={venue}
          location={location}
          onVenueSave={onVenueSave}
          venuePlaceholder={venuePlaceholder}
          venueTestId={venueTestId}
          duration={duration}
          durationLabel={durationLabel}
          onDurationSave={onDurationSave}
          testId={testId}
        />
      </div>
    </div>
  )
}
