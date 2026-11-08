/* eslint-disable react-refresh/only-export-components */
/**
 * Global search (Core Navigation 7; desktop ⌘K). Scoped to the current context
 * with a way to widen to every context. Songs, setlists, and calendar items
 * (shows, practices, jams) by name or by a song in their set / lineup. Enter
 * opens the first hit.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Search, ListMusic, ChevronRight, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSwitchPrompt } from '../../contexts/SwitchPromptContext'
import { useSearch } from '../../hooks/useSearch'
import type { SearchHit } from '../../services/api/search'
import { formatSeconds, splitMatch } from '../../domain/format'
import { TuningPill } from '../ui/TuningPill'
import { TypeLabel } from '../ui/TypeLabel'
import { Chip } from '../ui/Chip'

type Filter = 'all' | 'songs' | 'setlists' | 'calendar'

const KIND_PATH: Record<string, (id: string) => string> = {
  song: id => `/songs?song=${id}`,
  setlist: id => `/setlists/${id}`,
  show: id => `/shows/${id}`,
  practice: id => `/practices/${id}`,
  jam: id => `/events/${id}`,
}
const KIND_WORD: Record<string, string> = {
  song: 'This song',
  setlist: 'This setlist',
  show: 'This show',
  practice: 'This practice',
  jam: 'This jam',
}
const isCalendar = (k: string) =>
  k === 'show' || k === 'practice' || k === 'jam'

interface SearchContextValue {
  openSearch: () => void
}
const SearchContext = createContext<SearchContextValue | undefined>(undefined)

export function useGlobalSearch(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx)
    throw new Error('useGlobalSearch must be used within SearchProvider')
  return ctx
}

/** Holds the overlay and binds ⌘K / Ctrl+K. */
export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false)
  const openSearch = useCallback(() => setOpen(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <SearchContext.Provider value={{ openSearch }}>
      {children}
      {open && <SearchOverlay onClose={() => setOpen(false)} />}
    </SearchContext.Provider>
  )
}

const Highlight: React.FC<{ text: string; query: string }> = ({
  text,
  query,
}) => (
  <>
    {splitMatch(text, query).map((p, i) =>
      p.match ? (
        <span key={i} className="text-accent-ink">
          {p.text}
        </span>
      ) : (
        <React.Fragment key={i}>{p.text}</React.Fragment>
      )
    )}
  </>
)

export const SearchOverlay: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { currentBandId, currentBand, contextType } = useAuth()
  const { openIn } = useSwitchPrompt()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [all, setAll] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data, isFetching } = useSearch(query, currentBandId, all)
  const contextName =
    contextType === 'band' ? (currentBand?.name ?? '') : 'Personal'

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const hits = useMemo(() => {
    const list = query.trim() ? (data ?? []) : []
    // Current context first when searching everywhere.
    return [...list].sort(
      (a, b) =>
        Number(b.band_id === currentBandId) -
        Number(a.band_id === currentBandId)
    )
  }, [data, query, currentBandId])

  const songs = hits.filter(h => h.kind === 'song')
  const setlists = hits.filter(h => h.kind === 'setlist')
  const calendar = hits.filter(h => isCalendar(h.kind))
  const groups: { key: Filter; label: string; items: SearchHit[] }[] = [
    { key: 'songs', label: 'Songs', items: songs },
    { key: 'setlists', label: 'Setlists', items: setlists },
    { key: 'calendar', label: 'Calendar', items: calendar },
  ]
  const visible = groups.filter(
    g => g.items.length > 0 && (filter === 'all' || filter === g.key)
  )

  const open = (h: SearchHit) => {
    onClose()
    openIn({
      bandId: h.band_id,
      name: h.context_name,
      path: KIND_PATH[h.kind](h.id),
      what: KIND_WORD[h.kind],
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const first = visible[0]?.items[0]
    if (first) open(first)
  }

  const showContext = all

  return (
    <div
      className="fixed inset-0 z-[65] bg-bg-1 md:bg-[var(--scrim)] md:flex md:items-start md:justify-center md:pt-[12vh]"
      onClick={e => e.target === e.currentTarget && onClose()}
      data-testid="search-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="h-full md:h-auto md:max-h-[72vh] w-full md:w-[640px] flex flex-col bg-bg-1 md:bg-bg-2 md:rounded-[22px] md:shadow-float md:ring-1 md:ring-border-1 overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <form onSubmit={onSubmit} className="flex items-center gap-2 p-3">
          <label
            htmlFor="global-search-input"
            className="flex-1 flex items-center gap-2.5 h-12 px-4 rounded-full bg-bg-3 ring-2 ring-accent"
          >
            <Search size={18} className="text-ink-3 shrink-0" />
            <input
              ref={inputRef}
              id="global-search-input"
              name="globalSearch"
              data-testid="global-search-input"
              type="search"
              autoComplete="off"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${contextName}`}
              className="flex-1 min-w-0 bg-transparent text-[16px] text-ink-1 placeholder:text-ink-4 outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear"
                className="text-ink-3"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={onClose}
            data-testid="global-search-cancel"
            className="h-12 px-2 text-[15px] font-semibold text-ink-1"
          >
            Cancel
          </button>
        </form>

        {query.trim() && (
          <div className="flex gap-2 px-3 pb-2 overflow-x-auto scrollbar-none">
            {(
              [
                ['all', 'All'],
                ['songs', 'Songs'],
                ['setlists', 'Setlists'],
                ['calendar', 'Calendar'],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <Chip
                key={key}
                on={filter === key}
                onClick={() => setFilter(key)}
                data-testid={`global-search-filter-${key}`}
              >
                {label}
              </Chip>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar-thin pb-6">
          {visible.map(g => (
            <section key={g.key} data-testid={`global-search-group-${g.key}`}>
              <p className="px-4 pt-3 pb-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3">
                {g.label} · {g.items.length}
              </p>
              <div className="mx-3 rounded-[18px] bg-bg-2 md:bg-bg-3 overflow-hidden">
                {g.items.map(h => (
                  <button
                    key={`${h.kind}-${h.id}`}
                    onClick={() => open(h)}
                    data-testid={`global-search-hit-${h.kind}-${h.id}`}
                    className="w-full flex items-center gap-3 min-h-[52px] px-4 py-2 text-left border-b border-divider last:border-0 hover:bg-bg-3/60"
                  >
                    <HitBody h={h} query={query} showContext={showContext} />
                  </button>
                ))}
              </div>
            </section>
          ))}

          {query.trim() && !isFetching && visible.length === 0 && (
            <p
              className="px-4 py-6 text-[15px] text-ink-3"
              data-testid="global-search-empty"
            >
              Nothing matches “{query.trim()}”
              {all ? '.' : ` in ${contextName}.`}
            </p>
          )}

          {query.trim() && !all && (
            <p className="px-4 pt-4 font-mono text-[12px] text-ink-3">
              Searching {contextName}.{' '}
              <button
                onClick={() => setAll(true)}
                data-testid="global-search-all-contexts"
                className="text-accent-ink font-semibold"
              >
                Search all contexts
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const HitBody: React.FC<{
  h: SearchHit
  query: string
  showContext: boolean
}> = ({ h, query, showContext }) => {
  const ctx = showContext ? h.context_name : null
  if (h.kind === 'song') {
    return (
      <>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-[15px] font-bold text-ink-1">
            <Highlight text={h.title} query={query} />
          </span>
          {(h.subtitle || ctx) && (
            <span className="block truncate text-[12.5px] text-ink-3">
              {[h.subtitle, ctx].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        {h.tuning && <TuningPill tuning={h.tuning} size="sm" />}
        <span className="w-11 text-right font-mono text-[13px] text-ink-2">
          {formatSeconds(h.duration)}
        </span>
      </>
    )
  }
  if (h.kind === 'setlist') {
    const parts = [
      h.matched_song ? `Has ${h.matched_song}` : null,
      h.song_count != null
        ? `${h.song_count} song${h.song_count === 1 ? '' : 's'}`
        : null,
      ctx,
    ].filter(Boolean) as string[]
    return (
      <>
        <ListMusic size={18} className="text-ink-3 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block truncate text-[15px] font-bold text-ink-1">
            <Highlight text={h.title} query={query} />
          </span>
          {parts.length > 0 && (
            <span className="block truncate text-[12.5px] text-ink-3">
              {h.matched_song && (
                <>
                  Has <Highlight text={h.matched_song} query={query} />
                  {parts.length > 1 ? ' · ' : ''}
                </>
              )}
              {parts.slice(h.matched_song ? 1 : 0).join(' · ')}
            </span>
          )}
        </span>
        <ChevronRight size={16} className="text-ink-4 shrink-0" />
      </>
    )
  }
  const when = h.starts_at ? new Date(h.starts_at) : null
  const sub = [
    h.subtitle,
    h.matched_song ? `has ${h.matched_song}` : null,
    ctx,
  ].filter(Boolean)
  return (
    <>
      <span className="w-9 shrink-0 text-center leading-none">
        <span className="block font-mono text-[10px] uppercase text-ink-3">
          {when?.toLocaleDateString(undefined, { month: 'short' })}
        </span>
        <span className="block font-display font-extrabold text-[24px] text-ink-1">
          {when?.getDate()}
        </span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[15px] font-bold text-ink-1">
          <Highlight text={h.title} query={query} />
        </span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3 min-w-0">
          <TypeLabel
            type={
              h.kind === 'jam' ? 'jam' : h.kind === 'show' ? 'show' : 'practice'
            }
          />
          {sub.length > 0 && (
            <span className="truncate">· {sub.join(' · ')}</span>
          )}
        </span>
      </span>
      <ChevronRight size={16} className="text-ink-4 shrink-0" />
    </>
  )
}
