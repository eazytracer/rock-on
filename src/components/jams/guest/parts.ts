/**
 * Part helpers for the guest, join and kiosk screens, over the shared ones in
 * components/jams/parts (identity, labels, profile instruments → parts).
 */
import type { Part } from '../../../services/api/jams'
import { PART_KEYS, distinctParts, partLabel } from '../parts'

export { partId, partLabel, samePart, partsFromInstruments } from '../parts'

/** "Bass, Harmonica"; "Just listening" for none. */
export const partsText = (parts: Part[]) =>
  parts.length ? parts.map(partLabel).join(', ') : 'Just listening'

/** The picker's options: the base parts plus the jam's custom ones. */
export const partOptions = (jamParts: Part[] = [], extra: Part[] = []) =>
  distinctParts([
    ...PART_KEYS.map(key => ({ key })),
    ...jamParts.filter(p => p.key === 'other' && p.label),
    ...extra,
  ])

/** A song's distinct parts, in order. */
export const neededParts = (item: { parts_needed: Part[] }) =>
  distinctParts(item.parts_needed)
