/** Band invite helpers (decision 10: codes last 24 h; links are /j/CODE). */

export const inviteLink = (code: string, origin = window.location.origin) =>
  `${origin}/j/${code}`

/** A code, or a pasted link ending in /j/CODE → CODE. */
export const parseInviteCode = (raw: string) =>
  (raw.trim().match(/\/j\/([^/?#\s]+)/)?.[1] ?? raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

/** "Expires in 23 h" / "Expires in 40 min"; null once expired. */
export function expiresIn(expiresAt: string | null, now: number) {
  if (!expiresAt) return 'No expiry'
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return null
  const min = Math.ceil(ms / 60_000)
  return min >= 60
    ? `Expires in ${Math.floor(min / 60)} h`
    : `Expires in ${min} min`
}
