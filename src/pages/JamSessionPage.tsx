import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Radio,
  Plus,
  LogIn,
  Save,
  ChevronDown,
  Music,
  Library,
  ListMusic,
  ArrowRight,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { repository } from '../services/data/RepositoryFactory'
import { JamSessionService } from '../services/JamSessionService'
import type { JamSession } from '../models/JamSession'
import { useJamSession } from '../hooks/useJamSession'
import { useJamSessionMatches } from '../hooks/useJamSessionMatches'
import { usePersonalSongs } from '../hooks/useSongs'
import { usePersonalSetlists } from '../hooks/useSetlists'
import { JamSessionCard } from '../components/jam/JamSessionCard'
import { JamParticipantList } from '../components/jam/JamParticipantList'
import { JamMatchList } from '../components/jam/JamMatchList'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { BrowseSongsDrawer } from '../components/common/BrowseSongsDrawer'
import { TabSwitcher } from '../components/common/TabSwitcher'
import { EmptyState } from '../components/common/EmptyState'
import {
  QueueSongRow,
  SortableQueueSongRow,
} from '../components/common/QueueSongRow'
import type { Song } from '../models/Song'
import type { JamSongMatch } from '../models/JamSession'

/**
 * JamSessionPage — authenticated view for creating and managing jam sessions.
 *
 * Two panels in the active session view:
 * 1. Songs in Common — auto-computed matches when others join
 * 2. My Song Queue — host manually builds their own song list from personal catalog
 */
export const JamSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const navigate = useNavigate()
  useAuth()
  const { showToast } = useToast()

  const userId = localStorage.getItem('currentUserId') || ''

  // Session state — actions and base session data
  const {
    session,
    loading,
    error,
    isSaving,
    joinSession,
    confirmMatch,
    dismissMatch,
    saveAsSetlist,
  } = useJamSession(sessionId ?? null)

  // Live participants + matches via dedicated Realtime subscription.
  // Recompute is triggered by the joining client via the jam-recompute Edge
  // Function; this hook only reads the results. Both clients receive updates
  // the moment the Edge Function writes to jam_song_matches.
  const {
    matches,
    participants,
    isComputing: isRecomputing,
    recompute: recomputeMatches,
  } = useJamSessionMatches(sessionId ?? null)

  // Personal songs for the host's manual queue
  const { songs: personalSongs } = usePersonalSongs(userId)

  // Personal setlists — shown as optional seeds when creating a new jam
  const { setlists: personalSetlists } = usePersonalSetlists(userId)

  // Active sessions for the landing page "return to jam" cards
  const [activeSessions, setActiveSessions] = useState<JamSession[]>([])

  const loadActiveSessions = useCallback(async () => {
    if (!userId || sessionId) return
    try {
      const sessions = await repository.getActiveJamSessionsForUser(userId)
      setActiveSessions(sessions)
    } catch {
      // Non-critical — silently ignore
    }
  }, [userId, sessionId])

  useEffect(() => {
    void loadActiveSessions()
  }, [loadActiveSessions])

  // Local form state
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [seedSetlistId, setSeedSetlistId] = useState<string>('')
  const [shareUrl, setShareUrl] = useState('')
  const [rawToken, setRawToken] = useState('')

  // Host's manual song queue (stored locally in state + persisted to session.settings)
  const [queuedSongs, setQueuedSongs] = useState<Song[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  // Separate drawer state for the Setlist-tab "Add from my catalog" flow
  const [isSetlistPickerOpen, setIsSetlistPickerOpen] = useState(false)

  // Active panel: 'common' = auto-matched, 'queue' = manual queue, 'setlist' = curated setlist builder
  const [activePanel, setActivePanel] = useState<
    'common' | 'queue' | 'setlist'
  >('common')

  // Curated setlist — host explicitly adds confirmed common songs + reorders them
  const [setlistSongs, setSetlistSongs] = useState<Song[]>([])

  // dnd-kit sensors for setlist reordering
  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Restore host's manual queue from session settings (host-only: song IDs live in personal catalog)
  useEffect(() => {
    if (!session?.settings?.hostSongIds || personalSongs.length === 0) return
    const ids = session.settings.hostSongIds as string[]
    const restored = ids
      .map(id => personalSongs.find(s => s.id === id))
      .filter((s): s is Song => !!s)
    setQueuedSongs(restored)
  }, [session?.settings?.hostSongIds, personalSongs])

  // Rehydrate the raw view token from localStorage when the host returns to
  // a session they already created (shareUrl state resets on component
  // remount / page refresh; the DB only stores the hashed token, so the
  // raw token can't be re-derived server-side). Without this, the share
  // UI would fall back to a broken /jam/view/<code> URL with no `?t=...`
  // parameter — the edge function rejects that with 400.
  useEffect(() => {
    if (!session?.id || rawToken) return
    try {
      const stored = localStorage.getItem(`rockon:jam:viewToken:${session.id}`)
      if (stored) {
        setRawToken(stored)
        setShareUrl(
          JamSessionService.generateShareUrl(session.shortCode, stored)
        )
      }
    } catch {
      /* storage unavailable; host will need to recreate session to share */
    }
  }, [session?.id, session?.shortCode, rawToken])

  // Derive the displayable setlist from session settings.
  // Reads `setlistItems` (objects with displayTitle/displayArtist embedded) —
  // the canonical shape since 2026-04-20. Falls back to the legacy
  // `setlistSongIds: string[]` for any older sessions still around, resolving
  // IDs against local catalogs; unresolvable legacy IDs are dropped silently
  // (they're typically stale match IDs from before match regeneration).
  useEffect(() => {
    const items = session?.settings?.setlistItems as
      | Array<{ id: string; displayTitle: string; displayArtist: string }>
      | undefined
    if (items && items.length > 0) {
      setSetlistSongs(
        items.map(
          it =>
            ({
              id: it.id,
              title: it.displayTitle,
              artist: it.displayArtist,
            }) as Song
        )
      )
      return
    }

    // Legacy fallback for pre-refactor sessions
    const legacyIds = (session?.settings?.setlistSongIds ?? []) as string[]
    if (!legacyIds.length) {
      setSetlistSongs([])
      return
    }
    const resolved = legacyIds
      .map(id => {
        const fromPersonal = personalSongs.find(s => s.id === id)
        if (fromPersonal) return fromPersonal
        for (const match of matches) {
          const entry = match.matchedSongs.find(ms => ms.songId === id)
          if (entry) {
            return {
              id,
              title: match.displayTitle,
              artist: match.displayArtist,
            } as Song
          }
        }
        return null
      })
      .filter((s): s is Song => !!s)
    setSetlistSongs(resolved)
  }, [
    session?.settings?.setlistItems,
    session?.settings?.setlistSongIds,
    personalSongs,
    matches,
  ])

  // Create session handler
  const handleCreateSession = async () => {
    if (!userId) {
      showToast('Please log in to create a jam session', 'error')
      return
    }
    const { allowed, reason } =
      await JamSessionService.canCreateJamSession(userId)
    if (!allowed) {
      showToast(reason || 'Cannot create jam session', 'error')
      return
    }
    setIsCreating(true)
    try {
      const { session: newSession, rawViewToken } =
        await JamSessionService.createSession(
          userId,
          sessionName || undefined,
          undefined,
          seedSetlistId || undefined
        )
      const url = JamSessionService.generateShareUrl(
        newSession.shortCode,
        rawViewToken
      )
      setShareUrl(url)
      setRawToken(rawViewToken)
      // Persist the raw view token so the share URL survives remounts /
      // page refreshes. Only the host holds the raw token (DB stores a
      // hash), so this is the only place to preserve it.
      try {
        localStorage.setItem(
          `rockon:jam:viewToken:${newSession.id}`,
          rawViewToken
        )
      } catch {
        /* storage unavailable; share URL will need recreation */
      }
      showToast('Jam session created!', 'success')
      navigate(`/jam/${newSession.id}`)
    } catch (err) {
      showToast(`Failed to create session: ${(err as Error).message}`, 'error')
    } finally {
      setIsCreating(false)
    }
  }

  // Join session handler — navigates directly to the session on success
  const handleJoinSession = async () => {
    if (!joinCode.trim()) {
      showToast('Please enter a join code', 'error')
      return
    }
    setIsJoining(true)
    try {
      const joined = await joinSession(joinCode.trim().toUpperCase(), userId)
      showToast('Joined jam session!', 'success')
      setJoinCode('')
      navigate(`/jam/${joined.id}`)
    } catch (err) {
      showToast(`Failed to join: ${(err as Error).message}`, 'error')
    } finally {
      setIsJoining(false)
    }
  }

  // Add song to manual queue and re-run matching so Common Songs reflects it
  const handleAddToQueue = (song: Song) => {
    if (queuedSongs.find(s => s.id === song.id)) return // no duplicates
    const updated = [...queuedSongs, song]
    setQueuedSongs(updated)
    if (session) {
      void JamSessionService.updateSessionSettings(session.id, {
        hostSongIds: updated.map(s => s.id),
      })
    }
    // Recompute so any song now in both participants' personal catalogs appears
    void recomputeMatches()
  }

  // Remove song from manual queue and re-run matching
  const handleRemoveFromQueue = (songId: string) => {
    const updated = queuedSongs.filter(s => s.id !== songId)
    setQueuedSongs(updated)
    if (session) {
      void JamSessionService.updateSessionSettings(session.id, {
        hostSongIds: updated.map(s => s.id),
      })
    }
    void recomputeMatches()
  }

  // Build a persistent, stable setlist-item tuple (id + display data) so the
  // ID can never go orphan from a match recompute. Writes the canonical
  // `setlistItems` shape via the dedicated mutator, which strips any legacy
  // `setlistSongIds` field in the same write to keep the broadcast shape
  // unambiguous for participants and the jam-view edge function.
  const persistSetlistItems = (songs: Song[]) => {
    if (!session) return
    const items = songs.map(s => ({
      id: s.id,
      displayTitle: s.title,
      displayArtist: s.artist ?? '',
    }))
    void JamSessionService.updateSetlistItems(session.id, items)
  }

  // Add a confirmed common-song match to the curated setlist
  const handleAddToSetlist = (match: JamSongMatch) => {
    // Prefer a stable song ID. When the host has their own copy of the match,
    // use that song's ID (host's personal catalog row). When they don't, fall
    // back to the first participant's song ID — still stable because the
    // underlying personal-song row isn't regenerated on recompute. Finally,
    // fall back to the (unstable) match ID only if everything else is missing.
    const hostEntry = match.matchedSongs.find(ms => ms.userId === userId)
    const fallbackEntry = hostEntry ?? match.matchedSongs[0]
    const song: Song = hostEntry
      ? (personalSongs.find(s => s.id === hostEntry.songId) ??
        ({
          id: hostEntry.songId,
          title: match.displayTitle,
          artist: match.displayArtist,
        } as Song))
      : ({
          id: fallbackEntry?.songId ?? match.id,
          title: match.displayTitle,
          artist: match.displayArtist,
        } as Song)

    if (setlistSongs.find(s => s.id === song.id)) return // no duplicates
    const updated = [...setlistSongs, song]
    setSetlistSongs(updated)
    persistSetlistItems(updated)
    // Switch to setlist panel so host sees the change
    setActivePanel('setlist')
  }

  // Add a song from the host's personal catalog directly to the setlist.
  // Unlike handleAddToSetlist (which takes a match object), this path is used
  // when the host wants to include a song that isn't in the common-matches list
  // — e.g., a song only they know, or a song they want to play even if other
  // participants don't have it in their catalog.
  const handleAddSongToSetlist = (song: Song) => {
    if (setlistSongs.find(s => s.id === song.id)) return // no duplicates
    const updated = [...setlistSongs, song]
    setSetlistSongs(updated)
    persistSetlistItems(updated)
  }

  // Remove a song from the curated setlist
  const handleRemoveFromSetlist = (songId: string) => {
    const updated = setlistSongs.filter(s => s.id !== songId)
    setSetlistSongs(updated)
    persistSetlistItems(updated)
  }

  // Reorder setlist songs via dnd-kit drag end
  const handleSetlistDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = setlistSongs.findIndex(s => s.id === active.id)
    const newIndex = setlistSongs.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const updated = arrayMove(setlistSongs, oldIndex, newIndex)
    setSetlistSongs(updated)
    persistSetlistItems(updated)
  }

  // Save as setlist — uses curated setlist if available, otherwise merges auto-matches + queue
  const handleSaveAsSetlist = async () => {
    if (!session) return
    try {
      const setlist = await saveAsSetlist(
        userId,
        undefined,
        queuedSongs,
        setlistSongs.length > 0 ? setlistSongs : undefined
      )
      showToast(`Saved as "${setlist.name}"!`, 'success')
      navigate('/setlists')
    } catch (err) {
      showToast(`Failed to save: ${(err as Error).message}`, 'error')
    }
  }

  // End-session flow. The host clicks End → EndJamSessionDialog opens →
  // host picks "save + end" (calls handleSaveAsSetlist, which already
  // flips session.status='saved' and navigates to /setlists), or
  // "end without saving" (JamSessionService.expireSession only). A
  // canvas-wide bailout flow; we don't attempt to undo participant
  // rows, matches, etc. — the edge function's session-lookup path
  // filters by status='active' so expired sessions drop off the
  // anon view and participants' lists automatically.
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false)
  const [isEnding, setIsEnding] = useState(false)

  const handleEndWithoutSaving = async () => {
    if (!session) return
    setIsEnding(true)
    try {
      await JamSessionService.expireSession(session.id)
      showToast('Jam session ended', 'success')
      navigate('/jam')
    } catch (err) {
      showToast(`Failed to end session: ${(err as Error).message}`, 'error')
    } finally {
      setIsEnding(false)
      setIsEndDialogOpen(false)
    }
  }

  const handleSaveAndEnd = async () => {
    if (!session) return
    setIsEnding(true)
    try {
      // saveAsSetlist internally flips session.status to 'saved'
      // (which removes it from any "active" queries), so we don't
      // also need to call expireSession. 'saved' is a terminal state
      // alongside 'expired'.
      await saveAsSetlist(
        userId,
        undefined,
        queuedSongs,
        setlistSongs.length > 0 ? setlistSongs : undefined
      )
      showToast('Setlist saved, jam ended', 'success')
      navigate('/setlists')
    } catch (err) {
      showToast(`Failed to save & end: ${(err as Error).message}`, 'error')
    } finally {
      setIsEnding(false)
      setIsEndDialogOpen(false)
    }
  }

  const isHost = session?.hostUserId === userId
  const confirmedMatchCount = matches.filter(m => m.isConfirmed).length
  const canSave =
    confirmedMatchCount > 0 || queuedSongs.length > 0 || setlistSongs.length > 0
  // Track which match IDs are already in the setlist (for the "added" indicator)
  const setlistMatchIds = new Set(
    matches
      .filter(m =>
        setlistSongs.some(s =>
          m.matchedSongs.some(ms => ms.userId === userId && ms.songId === s.id)
        )
      )
      .map(m => m.id)
  )

  return (
    <ContentLoadingSpinner isLoading={loading && !!sessionId}>
      <div data-testid="jam-session-page" className="max-w-4xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Radio size={22} className="text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Jam Session</h1>
            <ChevronDown size={20} className="text-[#a0a0a0]" />
          </div>
          <p className="text-[#707070] text-sm">
            Find songs you have in common with other musicians, or build your
            own song queue for an impromptu set.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error.message}
          </div>
        )}

        {/* No active session: create / join */}
        {!sessionId && (
          <div className="space-y-6">
            {/* Resume cards — shown when the user has active sessions */}
            {activeSessions.length > 0 && (
              <div data-testid="jam-active-sessions">
                <h2 className="text-[#a0a0a0] text-xs font-medium uppercase tracking-wide mb-3">
                  Your Active Sessions
                </h2>
                <div className="space-y-2">
                  {activeSessions.map(s => {
                    const isHost = s.hostUserId === userId
                    const expiresIn = Math.max(
                      0,
                      Math.round(
                        (new Date(s.expiresAt).getTime() - Date.now()) /
                          (1000 * 60 * 60)
                      )
                    )
                    return (
                      <button
                        key={s.id}
                        data-testid={`jam-resume-${s.id}`}
                        onClick={() => navigate(`/jam/${s.id}`)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 hover:border-amber-500/50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <Radio
                            size={18}
                            className="text-amber-400 flex-shrink-0"
                          />
                          <div>
                            <p className="text-white text-sm font-medium">
                              {s.name ?? `Jam ${s.shortCode}`}
                            </p>
                            <p className="text-[#a0a0a0] text-xs mt-0.5">
                              {isHost ? 'You are hosting' : 'You joined'} ·{' '}
                              {expiresIn}h remaining · Code:{' '}
                              <span className="font-mono">{s.shortCode}</span>
                            </p>
                          </div>
                        </div>
                        <ArrowRight
                          size={16}
                          className="text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Plus size={18} className="text-amber-400" />
                  Host a Jam
                </h2>
                <div className="space-y-3">
                  <input
                    data-testid="jam-session-name-input"
                    type="text"
                    id="jam-session-name"
                    name="jamSessionName"
                    placeholder="Session name (optional)"
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[#333] text-white text-sm placeholder-[#707070] focus:outline-none focus:border-amber-500"
                  />
                  <div>
                    <label
                      htmlFor="jam-seed-setlist"
                      className="block text-xs text-[#a0a0a0] mb-1"
                    >
                      Start from a setlist (optional)
                    </label>
                    <select
                      data-testid="jam-seed-setlist-select"
                      id="jam-seed-setlist"
                      name="jamSeedSetlist"
                      value={seedSetlistId}
                      onChange={e => setSeedSetlistId(e.target.value)}
                      disabled={personalSetlists.length === 0}
                      className="w-full px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[#333] text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      <option value="">
                        {personalSetlists.length === 0
                          ? 'No personal setlists yet'
                          : 'None — start empty'}
                      </option>
                      {personalSetlists.map(sl => {
                        const songCount = (sl.items ?? []).filter(
                          i => i.type === 'song' && i.songId
                        ).length
                        return (
                          <option key={sl.id} value={sl.id}>
                            {sl.name} ({songCount} song
                            {songCount === 1 ? '' : 's'})
                          </option>
                        )
                      })}
                    </select>
                    {seedSetlistId && (
                      <p className="text-xs text-[#707070] mt-1">
                        The setlist's songs will pre-populate your Setlist tab.
                      </p>
                    )}
                  </div>
                  <button
                    data-testid="jam-create-button"
                    onClick={() => void handleCreateSession()}
                    disabled={isCreating}
                    className="w-full py-2.5 rounded-lg bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? 'Creating...' : 'Create Jam Session'}
                  </button>
                </div>
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <LogIn size={18} className="text-blue-400" />
                  Join a Jam
                </h2>
                <div className="space-y-3">
                  <input
                    data-testid="jam-join-code-input"
                    type="text"
                    id="jam-join-code"
                    name="jamJoinCode"
                    placeholder="Enter 6-digit code"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="w-full px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[#333] text-white text-sm placeholder-[#707070] focus:outline-none focus:border-blue-500 font-mono tracking-widest text-center uppercase"
                  />
                  <button
                    data-testid="jam-join-button"
                    onClick={() => void handleJoinSession()}
                    disabled={isJoining || joinCode.length < 6}
                    className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isJoining ? 'Joining...' : 'Join Session'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active session view */}
        {session && (
          <div className="space-y-6">
            {/* Session card */}
            <JamSessionCard session={session} shareUrl={shareUrl} />

            {/* Participants + panels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left: participants */}
              <div className="md:col-span-1">
                <h3 className="text-[#a0a0a0] text-sm font-medium mb-3 uppercase tracking-wide">
                  Participants
                </h3>
                <JamParticipantList
                  participants={participants}
                  hostUserId={session.hostUserId}
                />
              </div>

              {/* Right: panel switcher */}
              <div className="md:col-span-2">
                {/* Panel tabs + action buttons row */}
                <div className="flex items-center justify-between mb-3">
                  <TabSwitcher
                    data-testid="jam-panel-tabs"
                    tabs={[
                      {
                        value: 'common' as const,
                        label: 'Common Songs',
                        icon: Radio,
                        badge: isRecomputing
                          ? undefined
                          : confirmedMatchCount || undefined,
                        badgeAnimate: isRecomputing,
                      },
                      {
                        value: 'setlist' as const,
                        label: 'Setlist',
                        icon: ListMusic,
                        badge: setlistSongs.length || undefined,
                      },
                      {
                        value: 'queue' as const,
                        label: 'My Queue',
                        icon: Music,
                        badge: queuedSongs.length || undefined,
                      },
                    ]}
                    value={activePanel}
                    onChange={setActivePanel}
                  />

                  <div className="flex items-center gap-2">
                    {/* Manual refresh — visible when ≥2 participants */}
                    {participants.filter(p => p.status === 'active').length >=
                      2 && (
                      <button
                        data-testid="jam-refresh-matches-button"
                        onClick={() => void recomputeMatches()}
                        disabled={isRecomputing}
                        title="Refresh common songs"
                        className="p-1.5 rounded-md text-[#707070] hover:text-amber-400 transition-colors disabled:opacity-40"
                      >
                        <RefreshCw
                          size={13}
                          className={isRecomputing ? 'animate-spin' : ''}
                        />
                      </button>
                    )}
                    {/* Save — host only, when there's something to save */}
                    {isHost && session.status === 'active' && canSave && (
                      <button
                        data-testid="jam-save-setlist-button"
                        onClick={() => void handleSaveAsSetlist()}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-medium hover:bg-green-600/30 transition-colors disabled:opacity-50"
                      >
                        <Save size={13} />
                        {isSaving ? 'Saving...' : 'Save as Setlist'}
                      </button>
                    )}
                    {/* End session — host only, visible on any active
                        session (independent of canSave — an empty
                        session can still be ended cleanly). Opens a
                        confirmation dialog that offers to save first
                        if there's anything to save. */}
                    {isHost && session.status === 'active' && (
                      <button
                        data-testid="jam-end-session-button"
                        onClick={() => setIsEndDialogOpen(true)}
                        disabled={isEnding}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <XCircle size={13} />
                        End Session
                      </button>
                    )}
                  </div>
                </div>

                {/* Common songs panel */}
                {activePanel === 'common' && (
                  <div>
                    {participants.filter(p => p.status === 'active').length <
                    2 ? (
                      <EmptyState
                        icon={Radio}
                        title="Waiting for others to join…"
                        description="Share your code or QR code above. Common songs appear automatically when someone joins."
                        size="md"
                      />
                    ) : (
                      <JamMatchList
                        matches={matches}
                        isHost={isHost}
                        setlistMatchIds={setlistMatchIds}
                        onConfirm={id => void confirmMatch(id)}
                        onDismiss={id => void dismissMatch(id)}
                        onAddToSetlist={handleAddToSetlist}
                      />
                    )}
                  </div>
                )}

                {/* Setlist builder panel */}
                {activePanel === 'setlist' && (
                  <div>
                    {setlistSongs.length === 0 ? (
                      <EmptyState
                        icon={ListMusic}
                        title={
                          isHost ? 'Your setlist is empty.' : 'No setlist yet.'
                        }
                        description={
                          isHost
                            ? 'Add songs from your personal catalog, or tap + on confirmed matches in Common Songs. Drag to reorder.'
                            : 'The host is building the setlist. Songs will appear here as they add them.'
                        }
                        action={
                          isHost
                            ? {
                                label: 'Add from my catalog',
                                icon: Library,
                                onClick: () => setIsSetlistPickerOpen(true),
                                'data-testid':
                                  'jam-setlist-add-from-catalog-button',
                              }
                            : undefined
                        }
                        size="md"
                      />
                    ) : (
                      <div className="space-y-2">
                        {isHost ? (
                          // Host: drag-to-reorder + remove actions
                          <DndContext
                            sensors={dndSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleSetlistDragEnd}
                          >
                            <SortableContext
                              items={setlistSongs.map(s => s.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {setlistSongs.map((song, idx) => (
                                <SortableQueueSongRow
                                  key={song.id}
                                  id={song.id}
                                  song={song}
                                  position={idx + 1}
                                  showDragHandle={true}
                                  data-testid={`jam-setlist-song-${song.id}`}
                                  actions={[
                                    {
                                      label: 'Remove',
                                      icon: Trash2,
                                      variant: 'danger',
                                      onClick: () =>
                                        handleRemoveFromSetlist(song.id),
                                    },
                                  ]}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        ) : (
                          // Participant: read-only list
                          setlistSongs.map((song, idx) => (
                            <QueueSongRow
                              key={song.id}
                              song={song}
                              position={idx + 1}
                              showDragHandle={false}
                              data-testid={`jam-setlist-song-${song.id}`}
                            />
                          ))
                        )}
                        {isHost && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              data-testid="jam-setlist-add-from-catalog-button"
                              onClick={() => setIsSetlistPickerOpen(true)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#333] text-[#707070] text-sm hover:border-[#f17827ff] hover:text-[#f17827ff] transition-colors w-full justify-center"
                            >
                              <Library size={14} />
                              Add from my catalog
                            </button>
                            <button
                              data-testid="jam-setlist-add-more-button"
                              onClick={() => setActivePanel('common')}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#333] text-[#707070] text-sm hover:border-[#f17827ff] hover:text-[#f17827ff] transition-colors w-full justify-center"
                            >
                              <Radio size={14} />
                              Add from Common Songs
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* My song queue panel */}
                {activePanel === 'queue' && (
                  <div>
                    {queuedSongs.length === 0 ? (
                      <EmptyState
                        icon={Library}
                        title="No songs in your queue yet."
                        description="Add songs from your personal catalog to play during the jam."
                        action={{
                          label: 'Add Songs',
                          icon: Plus,
                          onClick: () => setIsPickerOpen(true),
                          'data-testid': 'jam-add-songs-button',
                        }}
                      />
                    ) : (
                      <div className="space-y-2">
                        {queuedSongs.map((song, idx) => (
                          <QueueSongRow
                            key={song.id}
                            song={song}
                            position={idx + 1}
                            showDragHandle={false}
                            data-testid={`jam-queue-song-${song.id}`}
                            actions={[
                              {
                                label: 'Remove',
                                icon: Trash2,
                                variant: 'danger',
                                onClick: () => handleRemoveFromQueue(song.id),
                              },
                            ]}
                          />
                        ))}
                        <button
                          data-testid="jam-add-songs-button"
                          onClick={() => setIsPickerOpen(true)}
                          className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#333] text-[#707070] text-sm hover:border-[#f17827ff] hover:text-[#f17827ff] transition-colors w-full justify-center"
                        >
                          <Plus size={14} />
                          Add more songs
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Session saved notice */}
            {session.status === 'saved' && session.savedSetlistId && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
                This jam was saved as a personal setlist.{' '}
                <button
                  onClick={() => navigate('/setlists')}
                  className="underline hover:no-underline"
                >
                  View setlists →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Session not found */}
        {!loading && sessionId && !session && !error && (
          <div className="text-center py-16">
            <p className="text-[#707070]">Session not found or has expired.</p>
            <button
              onClick={() => navigate('/jam')}
              className="mt-4 px-4 py-2 rounded-lg bg-[#2a2a2a] text-white text-sm hover:bg-[#333] transition-colors"
            >
              Start a new jam
            </button>
          </div>
        )}

        {/* Song picker drawer for manual queue */}
        <BrowseSongsDrawer
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          songs={personalSongs}
          selectedSongIds={queuedSongs.map(s => s.id)}
          onAddSong={handleAddToQueue}
        />

        {/* Song picker drawer for the curated setlist (host adds from own catalog) */}
        <BrowseSongsDrawer
          isOpen={isSetlistPickerOpen}
          onClose={() => setIsSetlistPickerOpen(false)}
          songs={personalSongs}
          selectedSongIds={setlistSongs.map(s => s.id)}
          onAddSong={handleAddSongToSetlist}
        />

        {/* End-session confirmation dialog. Three-action when there's
            anything to save (Save & End / End without saving / Cancel);
            two-action when the session is empty (End / Cancel). Rendered
            inline here rather than via the shared ConfirmDialog so we
            can expose a dedicated secondary action without bloating the
            shared component's API. */}
        {isEndDialogOpen && session && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={e => {
              if (e.target === e.currentTarget && !isEnding) {
                setIsEndDialogOpen(false)
              }
            }}
            data-testid="jam-end-dialog-backdrop"
          >
            <div
              className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
              data-testid="jam-end-dialog"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-2 rounded-full bg-red-500/10">
                    <XCircle size={20} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg mb-2">
                      End this jam session?
                    </h3>
                    <p className="text-[#a0a0a0] text-sm">
                      {canSave
                        ? 'Save the current setlist to your personal setlists before ending, or end without saving. Either way, the session will stop accepting new participants.'
                        : 'The session will stop accepting new participants. This cannot be undone.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 mt-6">
                  <button
                    onClick={() => setIsEndDialogOpen(false)}
                    disabled={isEnding}
                    className="px-4 py-2 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors disabled:opacity-50"
                    data-testid="jam-end-dialog-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleEndWithoutSaving()}
                    disabled={isEnding}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[#2a2a2a] text-[#e0e0e0] hover:bg-[#333] transition-colors disabled:opacity-50"
                    data-testid="jam-end-dialog-end-without-saving"
                  >
                    {canSave ? 'End without saving' : 'End Session'}
                  </button>
                  {canSave && (
                    <button
                      onClick={() => void handleSaveAndEnd()}
                      disabled={isEnding}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg bg-primary hover:bg-[#e53d01] transition-colors disabled:opacity-50"
                      data-testid="jam-end-dialog-save-and-end"
                    >
                      {isEnding ? 'Saving…' : 'Save & End'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suppress warnings */}
        <span className="hidden">{rawToken}</span>
      </div>
    </ContentLoadingSpinner>
  )
}
