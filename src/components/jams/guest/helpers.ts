/**
 * Copy, links and small rules shared by the guest, TV and kiosk screens.
 */
import { ApiError } from '../../../services/api/errors'
import { normalizeCode } from '../../../hooks/useJam'
import { formatShowDate, formatTime12Hour } from '../../../utils/dateHelpers'

export const INVALID_CODE = "That code isn't valid."
export const INVITE_ONLY = 'This jam is invite only.'
export const JAM_ENDED = 'That jam has ended. Thanks for playing.'

/** Refusal keys that mean "this code doesn't work", not "try again". */
export const isRefusal = (err: unknown) =>
  err instanceof ApiError &&
  ['no_jam', 'invite_only', 'invite_invalid', 'not_found'].includes(err.key)

export const isEnded = (status?: string | null) =>
  status === 'completed' || status === 'cancelled'

/** "Tonight 8:00 PM" / "Dec 8, 2025 8:00 PM"; null when live. */
export function whenText(
  status: string | null | undefined,
  at: string | null | undefined
) {
  if (status === 'live') return null
  if (!at) return ''
  const d = new Date(at)
  const today = d.toDateString() === new Date().toDateString()
  return `${today ? 'Tonight' : formatShowDate(d)} ${formatTime12Hour(d)}`
}

export const tvPath = (code: string) => `/j/${normalizeCode(code)}/tv`

/** The counter iPad's pairing link: the token rides in the hash only. */
export const kioskLink = (
  token: string,
  eventId: string,
  origin = window.location.origin
) => `${origin}/kiosk#k=${encodeURIComponent(token)}&e=${eventId}`
