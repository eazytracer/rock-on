import { Suspense, lazy, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  UserPlus,
  Check,
  X,
  Copy,
  UserMinus,
  QrCode,
  Clock,
  Users,
  Search,
  Shield,
} from 'lucide-react'
import { useFriends } from '../hooks/useFriends'
import { useToast } from '../contexts/ToastContext'
import { Avatar } from '../components/common/Avatar'
import { Eyebrow } from '../components/common/Eyebrow'
import { EmptyState } from '../components/common/EmptyState'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { Dropdown } from '../components/common/Dropdown'
import type { FriendRequestPolicy, FriendSearchResult } from '../models/Friend'

const POLICY_OPTIONS: { value: FriendRequestPolicy; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends_of_friends', label: 'Friends of friends' },
  { value: 'code_only', label: 'Code only' },
]

// Lazy-load the QR renderer so qrcode.react stays out of the main bundle.
const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(mod => ({ default: mod.QRCodeSVG }))
)

/**
 * Friends (mobile-redesign-port P11).
 * Friends list · incoming requests · add-by-code · your friend code + discovery toggle.
 */
export function FriendsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const {
    friends,
    incoming,
    outgoing,
    profile,
    loading,
    accept,
    decline,
    unfriend,
    sendToCode,
    sendToUser,
    searchByName,
    setDiscoverable,
    setPolicy,
  } = useFriends()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [results, setResults] = useState<FriendSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  // Prefill the add-a-friend code when arriving via a shared QR / link
  // (`/friends?code=XXXX`).
  useEffect(() => {
    const shared = searchParams.get('code')
    if (shared) setCode(shared.toUpperCase())
  }, [searchParams])

  // Debounced find-by-name search of discoverable people.
  useEffect(() => {
    const q = nameQuery.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      void searchByName(q).then(r => {
        setResults(r)
        setSearching(false)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [nameQuery, searchByName])

  // Annotate a search result with the caller's existing relationship, so we
  // show "Friends"/"Sent"/"Respond" instead of a redundant Add button.
  const friendIds = new Set(friends.map(f => f.userId))
  const sentIds = new Set(outgoing.map(r => r.userId))
  const incomingIds = new Set(incoming.map(r => r.userId))
  const statusFor = (userId: string): 'friend' | 'sent' | 'incoming' | 'add' =>
    friendIds.has(userId)
      ? 'friend'
      : sentIds.has(userId)
        ? 'sent'
        : incomingIds.has(userId)
          ? 'incoming'
          : 'add'

  const handleAddUser = async (r: FriendSearchResult) => {
    setAddingId(r.userId)
    const res = await sendToUser(r.userId)
    setAddingId(null)
    showToast(
      res.ok
        ? `Friend request sent to ${res.name}`
        : (res.error ?? 'Could not send request'),
      res.ok ? 'success' : 'error'
    )
  }

  const qrValue = profile?.friendCode
    ? `${window.location.origin}/friends?code=${profile.friendCode}`
    : ''

  const handleAdd = async () => {
    if (!code.trim()) return
    setSending(true)
    const res = await sendToCode(code)
    setSending(false)
    if (res.ok) {
      showToast(`Friend request sent to ${res.name}`, 'success')
      setCode('')
    } else {
      showToast(res.error ?? 'Could not send request', 'error')
    }
  }

  const copyCode = () => {
    if (profile?.friendCode) {
      void navigator.clipboard?.writeText(profile.friendCode)
      showToast('Friend code copied', 'success')
    }
  }

  return (
    <div data-testid="friends-page" className="max-w-5xl">
      <button
        onClick={() => navigate(-1)}
        data-testid="friends-back"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink-1"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-bold text-ink-1">Friends</h1>

      <ContentLoadingSpinner isLoading={loading}>
        <div className="mt-5 flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
          {/* Right rail (top on mobile, right column on desktop):
              your friend code + add-a-friend */}
          <aside className="flex flex-col gap-6 lg:col-start-3 lg:row-start-1">
            {/* Your friend code + discoverability */}
            <div
              className="rounded-2xl bg-bg-1 border border-border-1 p-4"
              data-testid="friends-my-code"
            >
              <Eyebrow className="mb-2">Your friend code</Eyebrow>
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-xl font-bold tracking-widest text-ink-1"
                  data-testid="friends-code-value"
                >
                  {profile?.friendCode || '––––––––'}
                </span>
                <button
                  onClick={copyCode}
                  data-testid="friends-copy-code"
                  className="rounded-lg p-2 text-ink-3 hover:text-ink-1 hover:bg-bg-3"
                  aria-label="Copy friend code"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => setShowQR(v => !v)}
                  data-testid="friends-qr-toggle"
                  aria-pressed={showQR}
                  aria-label="Show QR code"
                  className={`rounded-lg p-2 hover:bg-bg-3 ${
                    showQR ? 'text-accent' : 'text-ink-3 hover:text-ink-1'
                  }`}
                >
                  <QrCode size={16} />
                </button>
              </div>

              {showQR && qrValue && (
                <div
                  className="mt-3 flex flex-col items-center gap-2"
                  data-testid="friends-qr"
                >
                  <Suspense
                    fallback={
                      <div className="h-[168px] w-[168px] animate-pulse rounded-xl bg-bg-3" />
                    }
                  >
                    <div className="rounded-xl bg-white p-3">
                      <QRCodeSVG value={qrValue} size={168} level="M" />
                    </div>
                  </Suspense>
                  <span className="text-xs text-ink-5">
                    Scan to add {profile?.friendCode}
                  </span>
                </div>
              )}
              <label className="mt-3 flex items-center justify-between">
                <span className="text-sm text-ink-3">
                  Discoverable by name
                  <span className="block text-xs text-ink-5">
                    {profile?.discoverable
                      ? 'Others can find you by name'
                      : 'Hidden — reachable by code only'}
                  </span>
                </span>
                <button
                  onClick={() => void setDiscoverable(!profile?.discoverable)}
                  data-testid="friends-discoverable-toggle"
                  aria-pressed={!!profile?.discoverable}
                  className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                    profile?.discoverable ? 'bg-accent' : 'bg-bg-4'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      profile?.discoverable ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>

              <div className="mt-3 border-t border-border-1 pt-3">
                <Eyebrow className="mb-1.5">Who can add you</Eyebrow>
                <Dropdown
                  value={profile?.policy ?? 'everyone'}
                  onChange={v => void setPolicy(v as FriendRequestPolicy)}
                  data-testid="friends-policy-dropdown"
                  groups={[
                    { label: 'Who can add you', options: POLICY_OPTIONS },
                  ]}
                />
              </div>
            </div>

            {/* Add a friend — by code or by name */}
            <div data-testid="friends-add">
              <Eyebrow className="mb-2">Add a friend</Eyebrow>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter friend code"
                  name="friendCode"
                  id="friend-code-input"
                  data-testid="friends-add-input"
                  className="flex-1 rounded-lg bg-bg-1 border border-border-1 px-3 py-2 font-mono text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
                />
                <button
                  onClick={handleAdd}
                  disabled={sending || !code.trim()}
                  data-testid="friends-add-button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent disabled:opacity-50"
                >
                  <UserPlus size={16} /> Send
                </button>
              </div>

              {/* Find people by name (discoverable profiles only) */}
              <div className="mt-3">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
                  />
                  <input
                    value={nameQuery}
                    onChange={e => setNameQuery(e.target.value)}
                    placeholder="Find people by name"
                    name="friendSearch"
                    id="friend-search-input"
                    data-testid="friends-search-input"
                    className="w-full rounded-lg bg-bg-1 border border-border-1 pl-9 pr-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
                  />
                </div>

                {nameQuery.trim().length >= 2 && (
                  <>
                    <div
                      className="mt-2 flex flex-col gap-2"
                      data-testid="friends-search-results"
                    >
                      {searching ? (
                        <div className="px-1 py-2 text-xs text-ink-5">
                          Searching…
                        </div>
                      ) : results.length === 0 ? (
                        <div className="px-1 py-2 text-xs text-ink-5">
                          No discoverable people found.
                        </div>
                      ) : (
                        results.map(r => {
                          const status = statusFor(r.userId)
                          return (
                            <div
                              key={r.userId}
                              className="flex items-center gap-2.5 rounded-xl bg-bg-1 border border-border-1 p-2.5"
                              data-testid={`friend-search-${r.userId}`}
                            >
                              <Avatar label={r.name} size="sm" />
                              <span className="flex-1 truncate text-sm font-medium text-ink-1">
                                {r.name}
                              </span>
                              {status === 'add' ? (
                                <button
                                  onClick={() => void handleAddUser(r)}
                                  disabled={addingId === r.userId}
                                  data-testid={`friend-search-add-${r.userId}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent disabled:opacity-50"
                                >
                                  <UserPlus size={14} /> Add
                                </button>
                              ) : (
                                <span className="px-2 text-xs text-ink-5">
                                  {status === 'friend'
                                    ? 'Friends'
                                    : status === 'sent'
                                      ? 'Sent'
                                      : 'In requests'}
                                </span>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-bg-2 border border-border-1 px-2.5 py-2">
                      <Shield
                        size={13}
                        className="mt-0.5 flex-shrink-0 text-ink-4"
                      />
                      <span className="text-xs text-ink-5 leading-snug">
                        Private profiles won't show — ask for a code or QR.
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* Main column: requests, sent, and the friends list */}
          <div className="flex flex-col gap-6 lg:col-span-2 lg:col-start-1 lg:row-start-1">
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <div>
                <Eyebrow className="mb-2">Requests ({incoming.length})</Eyebrow>
                <div
                  className="flex flex-col gap-2"
                  data-testid="friends-incoming"
                >
                  {incoming.map(req => (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3"
                      data-testid={`friend-request-${req.id}`}
                    >
                      <Avatar label={req.name} size="sm" />
                      <span className="flex-1 truncate font-medium text-ink-1">
                        {req.name}
                      </span>
                      <button
                        onClick={() => void accept(req.id)}
                        data-testid={`friend-accept-${req.id}`}
                        aria-label="Accept"
                        className="rounded-lg bg-accent-soft p-2 text-accent hover:brightness-110"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => void decline(req.id)}
                        data-testid={`friend-decline-${req.id}`}
                        aria-label="Decline"
                        className="rounded-lg p-2 text-ink-4 hover:text-ink-1 hover:bg-bg-3"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sent (outgoing) requests — pending until the other person accepts */}
            {outgoing.length > 0 && (
              <div>
                <Eyebrow className="mb-2">Sent ({outgoing.length})</Eyebrow>
                <div
                  className="flex flex-col gap-2"
                  data-testid="friends-outgoing"
                >
                  {outgoing.map(req => (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3"
                      data-testid={`friend-sent-${req.id}`}
                    >
                      <Avatar label={req.name} size="sm" />
                      <span className="flex-1 truncate font-medium text-ink-1">
                        {req.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-bg-3 px-2.5 py-1.5 text-xs font-medium text-ink-4">
                        <Clock size={13} /> Pending
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div>
              <Eyebrow className="mb-2">Friends ({friends.length})</Eyebrow>
              {friends.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No friends yet"
                  description="Share your friend code or add someone by theirs."
                  size="md"
                />
              ) : (
                <div className="flex flex-col gap-2" data-testid="friends-list">
                  {friends.map(f => (
                    <div
                      key={f.friendshipId}
                      className="group flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3"
                      data-testid={`friend-${f.friendshipId}`}
                    >
                      <Avatar label={f.name} size="sm" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium text-ink-1">
                          {f.name}
                        </span>
                        {f.sharedBands > 0 && (
                          <span className="block truncate text-xs text-ink-5">
                            {f.sharedBands} shared band
                            {f.sharedBands === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => void unfriend(f.friendshipId)}
                        data-testid={`friend-remove-${f.friendshipId}`}
                        aria-label="Remove friend"
                        className="rounded-lg p-2 text-ink-5 hover:text-danger hover:bg-bg-3"
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentLoadingSpinner>
    </div>
  )
}
