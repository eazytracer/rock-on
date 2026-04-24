/**
 * useJamSessionMatches — Realtime hook for jam session match updates.
 *
 * Subscribes directly to the `jam_song_matches` and `jam_participants` Realtime
 * channels for a specific session. When participants join/leave or matches are
 * recomputed, the UI updates automatically without a manual refresh.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { repository } from '../services/data/RepositoryFactory'
import { JamSessionService } from '../services/JamSessionService'
import { getSupabaseClient } from '../services/supabase/client'
import type { JamSongMatch, JamParticipant } from '../models/JamSession'

interface UseJamSessionMatchesResult {
  matches: JamSongMatch[]
  participants: JamParticipant[]
  unconfirmedCount: number
  isComputing: boolean
  refetch: () => Promise<void>
  recompute: () => Promise<void>
}

export function useJamSessionMatches(
  sessionId: string | null
): UseJamSessionMatchesResult {
  const [matches, setMatches] = useState<JamSongMatch[]>([])
  const [participants, setParticipants] = useState<JamParticipant[]>([])
  const [isComputing, setIsComputing] = useState(false)
  // Guard against triggering recompute multiple times from rapid Realtime events
  const recomputeInFlight = useRef(false)

  const fetchMatches = useCallback(async () => {
    if (!sessionId) {
      setMatches([])
      return
    }
    const data = await repository.getJamSongMatches(sessionId)
    setMatches(data)
  }, [sessionId])

  const fetchParticipants = useCallback(async () => {
    if (!sessionId) {
      setParticipants([])
      return
    }
    const data = await repository.getJamParticipants(sessionId)
    setParticipants(data)
  }, [sessionId])

  /**
   * Trigger a full match recomputation then refresh the local state.
   * Debounced via recomputeInFlight so rapid Realtime events don't stack up.
   */
  const triggerRecompute = useCallback(async () => {
    if (!sessionId || recomputeInFlight.current) return
    recomputeInFlight.current = true
    setIsComputing(true)
    try {
      const data = await JamSessionService.recomputeMatches(sessionId)
      setMatches(data)
    } finally {
      setIsComputing(false)
      recomputeInFlight.current = false
    }
  }, [sessionId])

  // Initial load — then auto-recompute if participants are present but matches are empty.
  // This handles the "returning to an existing session" case where recompute never fired,
  // or the match table was wiped by a DB reset.
  useEffect(() => {
    const init = async () => {
      if (!sessionId) return
      const [loadedMatches, loadedParticipants] = await Promise.all([
        repository.getJamSongMatches(sessionId),
        repository.getJamParticipants(sessionId),
      ])
      setMatches(loadedMatches)
      setParticipants(loadedParticipants)

      // If there are enough participants but no matches, kick off a recompute
      // via the jam-recompute Edge Function so the returning user doesn't
      // have to wait for a new join event.
      const activeCount = loadedParticipants.filter(
        p => p.status === 'active'
      ).length
      if (activeCount >= 2 && loadedMatches.length === 0) {
        void triggerRecompute()
      }
    }
    void init()
    // triggerRecompute intentionally excluded — including it would cause an
    // infinite loop because triggerRecompute calls setMatches which re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Realtime: subscribe directly to jam_song_matches and jam_participants
  // for this specific session rather than piggy-backing on songs:changed.
  useEffect(() => {
    if (!sessionId) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    const channel = supabase
      .channel(`jam:session:${sessionId}`)
      // When matches are written (by any participant's recomputeMatches call),
      // re-fetch them so every open browser sees the update immediately.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jam_song_matches',
          filter: `jam_session_id=eq.${sessionId}`,
        },
        () => {
          void fetchMatches()
        }
      )
      // When a participant joins or leaves, refresh the participant list.
      // Recompute is NOT triggered here — it is triggered by the joining
      // client calling joinSession() → JamSessionService.recomputeMatches()
      // → jam-recompute Edge Function. The Edge Function writes results
      // atomically; both clients receive the update via jam_song_matches Realtime.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jam_participants',
          filter: `jam_session_id=eq.${sessionId}`,
        },
        () => {
          void fetchParticipants()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sessionId, fetchMatches, fetchParticipants, triggerRecompute])

  return {
    matches,
    participants,
    unconfirmedCount: matches.filter(m => !m.isConfirmed).length,
    isComputing,
    refetch: fetchMatches,
    recompute: triggerRecompute,
  }
}
