/**
 * Add songs: one picker for setlists and practices. A drawer over the right
 * edge on desktop (the list stays in view), full screen on phones. Tapping a
 * row puts the song in or takes it back out, at once: the check shows it's
 * in. × / Done / Esc close it. Band sets list the band's songs plus "From my
 * songs" (copied into the band on add). Filter by another setlist (then "Add
 * all") and by tuning (chips: the tunings these songs use, most used first;
 * tap again to clear).
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ListMusic, Plus, Search, X } from 'lucide-react'
import type { Song } from '../../models/Song'
import type { IndexRow } from '../../domain/setlist'
import { toSongLine } from '../../domain/songs'
import { SongLine } from '../songs/SongLine'
import { canonicalTuningId } from '../../utils/tunings'
import { useSongs, usePersonalSongs } from '../../hooks/useSongs'
import { useMediaQuery } from '../../hooks/useResponsive'
import { Button, Sheet, SheetItem, TuningPill } from '../ui'

export interface SongBrowserProps {
  setName: string
  contextType: 'band' | 'personal'
  contextId: string
  userId: string
  /** Catalog name for the search placeholder ("Search iPod Shuffle songs"). */
  catalogName: string
  /** Song ids already in the set. */
  inSet: Set<string>
  /** Other sets in this context, to filter the songs by. */
  otherSets: IndexRow[]
  /** Resolves true when the songs went in (the page reports failures). */
  onAdd: (songIds: string[]) => Promise<boolean>
  /** Takes a song back out of the set (no confirm). */
  onRemove: (songId: string) => Promise<boolean>
  onClose: () => void
  /** List "From my songs" in a band (default). Practices take band songs only. */
  withMine?: boolean
  /**
   * Opt-in (jam lineups): when the search matches nothing, offer "Add ‹query›
   * as a title" for a song nobody has catalogued. Resolves true when added.
   */
  onAddTitle?: (title: string) => Promise<boolean>
}

/** Scrolls the list row of a just-added song into view and flashes it. */
function revealSongRow(songId: string, tries = 20) {
  const el = document.querySelector<HTMLElement>(
    `[data-song-id="${CSS.escape(songId)}"]`
  )
  if (!el) {
    if (tries) setTimeout(() => revealSongRow(songId, tries - 1), 100)
    return
  }
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  el.classList.remove('row-flash')
  void el.offsetWidth
  el.classList.add('row-flash')
}

/** The "+ Add songs" row that ends every song list. */
export const AddSongsRow: React.FC<{
  onClick: () => void
  className?: string
  'data-testid': string
}> = ({ onClick, className = '', 'data-testid': testId }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full h-12 px-4 rounded-[20px] border border-dashed border-border-1 flex items-center gap-2.5 text-[14.5px] font-semibold text-ink-2 hover:bg-bg-2 hover:text-ink-1 ${className}`}
    data-testid={testId}
  >
    <Plus size={18} className="text-accent-ink" /> Add songs
  </button>
)

export const SongBrowser: React.FC<SongBrowserProps> = ({
  setName,
  contextType,
  contextId,
  userId,
  catalogName,
  inSet,
  otherSets,
  onAdd,
  onRemove,
  onClose,
  withMine = true,
  onAddTitle,
}) => {
  const desktop = useMediaQuery('(min-width: 768px)')
  const isBand = contextType === 'band'
  const { songs: bandSongs } = useSongs(isBand ? contextId : '')
  const { songs: mySongs } = usePersonalSongs(userId)
  const [q, setQ] = useState('')
  const [tuning, setTuning] = useState<string | null>(null)
  const [fromSet, setFromSet] = useState<IndexRow | null>(null)
  const [setPicker, setSetPicker] = useState<{ x: number; y: number } | false>(
    false
  )
  const fromSetIds = useMemo(
    () => (fromSet ? new Set(fromSet.songs.map(s => s.id)) : null),
    [fromSet]
  )
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(0)

  // Esc closes (while the setlist picker is open, Esc closes just that).
  useEffect(() => {
    if (setPicker !== false) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setPicker, onClose])

  const catalog = isBand ? bandSongs : mySongs
  // Your songs already copied into this band are shown once, as the band's.
  const fromMine = useMemo(() => {
    if (!isBand || !withMine) return []
    const band = new Set(bandSongs.map(s => s.id))
    return mySongs.filter(
      s => !s.linkedFromSongId || !band.has(s.linkedFromSongId)
    )
  }, [isBand, withMine, bandSongs, mySongs])
  // A personal song counts as "in the set" when its band copy is.
  const isIn = (s: Song) =>
    inSet.has(s.id!) || (!!s.linkedFromSongId && inSet.has(s.linkedFromSongId))

  const chips = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>()
    for (const s of [...catalog, ...fromMine]) {
      const id = canonicalTuningId(s.guitarTuning)
      const c = counts.get(id)
      if (c) c.n++
      else counts.set(id, { label: s.guitarTuning || 'Standard', n: 1 })
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label))
      .map(([id, c]) => ({ id, label: c.label }))
  }, [catalog, fromMine])

  const match = (s: Song) => {
    const t = q.trim().toLowerCase()
    return (
      (!fromSetIds ||
        fromSetIds.has(s.id!) ||
        (!!s.linkedFromSongId && fromSetIds.has(s.linkedFromSongId))) &&
      (!tuning || canonicalTuningId(s.guitarTuning) === tuning) &&
      (!t ||
        s.title.toLowerCase().includes(t) ||
        (s.artist ?? '').toLowerCase().includes(t))
    )
  }
  const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title)
  const list = catalog.filter(match).sort(byTitle)
  const mine = fromMine.filter(match).sort(byTitle)
  const missing = fromSet ? [...list, ...mine].filter(s => !isIn(s)) : []

  const add = async (ids: string[]) => {
    if (!ids.length || busy) return
    setBusy(true)
    try {
      if (await onAdd(ids)) {
        setAdded(n => n + ids.length)
        revealSongRow(ids[ids.length - 1])
      }
    } finally {
      setBusy(false)
    }
  }
  const remove = async (s: Song) => {
    if (busy) return
    setBusy(true)
    try {
      if (await onRemove(inSet.has(s.id!) ? s.id! : s.linkedFromSongId!))
        setAdded(n => Math.max(0, n - 1))
    } finally {
      setBusy(false)
    }
  }

  const row = (s: Song) => {
    const on = isIn(s)
    const check = (
      <span
        className={`w-7 h-7 shrink-0 grid place-items-center rounded-full ${
          on
            ? 'bg-accent text-on-accent'
            : 'ring-[1.5px] ring-inset ring-border-1 text-ink-3 group-hover:text-ink-1 group-hover:ring-ink-3'
        }`}
      >
        {on ? <Check size={15} strokeWidth={3} /> : <Plus size={15} />}
      </span>
    )
    return (
      <button
        key={s.id}
        type="button"
        disabled={busy}
        onClick={() => (on ? remove(s) : add([s.id!]))}
        aria-label={on ? `Take ${s.title} out` : `Add ${s.title}`}
        aria-pressed={on}
        data-testid={`browser-song-${s.id}`}
        data-in-set={on || undefined}
        className="group block w-full rounded-xl text-left hover:bg-bg-2"
      >
        <SongLine
          song={toSongLine(s)}
          density="compact"
          trail={check}
          className="px-3"
        />
      </button>
    )
  }

  const heading = (text: string) => (
    <p className="px-3 pt-4 pb-1.5 font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3">
      {text}
    </p>
  )

  const filters = (
    <div className="px-4 pb-3 border-b border-divider">
      <div className="relative">
        <Search
          size={17}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          id="browser-search"
          name="browserSearch"
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={`Search ${catalogName} songs`}
          className="w-full h-11 pl-10 pr-3 rounded-full bg-bg-3 text-[15px] text-ink-1 placeholder:text-ink-4 outline-none focus:ring-2 focus:ring-accent/40"
          data-testid="browser-search-input"
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-3">
        {otherSets.length > 0 && (
          <button
            type="button"
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect()
              setSetPicker({ x: r.left, y: r.bottom + 6 })
            }}
            aria-haspopup="menu"
            className={`h-9 max-w-full pl-3 pr-2.5 rounded-full flex items-center gap-2 text-[13px] font-bold ${fromSet ? 'bg-ink-1 text-bg-1' : 'ring-1 ring-inset ring-border-1 text-ink-2'}`}
            data-testid="browser-setlist-filter"
          >
            <ListMusic size={15} className="shrink-0" />
            <span className="truncate">
              {fromSet ? `In ${fromSet.name}` : 'In any setlist'}
            </span>
            <ChevronDown size={15} className="shrink-0" />
          </button>
        )}
        {chips.length > 1 &&
          chips.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setTuning(tuning === c.id ? null : c.id)}
              aria-pressed={tuning === c.id}
              className={`h-9 px-2 rounded-full shrink-0 grid place-items-center ${tuning === c.id ? 'ring-2 ring-inset ring-ink-1' : 'ring-1 ring-inset ring-border-1'}`}
              data-testid={`browser-tuning-${c.id}`}
            >
              <TuningPill tuning={c.label} size="sm" />
            </button>
          ))}
      </div>
      {fromSet && missing.length > 0 && (
        <Button
          size="md"
          icon={<Plus size={16} />}
          disabled={busy}
          onClick={() => add(missing.map(s => s.id!))}
          className="mt-3 w-full"
          data-testid="browser-add-all"
        >
          Add all {missing.length} from {fromSet.name}
        </Button>
      )}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[55] md:bg-black/40"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add songs to ${setName}`}
        className={`absolute flex flex-col bg-bg-1 ${
          desktop
            ? 'right-0 inset-y-0 w-[440px] max-w-full rounded-l-[28px] shadow-sheet drawer-in'
            : 'inset-0 sheet-in'
        }`}
        data-testid="song-browser"
      >
        <div className="flex items-start gap-3 px-4 pt-[max(18px,env(safe-area-inset-top))] pb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[19px] font-bold text-ink-1">Add songs</h2>
            <p className="text-[13px] text-ink-3 truncate">
              To {setName} · {inSet.size} {inSet.size === 1 ? 'song' : 'songs'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-bg-3 text-ink-1 hover:bg-bg-4"
            data-testid="browser-close"
          >
            <X size={19} />
          </button>
        </div>
        {filters}
        <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-1 pb-2">
          {list.map(row)}
          {mine.length > 0 && (
            <>
              {heading('From my songs')}
              {mine.map(row)}
            </>
          )}
          {!list.length && !mine.length && onAddTitle && q.trim() && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  if (await onAddTitle(q.trim().slice(0, 200))) {
                    setAdded(n => n + 1)
                    setQ('')
                  }
                } finally {
                  setBusy(false)
                }
              }}
              className="w-full flex items-center gap-3 min-h-14 px-3 rounded-xl text-left hover:bg-bg-2 disabled:opacity-50"
              data-testid="browser-add-title"
            >
              <span className="w-7 h-7 shrink-0 grid place-items-center rounded-full ring-[1.5px] ring-inset ring-border-1 text-accent-ink">
                <Plus size={15} />
              </span>
              <span className="flex-1 min-w-0 truncate text-[15px] text-ink-1">
                Add <b>{q.trim()}</b> as a title
              </span>
            </button>
          )}
          {!list.length && !mine.length && !(onAddTitle && q.trim()) && (
            <p
              className="px-3 py-8 text-center text-[14px] text-ink-3"
              data-testid="browser-empty"
            >
              {q || tuning || fromSet ? 'No songs match.' : 'No songs yet.'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-divider">
          <span
            className="flex-1 text-[13.5px] text-ink-3"
            data-testid="browser-added-count"
          >
            {added > 0 && `${added} added`}
          </span>
          <Button
            variant="primary"
            size="md"
            onClick={onClose}
            className="min-w-[120px]"
            data-testid="browser-done"
          >
            Done
          </Button>
        </div>
      </div>
      {setPicker !== false && (
        <Sheet
          onClose={() => setSetPicker(false)}
          at={setPicker}
          width={300}
          title="Show songs in"
          data-testid="browser-setlist-sheet"
        >
          <SheetItem
            icon={fromSet ? <span className="w-[19px]" /> : <Check />}
            label="Any setlist"
            onClick={() => {
              setFromSet(null)
              setSetPicker(false)
            }}
            data-testid="browser-setlist-option-any"
          />
          {otherSets.map(r => (
            <SheetItem
              key={r.id}
              icon={
                fromSet?.id === r.id ? <Check /> : <span className="w-[19px]" />
              }
              label={r.name}
              hint={`${r.songs.length} ${r.songs.length === 1 ? 'song' : 'songs'}`}
              onClick={() => {
                setFromSet(r)
                setSetPicker(false)
              }}
              data-testid={`browser-setlist-option-${r.id}`}
            />
          ))}
        </Sheet>
      )}
    </div>
  )
}
