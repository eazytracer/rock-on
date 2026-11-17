/**
 * Sort direction, shared by the list sort controls: what a field sorts by
 * decides its natural first direction and how the toggle names it.
 */
export type SortDir = 'asc' | 'desc'

/** text: A–Z; date: newest first; upcoming: soonest first. */
export type SortKind = 'text' | 'date' | 'upcoming'

/** The direction a field starts in when picked. */
export const defaultDir = (kind: SortKind): SortDir =>
  kind === 'date' ? 'desc' : 'asc'

/** What the direction toggle says: A–Z / Z–A, Newest / Oldest, Soonest / Latest. */
export function dirLabel(kind: SortKind, dir: SortDir): string {
  if (kind === 'date') return dir === 'desc' ? 'Newest' : 'Oldest'
  if (kind === 'upcoming') return dir === 'asc' ? 'Soonest' : 'Latest'
  return dir === 'asc' ? 'A–Z' : 'Z–A'
}

export const flipDir = (dir: SortDir): SortDir =>
  dir === 'asc' ? 'desc' : 'asc'
