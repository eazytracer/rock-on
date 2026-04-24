/**
 * useJamSession — React hook for managing a single jam session.
 * Handles loading, participant management, and match actions.
 */
import { useState, useEffect, useCallback } from 'react'
import { repository } from '../services/data/RepositoryFactory'
import { JamSessionService } from '../services/JamSessionService'
import { getSupabaseClient } from '../services/supabase/client'
import type {
  JamSession,
  JamParticipant,
  JamSongMatch,
} from '../models/JamSession'
import type { Setlist } from '../models/Setlist'
import type { Song } from '../models/Song'

interface UseJamSessionState {
  session: JamSession | null
  participants: JamParticipant[]
  matches: JamSongMatch[]
  loading: boolean
  error: Error | null
  isSaving: boolean
}

interface UseJamSessionActions {
  joinSession: (shortCode: string, userId: string) => Promise<JamSession>
  leaveSession: (participantId: string) => Promise<void>
  confirmMatch: (matchId: string) => Promise<void>
  dismissMatch: (matchId: string) => Promise<void>
  saveAsSetlist: (
    hostUserId: string,
    name?: string,
    queuedSongs?: Song[],
    setlistSongs?: Song[]
  ) => Promise<Setlist>
  refetch: () => Promise<void>
}

export function useJamSession(
  sessionId: string | null
): UseJamSessionState & UseJamSessionActions {
  const [session, setSession] = useState<JamSession | null>(null)
  const [participants, setParticipants] = useState<JamParticipant[]>([])
  const [matches, setMatches] = useState<JamSongMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchSession = useCallback(
    async (silent = false) => {
      if (!sessionId) {
        setSession(null)
        setParticipants([])
        setMatches([])
        setLoading(false)
        return
      }

      try {
        // Only show the loading spinner on the initial page load.
        // Background refreshes (e.g. from Realtime subscription) pass silent=true
        // so they don't flash the spinner and disrupt the in-session UI.
        if (!silent) setLoading(true)
        const [s, p, m] = await Promise.all([
          repository.getJamSession(sessionId),
          repository.getJamParticipants(sessionId),
          repository.getJamSongMatches(sessionId),
        ])
        setSession(s)
        setParticipants(p)
        setMatches(m)
        setError(null)
      } catch (err) {
        setError(err as Error)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  // Realtime: subscribe to jam_sessions so all participants see settings
  // changes (e.g. setlistSongIds written by the host) without a manual refresh.
  useEffect(() => {
    if (!sessionId) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    const channel = supabase
      .channel(`jam:session-meta:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jam_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          // Re-fetch the full session so session.settings reflects the latest
          // host writes (e.g. setlistSongIds, hostSongIds).
          // silent=true: don't show loading spinner for background refreshes.
          void fetchSession(true)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sessionId, fetchSession])

  // Check for expiry on load
  useEffect(() => {
    if (
      session?.status === 'active' &&
      new Date(session.expiresAt) < new Date()
    ) {
      void JamSessionService.expireSession(session.id).then(() => {
        setSession(prev => (prev ? { ...prev, status: 'expired' } : null))
      })
    }
  }, [session])

  const joinSession = useCallback(
    async (shortCode: string, userId: string) => {
      const joined = await JamSessionService.joinSession(shortCode, userId)
      await fetchSession()
      // Return the session so callers can navigate to /jam/:id
      return joined
    },
    [fetchSession]
  )

  const leaveSession = useCallback(async (participantId: string) => {
    await repository.updateJamParticipant(participantId, { status: 'left' })
    setParticipants(prev =>
      prev.map(p => (p.id === participantId ? { ...p, status: 'left' } : p))
    )
  }, [])

  const confirmMatch = useCallback(
    async (matchId: string) => {
      if (!sessionId) return
      // Optimistic update
      setMatches(prev =>
        prev.map(m => (m.id === matchId ? { ...m, isConfirmed: true } : m))
      )
      try {
        await JamSessionService.confirmMatch(sessionId, matchId)
      } catch (err) {
        // Revert on error
        setMatches(prev =>
          prev.map(m => (m.id === matchId ? { ...m, isConfirmed: false } : m))
        )
        throw err
      }
    },
    [sessionId]
  )

  const dismissMatch = useCallback(
    async (matchId: string) => {
      if (!sessionId) return
      setMatches(prev => prev.filter(m => m.id !== matchId))
      try {
        await JamSessionService.dismissMatch(sessionId, matchId)
      } catch (err) {
        // Refetch to restore state
        void fetchSession()
        throw err
      }
    },
    [sessionId, fetchSession]
  )

  const saveAsSetlist = useCallback(
    async (
      hostUserId: string,
      name?: string,
      queuedSongs?: Song[],
      setlistSongs?: Song[]
    ): Promise<Setlist> => {
      if (!sessionId) throw new Error('No session to save')
      setIsSaving(true)
      try {
        const setlist = await JamSessionService.saveAsSetlist(
          sessionId,
          hostUserId,
          name,
          queuedSongs,
          setlistSongs
        )
        setSession(prev =>
          prev
            ? {
                ...prev,
                status: 'saved',
                savedSetlistId: setlist.id,
              }
            : null
        )
        return setlist
      } finally {
        setIsSaving(false)
      }
    },
    [sessionId]
  )

  return {
    session,
    participants,
    matches,
    loading,
    error,
    isSaving,
    joinSession,
    leaveSession,
    confirmMatch,
    dismissMatch,
    saveAsSetlist,
    refetch: fetchSession,
  }
}
