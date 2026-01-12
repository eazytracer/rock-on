/**
 * Utility functions for date and time formatting
 */

/**
 * Format a date for display in show cards
 * Example: "Dec 8, 2025"
 */
export function formatShowDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (!d || isNaN(d.getTime())) return ''

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format a date with time for show details
 * Example: "Dec 8, 2025 at 8:00 PM"
 */
export function formatShowDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (!d || isNaN(d.getTime())) return ''

  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const timeStr = formatTime12Hour(d)

  return `${dateStr} at ${timeStr}`
}

/**
 * Format time in 12-hour format: "8:00 PM"
 */
export function formatTime12Hour(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (!d || isNaN(d.getTime())) return ''

  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Parse a time string like "8:00 PM" and combine with a date
 * Returns a new Date object
 */
export function parseTime12Hour(
  timeString: string,
  baseDate: Date = new Date()
): Date {
  if (!timeString) return baseDate

  // Extract hours, minutes, and AM/PM
  const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i)

  if (!match) return baseDate

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()

  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) {
    hours += 12
  } else if (period === 'AM' && hours === 12) {
    hours = 0
  }

  // Create new date with the specified time
  const result = new Date(baseDate)
  result.setHours(hours, minutes, 0, 0)

  return result
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d < new Date()
}

/**
 * Check if a date is upcoming (future)
 */
export function isUpcomingDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d >= new Date()
}

/**
 * Format a date for input fields (YYYY-MM-DD)
 *
 * IMPORTANT: Uses LOCAL timezone, not UTC!
 * Using toISOString().split('T')[0] causes off-by-one date bugs
 * because toISOString() converts to UTC first.
 *
 * Example: Dec 15 11pm EST becomes Dec 16 4am UTC, then displays as Dec 16
 */
export function formatDateForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (!d || isNaN(d.getTime())) return ''

  // Use LOCAL date components, NOT toISOString() which converts to UTC
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD date string as LOCAL time (midnight)
 *
 * IMPORTANT: new Date("2024-12-20") parses as UTC midnight, which becomes
 * Dec 19 in timezones west of UTC! This function parses as LOCAL midnight.
 *
 * Use this when parsing date input values before combining with time.
 */
export function parseDateAsLocal(dateString: string): Date {
  if (!dateString) return new Date()

  // Split the date string and create date with local timezone
  const [year, month, day] = dateString.split('-').map(Number)

  // Month is 0-indexed in JavaScript Date
  return new Date(year, month - 1, day)
}

// Alias for backwards compatibility with code using the longer name
export const parseDateInputAsLocal = parseDateAsLocal

/**
 * Format a datetime for input fields (YYYY-MM-DDTHH:mm)
 */
export function formatDateTimeForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (!d || isNaN(d.getTime())) return ''

  // Get local ISO string (not UTC)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Get relative time string like "2 days from now" or "3 weeks ago"
 */
export function getRelativeTimeString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`
  if (diffDays >= 7 && diffDays < 14) return 'Next week'
  if (diffDays >= 14 && diffDays < 30)
    return `In ${Math.floor(diffDays / 7)} weeks`
  if (diffDays <= -7 && diffDays > -14) return 'Last week'
  if (diffDays <= -14 && diffDays > -30)
    return `${Math.floor(Math.abs(diffDays) / 7)} weeks ago`
  if (diffDays >= 30) return `In ${Math.floor(diffDays / 30)} months`
  if (diffDays <= -30)
    return `${Math.floor(Math.abs(diffDays) / 30)} months ago`

  return formatShowDate(d)
}
