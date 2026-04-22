/**
 * Song avatar utilities — canonical source for avatar color + initials generation.
 *
 * Previously duplicated in SongListItem, BrowseSongsDrawer, SetlistsPage,
 * PracticeBuilderPage, and BandMembersPage. Import from here instead.
 */

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#14b8a6', // teal
  '#ef4444', // red
  '#6366f1', // indigo
  '#a855f7', // purple
  '#84cc16', // lime
  '#eab308', // yellow
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#d946ef', // fuchsia
  '#f97316', // orange
]

/** Returns a deterministic color for a given string (based on first char). */
export function generateAvatarColor(text: string): string {
  if (!text) return AVATAR_COLORS[0]
  const index = text.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

/** Returns up to 2 uppercase initials from a string. */
export function generateInitials(text: string): string {
  if (!text) return '?'
  const words = text.split(' ').filter(w => w.length > 0)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return text.substring(0, 2).toUpperCase()
}
