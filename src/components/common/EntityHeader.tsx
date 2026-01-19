import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Building2,
  Ticket,
  ListMusic,
  Timer,
} from 'lucide-react'
import { InlineEditableField } from './InlineEditableField'
import {
  InlineStatusBadge,
  SHOW_STATUS_OPTIONS,
  PRACTICE_STATUS_OPTIONS,
  SETLIST_STATUS_OPTIONS,
} from './InlineStatusBadge'

type EntityType = 'show' | 'practice' | 'setlist'

// Entity type icons for visual flair (matches sidebar navigation)
const ENTITY_ICONS = {
  show: Ticket,
  practice: Calendar,
  setlist: ListMusic,
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

  // Location/Venue (optional)
  venue?: string
  location?: string
  onVenueSave?: (value: string | number) => void | Promise<void>

  // Duration (optional, for shows/practices)
  duration?: number // in minutes
  durationLabel?: string // e.g., "2 hours" or "45 min"
  onDurationSave?: (value: string | number) => void | Promise<void>

  // Status
  status?: StatusConfig

  // New mode flag (for future use)
  isNew?: boolean

  // Test ID
  'data-testid'?: string
}

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  backPath,
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
  venue,
  location,
  onVenueSave,
  duration,
  durationLabel,
  onDurationSave,
  status,
  isNew,
  'data-testid': testId = 'entity-header',
}) => {
  const navigate = useNavigate()

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
      default:
        return SHOW_STATUS_OPTIONS
    }
  }

  // Handle back navigation
  const handleBack = () => {
    navigate(backPath)
  }

  // Format location display
  const locationDisplay = [venue, location].filter(Boolean).join(', ')

  // Get entity icon
  const EntityIcon = ENTITY_ICONS[entityType]

  // Check if we have any metadata to show
  const hasMetadata =
    date ||
    dateLabel ||
    time ||
    timeLabel ||
    venue ||
    location ||
    duration ||
    durationLabel

  return (
    <div
      className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#2a2a2a]"
      data-testid={testId}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        {/* Row 1: Back + Icon + Title + Status */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="p-2 text-[#a0a0a0] hover:text-white hover:bg-[#252525] rounded-lg transition-colors flex-shrink-0"
              data-testid={`${testId}-back-button`}
            >
              <ArrowLeft size={20} />
            </button>

            {/* Entity icon */}
            <EntityIcon size={20} className="text-[#f17827ff] flex-shrink-0" />

            {/* Title */}
            <div className="min-w-0 flex-1">
              {titleEditable && onTitleSave ? (
                <InlineEditableField
                  value={title}
                  onSave={onTitleSave}
                  type="title"
                  placeholder={titlePlaceholder}
                  required
                  autoEdit={isNew}
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

        {/* Row 2: Metadata - date, time, venue, duration */}
        {hasMetadata && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pl-12">
            {/* Date */}
            {(date || dateLabel) && (
              <div className="flex items-center gap-1.5">
                <Calendar size={16} className="text-[#f17827ff]" />
                {onDateSave && date ? (
                  <InlineEditableField
                    value={date}
                    displayValue={dateLabel}
                    onSave={onDateSave}
                    type="date"
                    autoEdit={isNew}
                    name="date"
                    data-testid={`${testId}-date`}
                  />
                ) : (
                  <span className="text-white">{dateLabel || date}</span>
                )}
              </div>
            )}

            {/* Separator */}
            {(date || dateLabel) && (time || timeLabel) && (
              <span className="text-[#3a3a3a]">•</span>
            )}

            {/* Time */}
            {(time || timeLabel) && (
              <div className="flex items-center gap-1.5">
                <Clock size={16} className="text-[#f17827ff]" />
                {onTimeSave && time ? (
                  <InlineEditableField
                    value={time}
                    displayValue={timeLabel}
                    onSave={onTimeSave}
                    type="time"
                    data-testid={`${testId}-time`}
                  />
                ) : (
                  <span className="text-white">{timeLabel || time}</span>
                )}
              </div>
            )}

            {/* Venue */}
            {(venue || location) && (
              <>
                <span className="text-[#3a3a3a]">•</span>
                <div className="flex items-center gap-1.5">
                  <Building2 size={16} className="text-[#f17827ff]" />
                  {onVenueSave ? (
                    <InlineEditableField
                      value={venue || ''}
                      displayValue={locationDisplay || undefined}
                      onSave={onVenueSave}
                      placeholder="Add venue"
                      autoEdit={isNew}
                      name="venue"
                      data-testid={`${testId}-venue`}
                    />
                  ) : (
                    <span className="text-white">{locationDisplay}</span>
                  )}
                </div>
              </>
            )}

            {/* Duration */}
            {(duration !== undefined || durationLabel) && (
              <>
                <span className="text-[#3a3a3a]">•</span>
                <div className="flex items-center gap-1.5">
                  <Timer size={16} className="text-[#f17827ff]" />
                  {onDurationSave && duration !== undefined ? (
                    <InlineEditableField
                      value={duration}
                      displayValue={durationLabel}
                      onSave={onDurationSave}
                      type="duration"
                      placeholder="Duration"
                      data-testid={`${testId}-duration`}
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
        )}
      </div>
    </div>
  )
}
