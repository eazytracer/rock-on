/**
 * Display formatting shared by every screen (no I/O; ports to Dart line for
 * line — docs/redesign/08-api-conventions.md).
 */

/** 258 → "4:18" */
export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Splits text around case-insensitive matches of `query` for highlighting. */
export function splitMatch(
  text: string,
  query: string
): { text: string; match: boolean }[] {
  const q = query.trim()
  if (!q) return [{ text, match: false }]
  const parts: { text: string; match: boolean }[] = []
  const lower = text.toLowerCase()
  const lq = q.toLowerCase()
  let i = 0
  while (i < text.length) {
    const at = lower.indexOf(lq, i)
    if (at === -1) {
      parts.push({ text: text.slice(i), match: false })
      break
    }
    if (at > i) parts.push({ text: text.slice(i, at), match: false })
    parts.push({ text: text.slice(at, at + q.length), match: true })
    i = at + q.length
  }
  return parts
}
