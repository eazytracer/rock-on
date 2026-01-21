/**
 * Feature Flags
 *
 * Control runtime behavior with feature flags. These can be toggled
 * without code changes via environment variables or localStorage.
 *
 * Usage:
 *   import { FEATURE_FLAGS } from '@/config/featureFlags'
 *
 *   if (FEATURE_FLAGS.SYNC_USE_AUDIT_LOG) {
 *     // Use new audit-log based sync
 *   }
 */

/**
 * Check if a feature flag is enabled.
 * Priority: localStorage override > environment variable > default value
 */
function isEnabled(
  envKey: string,
  localStorageKey: string,
  defaultValue: boolean
): boolean {
  // Check localStorage for runtime override (only in browser)
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(localStorageKey)
    if (override !== null) {
      return override === 'true'
    }
  }

  // Check environment variable
  const envValue = import.meta.env[envKey]
  if (envValue !== undefined) {
    return envValue === 'true'
  }

  return defaultValue
}

/**
 * Feature Flags Configuration
 *
 * Add new flags here with:
 * - VITE_* env var name
 * - localStorage key (for runtime toggling)
 * - Default value
 */
export const FEATURE_FLAGS = {
  /**
   * Use audit_log table for incremental sync instead of per-table
   * timestamp comparisons.
   *
   * Benefits:
   * - Fixes the bug where song updates don't sync (createdDate comparison)
   * - Handles deletes properly
   * - Single query instead of 4 separate queries
   * - Chronological replay ensures correct ordering
   *
   * Default: true (enabled)
   * Override: localStorage.setItem('SYNC_USE_AUDIT_LOG', 'false')
   */
  SYNC_USE_AUDIT_LOG: isEnabled(
    'VITE_SYNC_USE_AUDIT_LOG',
    'SYNC_USE_AUDIT_LOG',
    true // Enabled by default - this is the bugfix
  ),
} as const

// Log feature flags in development
if (typeof window !== 'undefined' && import.meta.env.MODE === 'development') {
  console.log('🚩 Feature Flags:', FEATURE_FLAGS)
}
