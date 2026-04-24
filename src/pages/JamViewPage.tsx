import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Radio, Users, ArrowRight, ListMusic } from 'lucide-react'
import type { JamViewPublicPayload } from '../models/JamSession'
import { createLogger } from '../utils/logger'

const log = createLogger('JamViewPage')

/**
 * Live-refresh interval for the anon view.
 *
 * The anon caller has no JWT and so cannot subscribe to
 * `postgres_changes` on `jam_sessions` (the `jam_sessions_select` RLS
 * policy is scoped `TO authenticated`, and realtime enforces RLS per
 * subscriber). HTTP polling against the edge function is the only path
 * that's already authenticated by the view-token pair.
 *
 * 5s balances "feels live for human-paced setlist edits" against
 * "doesn't hammer the edge function for a session sitting idle on a
 * guest's phone." The interval fires silently (no spinner) and keeps
 * the last-known-good payload on screen through any transient failure.
 */
const LIVE_POLL_INTERVAL_MS = 5_000

/**
 * JamViewPage — public/unauthenticated read-only view of a jam session.
 *
 * Accessed via: /jam/view/:shortCode?t={rawViewToken}
 *
 * Product intent (post-v0.3.1 rebuild): a guest sees essentially the same
 * content an authenticated participant sees — the host's curated broadcast
 * setlist. The old "Songs in Common" section was intentionally removed —
 * an anon viewer has no personal catalog, so they're neither a contributor
 * to nor a beneficiary of the match set.
 *
 * The page polls the edge function every {@link LIVE_POLL_INTERVAL_MS} to
 * pick up setlist edits from the host without requiring a page refresh.
 * Initial load shows a spinner; subsequent refreshes are silent.
 */
export const JamViewPage: React.FC = () => {
  const { shortCode } = useParams<{ shortCode: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('t') ?? ''

  const [payload, setPayload] = useState<JamViewPublicPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Timestamp of the most recent *successful* refresh. Powers the
  // "Live · updated Ns ago" indicator; also serves as a visible proof
  // that the poll loop is actually running.
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  // Tick every second so the "X ago" indicator re-renders without
  // needing a data change. Pulled out of the fetch effect so it's
  // independent of shortCode/token — the UI time display refreshes
  // on its own schedule.
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    if (!shortCode) {
      setError('Invalid jam session link')
      setLoading(false)
      return
    }

    // `cancelled` is a per-effect-invocation closure flag. React 18
    // StrictMode mounts → unmounts → remounts components in dev, so the
    // effect body runs twice with two separate closures (and two
    // separate `cancelled` flags). Any in-flight fetch from the first
    // mount reads its OWN `cancelled` (set to true by cleanup) and no-ops
    // its state updates; the second mount's fetch drives the actual UI.
    //
    // Note: we intentionally do NOT gate with a cross-mount ref
    // (`isFetchingRef`). A previous iteration did, and it caused the
    // second mount's fetch to early-return because the first mount's
    // fetch hadn't finished yet — leaving `loading=true` forever in
    // dev. The poll interval is 10s; overlap is harmless and setState
    // idempotent, so there's nothing to guard against here.
    let cancelled = false

    const fetchSession = async (silent: boolean) => {
      try {
        // Construct Edge Function URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        if (!supabaseUrl) {
          // In development without Supabase, show a placeholder so the
          // page can still be exercised locally. The demo payload only
          // populates `setlist` — there is no `matches` surface to demo.
          if (cancelled) return
          setPayload({
            sessionName: 'Demo Jam Session',
            hostDisplayName: 'Host',
            participantCount: 2,
            setlist: [
              { displayTitle: 'Wonderwall', displayArtist: 'Oasis' },
              {
                displayTitle: 'Bohemian Rhapsody',
                displayArtist: 'Queen',
              },
              {
                displayTitle: 'Black Parade',
                displayArtist: 'My Chemical Romance',
              },
            ],
          })
          setLastUpdatedAt(Date.now())
          if (!silent) setLoading(false)
          return
        }

        // Cache-buster: append a monotonically-changing query param so no
        // intermediate cache (service worker, browser disk cache, CDN
        // node) can return a stale snapshot even if our `no-store` hint
        // is ignored. Also send `cache: 'no-store'` on the Request so
        // the browser's HTTP cache skips the entry entirely.
        const ts = Date.now()
        const url = `${supabaseUrl}/functions/v1/jam-view?code=${shortCode}&t=${encodeURIComponent(token)}&_=${ts}`
        const startedAt = performance.now()
        const response = await fetch(url, { cache: 'no-store' })

        if (cancelled) return

        if (response.status === 404) {
          log.warn('poll 404 — session not found', { shortCode, silent })
          setError('This jam session was not found or the link has expired.')
          return
        }
        if (response.status === 410) {
          log.warn('poll 410 — session expired', { shortCode, silent })
          setError('This jam session has expired.')
          return
        }
        if (!response.ok) {
          log.warn('poll non-ok', {
            shortCode,
            silent,
            status: response.status,
          })
          setError(
            'Unable to load jam session. Please check the link and try again.'
          )
          return
        }

        const data = (await response.json()) as JamViewPublicPayload
        if (cancelled) return
        log.debug('poll ok', {
          silent,
          ms: Math.round(performance.now() - startedAt),
          setlistLen: data.setlist?.length ?? 0,
          participants: data.participantCount,
        })
        // Successful refresh — clear any prior transient error that a
        // flaky poll may have produced.
        setError(null)
        setPayload(data)
        setLastUpdatedAt(Date.now())
      } catch (err) {
        if (cancelled) return
        // Swallow network errors on silent refreshes so the last-known-
        // good payload stays on screen — but LOG them so we're not
        // silently stuck if the poll starts failing in prod.
        log.warn('poll exception', { silent, err: (err as Error).message })
        if (!silent) {
          setError('Unable to connect. Please check your internet connection.')
        }
      } finally {
        // Only clear loading if this effect is still the active one.
        // A cancelled fetch (StrictMode first-mount cleanup, or a
        // subsequent prop change) lets its setState be a no-op against
        // the stale closure; the live mount's fetch will drive the UI.
        if (!silent && !cancelled) setLoading(false)
      }
    }

    // Initial load (loud — shows spinner) + a poll loop (silent — never
    // flashes the spinner, never hides content during a transient failure).
    void fetchSession(false)
    const intervalId = window.setInterval(() => {
      log.debug('poll tick', { shortCode })
      void fetchSession(true)
    }, LIVE_POLL_INTERVAL_MS)
    log.debug('poll loop started', {
      shortCode,
      intervalMs: LIVE_POLL_INTERVAL_MS,
    })

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      log.debug('poll loop stopped', { shortCode })
    }
  }, [shortCode, token])

  // Re-render the "updated Ns ago" indicator every second. This is
  // decoupled from the poll loop so the text stays fresh even if a
  // poll is in flight / just failed.
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const handleSignUp = () => {
    navigate(`/auth?view=signup&redirect=/jam/${shortCode}`)
  }

  const setlist = payload?.setlist ?? []

  // Small relative-time formatter. Covered cases:
  //   - null / 0 seconds → "just now" (avoid showing 0s tick-noise)
  //   - < 60s → "Xs ago"
  //   - otherwise → "Xm ago"
  // Hand-rolled (not a library) because the anon page must stay on the
  // zero-dependency fetch path — no repository / supabase-js imports.
  const formatAgo = (then: number | null, now: number): string => {
    if (then == null) return 'connecting…'
    const elapsed = Math.max(0, Math.floor((now - then) / 1000))
    if (elapsed < 2) return 'just now'
    if (elapsed < 60) return `${elapsed}s ago`
    const m = Math.floor(elapsed / 60)
    return `${m}m ago`
  }

  return (
    <div
      data-testid="jam-view-page"
      className="min-h-screen bg-[#0a0a0a] flex flex-col"
    >
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-[#c4340a] rounded-lg flex items-center justify-center">
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
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                <div className="flex items-center gap-2 text-primary text-sm mb-2">
                  <Radio size={16} />
                  <span>Live Jam Session</span>
                  {/* Visible confirmation that the poll loop is running.
                      If this timestamp stops advancing, polling has
                      stalled — an observable failure mode, not a silent
                      one. */}
                  <span
                    data-testid="jam-view-last-updated"
                    className="text-[#707070] text-xs"
                    title="This page refreshes automatically every few seconds"
                  >
                    · updated {formatAgo(lastUpdatedAt, nowTick)}
                  </span>
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
                    {payload.participantCount}{' '}
                    {payload.participantCount === 1
                      ? 'participant'
                      : 'participants'}
                  </span>
                </div>
              </div>

              {/* Broadcast setlist — the primary content of the anon view.
                  Always rendered (even when empty) so the guest has a
                  stable "this is what the host is queuing" surface that
                  updates live as the host edits. The common-songs list
                  that appears on the authenticated view is intentionally
                  omitted — see JamViewPublicPayload docs for rationale. */}
              <div data-testid="jam-view-setlist">
                <h2 className="text-[#a0a0a0] text-sm font-medium uppercase tracking-wide mb-4 flex items-center gap-2">
                  <ListMusic size={14} />
                  Tonight's Setlist
                </h2>
                {setlist.length === 0 ? (
                  <div
                    data-testid="jam-view-setlist-empty"
                    className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-6 py-10 text-center"
                  >
                    <ListMusic size={32} className="mx-auto mb-3 text-[#555]" />
                    <p className="text-[#a0a0a0] text-sm font-medium mb-1">
                      Host hasn't added any songs yet
                    </p>
                    <p className="text-[#707070] text-xs">
                      This page will update automatically as the setlist fills
                      in.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {setlist.map((item, idx) => (
                      <li
                        key={`${item.displayTitle}-${idx}`}
                        className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3"
                        data-testid={`jam-view-setlist-item-${idx}`}
                      >
                        <span className="text-primary font-mono text-sm w-6 shrink-0">
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
                )}
              </div>

              {/* CTA */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
                <h3 className="text-white font-bold text-xl mb-2">
                  Want to join this jam?
                </h3>
                <p className="text-[#a0a0a0] text-sm mb-6">
                  Sign up free to add your songs to the mix and jam along with
                  the band.
                </p>
                <button
                  data-testid="jam-view-signup-cta"
                  onClick={handleSignUp}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-[#e53d01] transition-colors"
                >
                  Sign up free
                  <ArrowRight size={16} />
                </button>
                <p className="text-[#555] text-xs mt-4">
                  Already have an account?{' '}
                  <button
                    onClick={() => navigate(`/auth?redirect=/jam/${shortCode}`)}
                    className="text-primary hover:underline"
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
