import { useEffect, useState } from 'react'
import { AlertTriangle, Search, Share2 } from 'lucide-react'
import { Button, Segmented, Sheet } from '../ui'
import { useToast } from '../../contexts/ToastContext'
import { PersonAvatar } from './PersonAvatar'
import { copyText, friendCodeLink } from './share'
import type { FriendSearchResult } from '../../models/Friend'
import type { SendResult } from '../../services/FriendService'

type Mode = 'name' | 'code'
type Relation = 'friend' | 'sent' | 'incoming' | 'none'

const smallBtn = '!h-9 !px-3.5 !text-[13px]'

const fieldCls =
  'flex items-center gap-2 h-12 rounded-[14px] bg-bg-3 px-3.5 my-2.5 focus-within:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]'

/**
 * Add a friend: a sheet on phones, a centred dialog on desktop. By name
 * (findable people, debounced, 2+ chars) or by friend code, and your own code
 * one tap away to share.
 */
export function AddFriendSheet({
  onClose,
  myCode,
  initialCode = '',
  relationOf,
  search,
  send,
}: {
  onClose: () => void
  myCode: string
  /** From a shared link (`/friends?code=`): opens on Friend code, filled in. */
  initialCode?: string
  relationOf: (userId: string) => Relation
  search: (query: string) => Promise<FriendSearchResult[]>
  send: (target: { userId?: string; code?: string }) => Promise<SendResult>
}) {
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>(initialCode ? 'code' : 'name')
  const [query, setQuery] = useState('')
  const [code, setCode] = useState(initialCode)
  const [results, setResults] = useState<FriendSearchResult[] | null>(null)
  const [searchFailed, setSearchFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Debounced name search.
  const q = query.trim()
  useEffect(() => {
    setError(null)
    if (q.length < 2) {
      setResults(null)
      setSearchFailed(false)
      return
    }
    let stale = false
    const t = setTimeout(() => {
      search(q)
        .then(r => {
          if (stale) return
          setResults(r)
          setSearchFailed(false)
        })
        .catch(() => {
          if (stale) return
          setResults(null)
          setSearchFailed(true)
        })
    }, 300)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [q, search, attempt])

  const confirmed = (res: SendResult & { ok: true }) =>
    showToast(
      res.accepted
        ? `You and ${res.name} are now friends`
        : `Request sent to ${res.name}`,
      'success'
    )

  const addPerson = async (p: FriendSearchResult) => {
    setBusy(p.userId)
    setError(null)
    const res = await send({ userId: p.userId })
    setBusy(null)
    if (res.ok) confirmed(res)
    else setError(res.error)
  }

  const sendCode = async () => {
    if (!code.trim()) return
    setBusy('code')
    setError(null)
    const res = await send({ code })
    setBusy(null)
    if (res.ok) {
      confirmed(res)
      onClose()
    } else setError(res.error)
  }

  const shareMine = async () => {
    const link = friendCodeLink(myCode)
    const ok = await copyText(link)
    showToast(
      ok ? 'Link copied' : "Couldn't copy. Share your code instead.",
      ok ? 'success' : 'error'
    )
  }

  const errorNote = error && (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-2xl bg-bg-3 px-3.5 py-3 mb-2 text-sm text-ink-1"
      data-testid="add-friend-error"
    >
      <AlertTriangle size={17} className="text-warn shrink-0 mt-px" />
      <span>{error}</span>
    </div>
  )

  const trailFor = (p: FriendSearchResult) => {
    const rel = relationOf(p.userId)
    if (rel === 'friend' || rel === 'sent')
      return (
        <span className="font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 px-2">
          {rel === 'friend' ? 'Friends' : 'Requested'}
        </span>
      )
    return (
      <Button
        variant="primary"
        className={smallBtn}
        disabled={busy === p.userId}
        onClick={() => void addPerson(p)}
        data-testid={`add-friend-add-${p.userId}`}
      >
        {rel === 'incoming' ? 'Accept' : 'Add'}
      </Button>
    )
  }

  return (
    <Sheet
      onClose={onClose}
      title="Add a friend"
      data-testid="add-friend-sheet"
    >
      <Segmented<Mode>
        value={mode}
        onChange={m => {
          setMode(m)
          setError(null)
        }}
        options={[
          { value: 'name', label: 'By name' },
          { value: 'code', label: 'Friend code' },
        ]}
        label="Add by"
        data-testid="add-friend-mode"
      />

      {mode === 'name' ? (
        <>
          <label className={fieldCls}>
            <Search size={17} className="text-ink-3 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name"
              name="friendSearch"
              id="add-friend-search"
              aria-label="Search by name"
              autoComplete="off"
              data-testid="add-friend-search-input"
              className="flex-1 min-w-0 bg-transparent text-[15px] text-ink-1 placeholder:text-ink-4 outline-none"
            />
          </label>
          {errorNote}
          {searchFailed ? (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-2xl bg-bg-3 px-4 py-3 text-sm text-ink-1"
              data-testid="add-friend-search-error"
            >
              <AlertTriangle size={17} className="text-warn shrink-0" />
              <span className="flex-1">Couldn't search.</span>
              <Button
                className={smallBtn}
                onClick={() => setAttempt(a => a + 1)}
                data-testid="add-friend-search-retry"
              >
                Retry
              </Button>
            </div>
          ) : results && results.length > 0 ? (
            <div
              className="rounded-[20px] overflow-hidden bg-bg-1 divide-y divide-divider"
              data-testid="add-friend-results"
            >
              {results.map(p => {
                const sub = [
                  p.instruments.slice(0, 2).join(', '),
                  p.mutualCount > 0 ? `${p.mutualCount} mutual` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div
                    key={p.userId}
                    className="flex items-center gap-3 min-h-[60px] py-2 pl-3.5 pr-2.5"
                    data-testid={`add-friend-result-${p.userId}`}
                  >
                    <PersonAvatar name={p.name} color={p.color} />
                    <span className="flex-1 min-w-0">
                      <b className="block text-[15px] font-semibold text-ink-1 truncate">
                        {p.name}
                      </b>
                      {sub && (
                        <small className="block text-[12.5px] text-ink-3 truncate">
                          {sub}
                        </small>
                      )}
                    </span>
                    {trailFor(p)}
                  </div>
                )
              })}
            </div>
          ) : results ? (
            <div
              className="px-1 py-2 text-[13.5px] text-ink-3"
              data-testid="add-friend-no-results"
            >
              No one findable by that name.{' '}
              <button
                type="button"
                onClick={() => setMode('code')}
                className="font-semibold text-accent-ink"
                data-testid="add-friend-use-code"
              >
                Ask for their code instead.
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label className={`${fieldCls} flex-1`}>
              <input
                autoFocus
                value={code}
                onChange={e => {
                  setCode(e.target.value.toUpperCase())
                  setError(null)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') void sendCode()
                }}
                placeholder="e.g. DANA2345"
                name="friendCode"
                id="add-friend-code"
                aria-label="Friend code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                data-testid="add-friend-code-input"
                className="flex-1 min-w-0 bg-transparent font-mono text-[16px] tracking-[.12em] text-ink-1 placeholder:text-ink-4 placeholder:tracking-normal outline-none"
              />
            </label>
            <Button
              variant="primary"
              size="lg"
              disabled={!code.trim() || busy === 'code'}
              onClick={() => void sendCode()}
              data-testid="add-friend-code-send"
            >
              Send
            </Button>
          </div>
          {errorNote}
        </>
      )}

      <p className="mx-1 mt-4 mb-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3">
        Not findable? Ask for their code · or share yours
      </p>
      <button
        type="button"
        onClick={() => void shareMine()}
        disabled={!myCode}
        className="flex items-center gap-3 w-full min-h-14 py-2 px-3.5 mb-2 rounded-[20px] bg-bg-1 text-left hover:bg-bg-3 disabled:opacity-50"
        data-testid="add-friend-share-code"
      >
        <Share2 size={18} className="text-ink-3 shrink-0" />
        <span className="flex-1 min-w-0">
          <b className="block text-[15px] font-semibold text-ink-1">
            Share my code
          </b>
          <small className="block text-[12.5px] text-ink-3 truncate font-mono">
            {myCode ? friendCodeLink(myCode).replace(/^https?:\/\//, '') : ''}
          </small>
        </span>
      </button>
      <div className="hidden md:flex justify-end pt-2 pb-5">
        <Button
          variant="primary"
          onClick={onClose}
          data-testid="add-friend-done"
        >
          Done
        </Button>
      </div>
    </Sheet>
  )
}
