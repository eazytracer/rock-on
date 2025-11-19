/**
 * Utility functions for data formatting
 */

/**
 * Convert duration string like "3:14" to total seconds (194)
 */
export function durationToSeconds(duration: string): number {
  const parts = duration.split(':')

  if (parts.length === 2) {
    // Format: MM:SS
    const minutes = parseInt(parts[0], 10)
    const seconds = parseInt(parts[1], 10)
    return minutes * 60 + seconds
  } else if (parts.length === 3) {
    // Format: HH:MM:SS
    const hours = parseInt(parts[0], 10)
    const minutes = parseInt(parts[1], 10)
    const seconds = parseInt(parts[2], 10)
    return hours * 3600 + minutes * 60 + seconds
  }

  // If format is invalid, return 0
  return 0
}

/**
 * Convert seconds (194) to duration string "3:14"
 */
export function secondsToDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    // Format: H:MM:SS
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    // Format: M:SS
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
}

/**
 * Convert cents (50000) to dollar string "$500.00"
 */
export function centsToDollars(cents: number): string {
  if (!cents || cents < 0) return '$0.00'

  const dollars = cents / 100
  return `$${dollars.toFixed(2)}`
}

/**
 * Convert dollar string "$500" or "500" to cents (50000)
 */
export function dollarsToCents(dollars: string): number {
  if (!dollars) return 0

  // Remove currency symbols and whitespace
  const cleaned = dollars.replace(/[$,\s]/g, '')

  // Parse as float
  const amount = parseFloat(cleaned)

  if (isNaN(amount)) return 0

  // Convert to cents
  return Math.round(amount * 100)
}

/**
 * Format BPM for display
 */
export function formatBpm(bpm: number | undefined): string {
  if (!bpm) return ''
  return `${bpm} bpm`
}

/**
 * Parse BPM from string like "104 bpm" or "104"
 */
export function parseBpm(bpmString: string): number {
  if (!bpmString) return 0

  // Remove "bpm" and whitespace, parse as integer
  const cleaned = bpmString.replace(/[^\d]/g, '')
  const bpm = parseInt(cleaned, 10)

  return isNaN(bpm) ? 0 : bpm
}
