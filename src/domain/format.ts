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

/** "3:51" / "231" (seconds) → seconds; "" → 0; anything else → null. */
export function parseLength(text: string): number | null {
  const t = text.trim()
  if (!t) return 0
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(t)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  if (/^\d{1,4}$/.test(t)) return Number(t)
  return null
}

/** Key roots in pitch order, flats spelled ASCII (stored as typed). */
export const KEY_ROOTS = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
]
const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
}
/** Display a key with ♭ / ♯ glyphs. */
export const showKey = (k: string) =>
  k.replace(/^([A-G])b/, '$1♭').replace(/^([A-G])#/, '$1♯')
export const sameKey = (a: string, b: string) => {
  const norm = (k: string) => {
    const m = /^([A-G][#b]?)(m?)$/.exec(k.replace('♭', 'b').replace('♯', '#'))
    return m ? (SHARP_TO_FLAT[m[1]] ?? m[1]) + m[2] : k
  }
  return norm(a) === norm(b)
}
