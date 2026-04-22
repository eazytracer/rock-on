import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Radio, Music, Users, ArrowRight, ListMusic } from 'lucide-react'
import { JamMatchList } from '../components/jam/JamMatchList'
import type { JamViewPublicPayload } from '../models/JamSession'

/**
 * JamViewPage — public/unauthenticated read-only view of a jam session.
 *
 * Accessed via: /jam/view/:shortCode?t={rawViewToken}
 *
 * This page fetches session data from the Edge Function (no auth required).
 * It shows the matched songs and a CTA to sign up and join the session.
 */
export const JamViewPage: React.FC = () => {
  const { shortCode } = useParams<{ shortCode: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('t') ?? ''

  const [payload, setPayload] = useState<JamViewPublicPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shortCode) {
      setError('Invalid jam session link')
      setLoading(false)
      return
    }

    const fetchSession = async () => {
      try {
        // Construct Edge Function URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        if (!supabaseUrl) {
          // In development without Supabase, show a placeholder
          setPayload({
            sessionName: 'Demo Jam Session',
            hostDisplayName: 'Host',
            participantCount: 2,
            matchCount: 3,
            matches: [
              {
                displayTitle: 'Wonderwall',
                displayArtist: 'Oasis',
                matchConfidence: 'exact',
              },
              {
                displayTitle: 'Black Parade',
                displayArtist: 'My Chemical Romance',
                matchConfidence: 'exact',
              },
              {
                displayTitle: 'Bohemian Rhapsody',
                displayArtist: 'Queen',
                matchConfidence: 'exact',
              },
            ],
            setlist: [
              { displayTitle: 'Wonderwall', displayArtist: 'Oasis' },
              {
                displayTitle: 'Bohemian Rhapsody',
                displayArtist: 'Queen',
              },
            ],
          })
          setLoading(false)
          return
        }

        const url = `${supabaseUrl}/functions/v1/jam-view?code=${shortCode}&t=${encodeURIComponent(token)}`
        const response = await fetch(url)

        if (response.status === 404) {
          setError('This jam session was not found or the link has expired.')
          return
        }
        if (response.status === 410) {
          setError('This jam session has expired.')
          return
        }
        if (!response.ok) {
          setError(
            'Unable to load jam session. Please check the link and try again.'
          )
          return
        }

        const data = (await response.json()) as JamViewPublicPayload
        setPayload(data)
      } catch {
        setError('Unable to connect. Please check your internet connection.')
      } finally {
        setLoading(false)
      }
    }

    void fetchSession()
  }, [shortCode, token])

  const handleSignUp = () => {
    navigate(`/auth?view=signup&redirect=/jam/${shortCode}`)
  }

  // Convert payload matches to JamSongMatch-like objects for JamMatchList
  const displayMatches = (payload?.matches ?? []).map((m, i) => ({
    id: `preview-${i}`,
    jamSessionId: shortCode ?? '',
    canonicalTitle: m.displayTitle.toLowerCase(),
    canonicalArtist: m.displayArtist.toLowerCase(),
    displayTitle: m.displayTitle,
    displayArtist: m.displayArtist,
    matchConfidence: m.matchConfidence,
    isConfirmed: true,
    matchedSongs: [],
    participantCount: payload?.participantCount ?? 2,
    computedAt: new Date(),
  }))

  return (
    <div
      data-testid="jam-view-page"
      className="min-h-screen bg-gray-900 flex flex-col"
    >
      {/* Header */}
      <header className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="text-white font-semibold">Rock On</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[#707070] text-sm">Loading jam session...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-20">
              <Radio
                size={48}
                className="mx-auto mb-4 text-[#707070] opacity-30"
              />
              <p className="text-[#707070] text-lg mb-2">
                Session not available
              </p>
              <p className="text-[#555] text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && payload && (
            <div className="space-y-8">
              {/* Session title */}
              <div>
                <div className="flex items-center gap-2 text-amber-400 text-sm mb-2">
                  <Radio size={16} />
                  <span>Live Jam Session</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {payload.sessionName}
                </h1>
                <div className="flex items-center gap-4 text-[#707070] text-sm">
                  <span>
                    Hosted by{' '}
                    <strong className="text-white">
                      {payload.hostDisplayName}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={13} />
                    {payload.participantCount} participants
                  </span>
                  <span className="flex items-center gap-1">
                    <Music size={13} />
                    {payload.matchCount} songs in common
                  </span>
                </div>
              </div>

              {/* Broadcast setlist (host-curated, read-only).
                  Shown when the host has added songs to the Setlist tab. */}
              {payload.setlist && payload.setlist.length > 0 && (
                <div data-testid="jam-view-setlist">
                  <h2 className="text-[#a0a0a0] text-sm font-medium uppercase tracking-wide mb-4 flex items-center gap-2">
                    <ListMusic size={14} />
                    Tonight's Setlist
                  </h2>
                  <ol className="space-y-2">
                    {payload.setlist.map((item, idx) => (
                      <li
                        key={`${item.displayTitle}-${idx}`}
                        className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3"
                        data-testid={`jam-view-setlist-item-${idx}`}
                      >
                        <span className="text-amber-400 font-mono text-sm w-6 shrink-0">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium truncate">
                            {item.displayTitle}
                          </p>
                          <p className="text-[#707070] text-xs truncate">
                            {item.displayArtist}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Match list (read-only) */}
              <div>
                <h2 className="text-[#a0a0a0] text-sm font-medium uppercase tracking-wide mb-4">
                  Songs in Common
                </h2>
                <JamMatchList
                  matches={displayMatches}
                  isHost={false}
                  readOnly={true}
                />
              </div>

              {/* CTA */}
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-8 text-center">
                <h3 className="text-white font-bold text-xl mb-2">
                  Want to join this jam?
                </h3>
                <p className="text-[#a0a0a0] text-sm mb-6">
                  Sign up free to add your songs, find more matches, and jam
                  together.
                </p>
                <button
                  data-testid="jam-view-signup-cta"
                  onClick={handleSignUp}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
                >
                  Sign up free
                  <ArrowRight size={16} />
                </button>
                <p className="text-[#555] text-xs mt-4">
                  Already have an account?{' '}
                  <button
                    onClick={() => navigate(`/auth?redirect=/jam/${shortCode}`)}
                    className="text-amber-400 hover:underline"
                  >
                    Log in
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
