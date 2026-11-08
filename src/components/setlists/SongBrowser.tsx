/**
 * Add songs (Setlist Editor 4, a3-add-songs). Desktop: a pane beside the set;
 * + adds one song after the selected row. Phone: a pushed screen; tap rows to
 * pick, then "Add N songs". Band sets list the band's songs plus "From my
 * songs" (copied into the band on add). Songs already in the set keep their
 * row, muted: on desktop with × to take an accidental add straight back out,
 * on phones with a set icon. Filter by another setlist (songs in it) and by
 * tuning (chips: the tunings these songs use, most used first).
 */
import React, { useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  Music2,
  Plus,
  Search,
  X,
} from 'lucide-react'
import type { Song } from '../../models/Song'
import type { IndexRow } from '../../domain/setlist'
import { songLength } from '../../domain/setlist'
import { canonicalTuningId } from '../../utils/tunings'
import { useSongs, usePersonalSongs } from '../../hooks/useSongs'
import { Button, Sheet, SheetItem, TuningPill } from '../ui'

export interface SongBrowserProps {
  mode: 'pane' | 'screen'
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
  /** Desktop ×: takes a song back out of the set (no confirm). */
  onRemove: (songId: string) => Promise<boolean>
  onClose: () => void
  /** List "From my songs" in a band (default). Practices take band songs only. */
  withMine?: boolean
}

export const SongBrowser: React.FC<SongBrowserProps> = ({
  mode,
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
}) => {
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
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

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

  const add = async (ids: string[]) => {
    if (!ids.length || busy) return false
    setBusy(true)
    try {
      const ok = await onAdd(ids)
      if (ok) setPicked([])
      return ok
    } finally {
      setBusy(false)
    }
  }
  const remove = async (s: Song) => {
    if (busy) return
    setBusy(true)
    try {
      await onRemove(inSet.has(s.id!) ? s.id! : s.linkedFromSongId!)
    } finally {
      setBusy(false)
    }
  }
  const toggle = (id: string) =>
    setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))

  const row = (s: Song) => {
    const inThisSet = isIn(s)
    const on = picked.includes(s.id!)
    const pane = mode === 'pane'
    const removable = pane && inThisSet
    const body = (
      <>
        <span className="flex-1 min-w-0">
          {pane ? (
            <>
              <span
                className={`block truncate text-[14.5px] font-semibold ${inThisSet ? 'text-ink-4' : 'text-ink-1'}`}
              >
                {s.title}
              </span>
              <span className="block truncate text-[12.5px] text-ink-4">
                {s.artist}
              </span>
            </>
          ) : (
            <span
              className={`block truncate text-[15px] font-semibold ${inThisSet ? 'text-ink-4' : 'text-ink-1'}`}
            >
              {s.title}
              {s.artist && (
                <span className="font-normal text-ink-3"> · {s.artist}</span>
              )}
            </span>
          )}
        </span>
        <span className={inThisSet ? 'opacity-50' : ''}>
          <TuningPill tuning={s.guitarTuning} size="sm" />
        </span>
        {!pane && (
          <span className="w-10 text-right font-mono text-[12.5px] text-ink-3">
            {songLength(s.duration)}
          </span>
        )}
        <span
          className={`w-8 h-8 shrink-0 grid place-items-center rounded-full ${
            removable
              ? 'bg-danger/15 text-danger group-hover:bg-danger-fill group-hover:text-white'
              : inThisSet
                ? 'text-ink-4'
                : on
                  ? 'bg-accent text-on-accent'
                  : pane
                    ? 'bg-bg-3 text-ink-1'
                    : 'ring-[1.5px] ring-inset ring-border-1'
          }`}
        >
          {removable ? (
            <X size={16} />
          ) : inThisSet ? (
            <ListMusic size={16} />
          ) : on ? (
            <Check size={16} strokeWidth={3} />
          ) : pane ? (
            <Plus size={17} />
          ) : null}
        </span>
      </>
    )
    return (
      <button
        key={s.id}
        type="button"
        disabled={(inThisSet && !removable) || busy}
        onClick={() =>
          removable ? remove(s) : pane ? add([s.id!]) : toggle(s.id!)
        }
        aria-label={
          removable
            ? `Remove ${s.title} from this set`
            : inThisSet
              ? `${s.title} is in this set`
              : `Add ${s.title}`
        }
        aria-pressed={pane ? undefined : on}
        data-testid={`browser-song-${s.id}`}
        data-in-set={inThisSet || undefined}
        className="group w-full flex items-center gap-3 min-h-[52px] px-3 py-1.5 rounded-xl text-left hover:bg-bg-3 disabled:hover:bg-transparent"
      >
        {body}
      </button>
    )
  }

  const heading = (text: string) => (
    <p className="px-3 pt-4 pb-1.5 font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3">
      {text}
    </p>
  )

  const body = (
    <>
      <div className="relative mx-1">
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
      {otherSets.length > 0 && (
        <button
          type="button"
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            setSetPicker({ x: r.left, y: r.bottom + 6 })
          }}
          aria-haspopup="menu"
          className={`mt-3 mx-1 h-9 max-w-[calc(100%-8px)] pl-3 pr-2.5 rounded-full flex items-center gap-2 text-[13px] font-bold ${fromSet ? 'bg-ink-1 text-bg-1' : 'ring-1 ring-inset ring-border-1 text-ink-2'}`}
          data-testid="browser-setlist-filter"
        >
          <ListMusic size={15} className="shrink-0" />
          <span className="truncate">
            {fromSet ? `In ${fromSet.name}` : 'In any setlist'}
          </span>
          {mode === 'pane' ? (
            <ChevronDown size={15} className="shrink-0" />
          ) : (
            <ChevronRight size={15} className="shrink-0" />
          )}
        </button>
      )}
      {chips.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pt-3 pb-1">
          <button
            type="button"
            onClick={() => setTuning(null)}
            aria-pressed={!tuning}
            className={`h-9 px-3.5 rounded-full text-[13px] font-bold shrink-0 ${!tuning ? 'bg-ink-1 text-bg-1' : 'ring-1 ring-inset ring-border-1 text-ink-2'}`}
            data-testid="browser-tuning-all"
          >
            All
          </button>
          {chips.map(c => (
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
      )}
      <div className="mt-1">
        {mode === 'screen' && heading(`${catalogName} songs`)}
        {list.map(row)}
        {mine.length > 0 && (
          <>
            {heading('From my songs')}
            {mine.map(row)}
          </>
        )}
        {!list.length && !mine.length && (
          <p
            className="px-3 py-8 text-center text-[14px] text-ink-3"
            data-testid="browser-empty"
          >
            {q || tuning || fromSet ? 'No songs match.' : 'No songs yet.'}
          </p>
        )}
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
    </>
  )

  if (mode === 'pane')
    return (
      <aside
        className="w-[340px] shrink-0 self-start sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar-thin rounded-3xl bg-bg-2 p-3"
        data-testid="song-browser"
      >
        <h2 className="flex items-center gap-2 px-2 pt-1 pb-3 text-[16px] font-bold text-ink-1">
          <Music2 size={18} /> Add songs
        </h2>
        {body}
      </aside>
    )

  return (
    <div
      className="fixed inset-0 z-[55] bg-bg-1 flex flex-col"
      data-testid="song-browser"
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-4 pt-[max(16px,env(safe-area-inset-top))] pb-32">
        <button
          type="button"
          onClick={onClose}
          className="h-10 pl-2 pr-3.5 rounded-full bg-bg-3 text-ink-1 font-semibold flex items-center gap-1 max-w-[260px]"
          data-testid="browser-back"
        >
          <ChevronLeft size={19} className="shrink-0" />
          <span className="truncate">{setName}</span>
        </button>
        <h1 className="mt-4 mb-4 font-display font-extrabold uppercase text-[40px] leading-[.9] text-ink-1">
          Add songs
        </h1>
        {body}
      </div>
      <div className="fixed inset-x-0 bottom-0 px-4 pt-6 pb-[max(20px,env(safe-area-inset-bottom))] bg-gradient-to-t from-bg-1 from-60% to-transparent">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={<Plus size={19} />}
          disabled={!picked.length || busy}
          onClick={() => add(picked).then(ok => ok && onClose())}
          data-testid="browser-add-picked"
        >
          {picked.length
            ? `Add ${picked.length} ${picked.length === 1 ? 'song' : 'songs'}`
            : 'Pick songs to add'}
        </Button>
      </div>
    </div>
  )
}
