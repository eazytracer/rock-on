/**
 * Setlist display maths (no I/O; ports to Dart line for line).
 */
interface ItemLike {
  type: 'song' | 'break' | 'section'
  songId?: string
  breakDuration?: number // minutes
}

/** Song count and total length in seconds (songs + breaks). */
export function setlistStats(
  items: ItemLike[],
  songSeconds: (songId: string) => number | undefined
): { songCount: number; seconds: number } {
  let songCount = 0
  let seconds = 0
  for (const it of items) {
    if (it.type === 'song') {
      songCount++
      seconds += (it.songId && songSeconds(it.songId)) || 0
    } else if (it.type === 'break') {
      seconds += (it.breakDuration ?? 0) * 60
    }
  }
  return { songCount, seconds }
}
