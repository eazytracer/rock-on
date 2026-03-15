/**
 * useJamSessionMatches — Realtime hook for jam session match updates.
 * Subscribes to the Supabase Realtime channel for a jam session and
 * triggers match recomputation when participants change.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { repository } from '../services/data/RepositoryFactory'
import { JamSessionService } from '../services/JamSessionService'
import type { JamSongMatch } from '../models/JamSession'

interface UseJamSessionMatchesResult {
  matches: JamSongMatch[]
  unconfirmedCount: number
  isComputing: boolean
  refetch: () => Promise<void>
}

export function useJamSessionMatches(
  sessionId: string | null
): UseJamSessionMatchesResult {
  const [matches, setMatches] = useState<JamSongMatch[]>([])
  const [isComputing, setIsComputing] = useState(false)
  const { realtimeManager } = useAuth()

  const fetchMatches = useCallback(async () => {
    if (!sessionId) {
      setMatches([])
      return
    }
    const data = await repository.getJamSongMatches(sessionId)
    setMatches(data)
  }, [sessionId])

  const recompute = useCallback(async () => {
    if (!sessionId) return
    setIsComputing(true)
    try {
      const data = await JamSessionService.recomputeMatches(sessionId)
      setMatches(data)
    } finally {
      setIsComputing(false)
    }
  }, [sessionId])

  // Initial load
  useEffect(() => {
    void fetchMatches()
  }, [fetchMatches])

  // Realtime subscription — recompute when participants change
  // The RealtimeManager uses band-scoped channels; jam sessions use a different pattern.
  // We listen to any 'songs:changed' or 'setlists:changed' events as a proxy
  // until a jam-specific channel pattern is added to RealtimeManager.
  useEffect(() => {
    if (!realtimeManager || !sessionId) return

    const handleChange = () => {
      // Silently recompute in background
      void recompute()
    }

    // TODO: when RealtimeManager supports jam-specific channels,
    // subscribe to jam:session:{sessionId} instead
    realtimeManager.on('songs:changed', handleChange)
    return () => {
      realtimeManager.off('songs:changed', handleChange)
    }
  }, [realtimeManager, sessionId, recompute])

  return {
    matches,
    unconfirmedCount: matches.filter(m => !m.isConfirmed).length,
    isComputing,
    refetch: fetchMatches,
  }
}
