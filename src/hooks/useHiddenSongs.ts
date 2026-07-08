import { useCallback, useEffect, useState } from 'react'
import { SongHiddenService } from '../services/SongHiddenService'

/**
 * The current user's hidden song ids (Supabase `song_hidden`, own-rows RLS).
 * Hide/unhide update the local Set optimistically; on failure they refetch
 * to reconcile with the server.
 */
export function useHiddenSongs() {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const ids = await SongHiddenService.listHidden()
    setHiddenIds(new Set(ids))
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const hide = useCallback(
    async (songId: string) => {
      setHiddenIds(prev => new Set(prev).add(songId))
      const ok = await SongHiddenService.hide(songId)
      if (!ok) await refetch()
    },
    [refetch]
  )

  const unhide = useCallback(
    async (songId: string) => {
      setHiddenIds(prev => {
        const next = new Set(prev)
        next.delete(songId)
        return next
      })
      const ok = await SongHiddenService.unhide(songId)
      if (!ok) await refetch()
    },
    [refetch]
  )

  return { hiddenIds, loading, hide, unhide, refetch }
}
