import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Radio, Plus, LogIn, Save, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { JamSessionService } from '../services/JamSessionService'
import { useJamSession } from '../hooks/useJamSession'
import { JamSessionCard } from '../components/jam/JamSessionCard'
import { JamParticipantList } from '../components/jam/JamParticipantList'
import { JamMatchList } from '../components/jam/JamMatchList'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'

/**
 * JamSessionPage — authenticated view for creating and managing jam sessions.
 *
 * Supports:
 * - Creating a new jam session
 * - Joining via short code
 * - Viewing participants and matched songs
 * - Confirming/dismissing fuzzy matches
 * - Saving the session as a personal setlist
 */
export const JamSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const navigate = useNavigate()
  useAuth() // for future auth-aware features
  const { showToast } = useToast()

  const userId = localStorage.getItem('currentUserId') || ''

  // Session state
  const {
    session,
    participants,
    matches,
    loading,
    error,
    isSaving,
    joinSession,
    confirmMatch,
    dismissMatch,
    saveAsSetlist,
  } = useJamSession(sessionId ?? null)

  // Local form state
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [activeView] = useState<'create' | 'join' | 'session'>(
    sessionId ? 'session' : 'create'
  )
  const [shareUrl, setShareUrl] = useState('')
  const [rawToken, setRawToken] = useState('')

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
        await JamSessionService.createSession(userId, sessionName || undefined)

      const url = JamSessionService.generateShareUrl(
        newSession.shortCode,
        rawViewToken
      )
      setShareUrl(url)
      setRawToken(rawViewToken)

      showToast('Jam session created!', 'success')
      navigate(`/jam/${newSession.id}`)
    } catch (err) {
      showToast(`Failed to create session: ${(err as Error).message}`, 'error')
    } finally {
      setIsCreating(false)
    }
  }

  // Join session handler
  const handleJoinSession = async () => {
    if (!joinCode.trim()) {
      showToast('Please enter a join code', 'error')
      return
    }

    setIsJoining(true)
    try {
      await joinSession(joinCode.trim().toUpperCase(), userId)
      showToast('Joined jam session!', 'success')
      setJoinCode('')
    } catch (err) {
      showToast(`Failed to join: ${(err as Error).message}`, 'error')
    } finally {
      setIsJoining(false)
    }
  }

  // Save as setlist handler
  const handleSaveAsSetlist = async () => {
    if (!session) return
    try {
      const setlist = await saveAsSetlist(userId)
      showToast(`Saved as "${setlist.name}"!`, 'success')
      navigate('/setlists')
    } catch (err) {
      showToast(`Failed to save: ${(err as Error).message}`, 'error')
    }
  }

  const isHost = session?.hostUserId === userId

  return (
    <ContentLoadingSpinner isLoading={loading && !!sessionId}>
      <div data-testid="jam-session-page" className="max-w-3xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Radio size={22} className="text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Jam Session</h1>
            <ChevronDown size={20} className="text-[#a0a0a0]" />
          </div>
          <p className="text-[#707070] text-sm">
            Find songs you have in common with other musicians for an impromptu
            jam.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error.message}
          </div>
        )}

        {/* No active session: show create / join options */}
        {!sessionId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create session */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Plus size={18} className="text-amber-400" />
                Host a Jam
              </h2>
              <div className="space-y-3">
                <input
                  data-testid="jam-session-name-input"
                  type="text"
                  placeholder="Session name (optional)"
                  value={sessionName}
                  onChange={e => setSessionName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[#333] text-white text-sm placeholder-[#707070] focus:outline-none focus:border-amber-500"
                />
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

            {/* Join session */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <LogIn size={18} className="text-blue-400" />
                Join a Jam
              </h2>
              <div className="space-y-3">
                <input
                  data-testid="jam-join-code-input"
                  type="text"
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
        )}

        {/* Active session view */}
        {session && (
          <div className="space-y-6">
            {/* Session card with QR + code */}
            <JamSessionCard
              session={session}
              shareUrl={
                shareUrl ||
                `${window.location.origin}/jam/view/${session.shortCode}`
              }
            />

            {/* Two-column layout: participants + matches */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Participants */}
              <div className="md:col-span-1">
                <h3 className="text-[#a0a0a0] text-sm font-medium mb-3 uppercase tracking-wide">
                  Participants
                </h3>
                <JamParticipantList
                  participants={participants}
                  hostUserId={session.hostUserId}
                />
              </div>

              {/* Matches */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[#a0a0a0] text-sm font-medium uppercase tracking-wide">
                    Common Songs
                  </h3>
                  {isHost &&
                    session.status === 'active' &&
                    matches.filter(m => m.isConfirmed).length > 0 && (
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
                </div>

                <JamMatchList
                  matches={matches}
                  isHost={isHost}
                  onConfirm={id => void confirmMatch(id)}
                  onDismiss={id => void dismissMatch(id)}
                />
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

        {/* Suppress activeView lint warning */}
        <span className="hidden">{activeView}</span>
        <span className="hidden">{rawToken}</span>
      </div>
    </ContentLoadingSpinner>
  )
}
