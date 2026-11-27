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
