import { useEffect, useState } from 'react'
import { db } from '../services/database'
import type { Song } from '../models/Song'

/**
 * Resolves the source band for personal songs that were forked from a band
 * song (Song.linkedFromSongId). Returns a Map of personalSongId ->
 * sourceBandName. Songs with no source (original personal songs) — or whose
 * origin song/band can no longer be resolved locally — are simply absent
 * from the map. Returns an empty Map while loading.
 */
export function useSongSources(personalSongs: Song[]): Map<string, string> {
  const [sourceMap, setSourceMap] = useState<Map<string, string>>(
    () => new Map()
  )

  // Stable key of the distinct linkedFromSongIds present in the current
  // catalog, so the Dexie lookup only re-runs when that set actually
  // changes (mirrors useBulkPersonalNotePresence in useNotes.ts).
  const linkedFromIds = Array.from(
    new Set(
      personalSongs
        .map(song => song.linkedFromSongId)
        .filter((id): id is string => !!id)
    )
  )
  const linkedFromKey = linkedFromIds.slice().sort().join(',')

  useEffect(() => {
    if (linkedFromIds.length === 0) {
      setSourceMap(new Map())
      return
    }

    let cancelled = false

    const resolveSources = async () => {
      try {
        const origins = await db.songs.bulkGet(linkedFromIds)
        const originById = new Map(
          origins.filter((s): s is Song => !!s).map(s => [s.id, s])
        )

        const bandIds = Array.from(
          new Set(Array.from(originById.values()).map(s => s.contextId))
        )
        const bands = await db.bands.bulkGet(bandIds)
        const bandNameById = new Map(
          bands
            .filter((b): b is NonNullable<typeof b> => !!b)
            .map(b => [b.id, b.name])
        )

        const map = new Map<string, string>()
        for (const song of personalSongs) {
          if (!song.linkedFromSongId) continue
          const origin = originById.get(song.linkedFromSongId)
          if (!origin) continue
          const bandName = bandNameById.get(origin.contextId)
          if (!bandName) continue
          map.set(song.id, bandName)
        }

        if (!cancelled) setSourceMap(map)
      } catch (err) {
        console.error('[useSongSources] Error resolving song sources:', err)
      }
    }

    resolveSources()

    return () => {
      cancelled = true
    }
    // personalSongs is re-created each render; linkedFromKey captures the
    // only inputs that should trigger a re-resolve (see comment above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedFromKey])

  return sourceMap
}
