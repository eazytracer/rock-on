/**
 * The setlist editor (redesign phase 3 · docs/redesign/10 · 2.3, design/demo
 * screens/Setlist Editor.html, review/setlist-nav ab2 / ab3 / a3 / m2 / m3).
 * Full width: no column beside it. Everything saves as you go.
 *
 * Desktop: ← Setlists and the show line, the name (click to rename) with a
 * caret switcher, then Timeline · Notes · + Break · + Section · Add songs · ⋯.
 * Break and Section go in after the selected row and open in place. Add songs
 * opens the song browser beside the set.
 * Phone: the name (tap) or ⇄ opens the switcher sheet; one Add at the thumb
 * (Songs / Break / Section); hold a row for Move / note / Open / Remove.
 * `/setlists/new` makes an empty set in the current context and opens it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  Clock,
  Copy,
  FileText,
  ListMusic,
  MoreHorizontal,
  Music2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  useDeleteSetlist,
  useDuplicateSetlist,
  useNewSetlist,
  useSetlistEditor,
  useSetlistIndex,
} from '../hooks/useSetlists'
import { useMediaQuery } from '../hooks/useResponsive'
import { useConfirm } from '../hooks/useConfirm'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { MarkdownRenderer } from '../components/notes/MarkdownRenderer'
import { Button, Empty, RetryCard, Sheet, SheetItem } from '../components/ui'
import { SetlistRows } from '../components/setlists/SetlistRows'
import { SongBrowser } from '../components/setlists/SongBrowser'
import { SetlistStats } from '../components/setlists/SetlistStats'
import {
  AddMenuSheet,
  AfterSheet,
  InsertSheet,
  NotesSheet,
  RowMenuSheet,
  SwitcherSheet,
} from '../components/setlists/SetlistSheets'
import {
  TOP,
  addSongsToSetlist,
  insertSetlistItem,
  setlistIndex,
  moveSetlistItem,
  removeSetlistItem,
  renameSetlist,
  setSetlistNotes,
  updateSetlistItem,
  type InsertItem,
  type ItemPatch,
} from '../services/api/setlists'
import {
  deleteSetlistMessage,
  editorRows,
  editorTotals,
  moveItem,
  moveTarget,
  nextSectionLabel,
  railLabel,
  rowLabel,
  showLine,
  showStartMinutes,
  sortSetlistIndex,
  startOffsets,
} from '../domain/setlist'
import { originHref, parseOrigin } from '../utils/songOrigin'
import { songHref } from '../utils/songOrigin'
import type { SetlistItem } from '../types'
import { createLogger } from '../utils/logger'

const log = createLogger('SetlistViewPage')

type At = { x: number; y: number } | null
type Rail = 'set' | 'clock'

const NO_ITEMS: SetlistItem[] = []
const RAIL_KEY = 'setlist-rail'
const readRail = (): boolean => {
  try {
    return localStorage.getItem(RAIL_KEY) === '1'
  } catch {
    return false
  }
}
const writeRail = (on: boolean) => {
  try {
    localStorage.setItem(RAIL_KEY, on ? '1' : '0')
  } catch {
    // Private mode: the rail just won't be remembered.
  }
}

const below = (el: HTMLElement, alignRight = false, width = 288): At => {
  const r = el.getBoundingClientRect()
  return { x: alignRight ? r.right - width : r.left, y: r.bottom + 8 }
}

const errorText = (err: unknown) =>
  err instanceof Error && err.name === 'ApiError'
    ? err.message
    : "That didn't save. Try again."

export const SetlistViewPage: React.FC = () => {
  const { setlistId = 'new' } = useParams<{ setlistId: string }>()
  if (setlistId === 'new') return <NewSetlist />
  return <SetlistEditor key={setlistId} setlistId={setlistId} />
}

/** `/setlists/new[?song=<id>]`: an empty set (with that song) in this context. */
const NewSetlist: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { showToast } = useToast()
  const { currentBandId, currentUser } = useAuth()
  const newSetlist = useNewSetlist()
  const started = useRef(false)
  const ctxId = currentBandId || currentUser?.id

  useEffect(() => {
    if (started.current || !ctxId) return
    started.current = true
    const song = params.get('song')
    ;(async () => {
      try {
        const id = await newSetlist(currentBandId ? 'band' : 'personal', ctxId)
        if (song)
          await addSongsToSetlist(id, [song], null).catch(err =>
            log.error('Add song to new setlist failed', err)
          )
        navigate(`/setlists/${id}`, { replace: true })
      } catch (err) {
        log.error('Create setlist failed', err)
        showToast("Couldn't create it. Try again.", 'error')
        navigate('/setlists', { replace: true })
      }
    })()
  }, [ctxId, currentBandId, newSetlist, navigate, params, showToast])

  return <ContentLoadingSpinner isLoading>{null}</ContentLoadingSpinner>
}

const SetlistEditor: React.FC<{ setlistId: string }> = ({ setlistId }) => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { showToast } = useToast()
  const { currentBand, currentUser } = useAuth()
  const desktop = useMediaQuery('(min-width: 768px)')
  const { confirm, dialogProps } = useConfirm()

  const { setlist, songsById, loading, error, refetch, run } =
    useSetlistEditor(setlistId)
  const ctxType: 'band' | 'personal' =
    setlist?.contextType ?? (setlist?.bandId ? 'band' : 'personal')
  const ctxId = setlist?.contextId ?? setlist?.bandId ?? ''
  const { rows: index, loading: indexLoading } = useSetlistIndex(ctxType, ctxId)
  const sets = useMemo(
    () => sortSetlistIndex(index, 'nextShow', new Date()),
    [index]
  )
  const me = index.find(r => r.id === setlistId)
  const newSetlist = useNewSetlist()
  const duplicate = useDuplicateSetlist()
  const { deleteSetlist } = useDeleteSetlist()

  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [switcher, setSwitcher] = useState<At | false>(false)
  const [headerMenu, setHeaderMenu] = useState<At | false>(false)
  const [rowMenu, setRowMenu] = useState<{ id: string; at: At } | null>(null)
  const [after, setAfter] = useState<
    { kind: 'move'; id: string } | { kind: 'insert' } | null
  >(null)
  const [addMenu, setAddMenu] = useState(false)
  const [insert, setInsert] = useState<{
    type: 'break' | 'section'
    after: string | null
  } | null>(null)
  const [notes, setNotes] = useState(false)
  const [itemNote, setItemNote] = useState<string | null>(null)
  const [railOn, setRailOn] = useState(readRail)
  const [railMode, setRailMode] = useState<Rail | null>(null)
  const [railMenu, setRailMenu] = useState<At | false>(false)
  const browsing = params.get('add') === '1'

  const items = setlist?.items ?? NO_ITEMS
  const rows = useMemo(
    () =>
      editorRows(items, id => {
        const s = songsById.get(id)
        return s
          ? {
              title: s.title,
              artist: s.artist,
              tuning: s.guitarTuning,
              key: s.key,
              seconds: s.duration || 0,
            }
          : undefined
      }),
    [items, songsById]
  )
  const totals = editorTotals(rows, me?.showMinutes)
  const inSet = useMemo(
    () => new Set(items.flatMap(i => (i.songId ? [i.songId] : []))),
    [items]
  )

  // Back: ← Setlists, or the origin (?from=show:<id> / search:<q>).
  const origin = parseOrigin(params.get('from'))
  const back =
    origin.kind === 'show'
      ? {
          href: originHref(origin),
          label: (me?.showId === origin.id && me.showName) || 'Show',
        }
      : origin.kind === 'search'
        ? { href: originHref(origin), label: `Search "${origin.q}"` }
        : { href: '/setlists', label: 'Setlists' }
  const show = me ? showLine(me) : null
  const catalogName = ctxType === 'band' ? (currentBand?.name ?? 'band') : 'My'

  // Timeline rail: clock time only with a show start; opened from a show, it
  // starts in clock time.
  const start = showStartMinutes(me?.showAt, me?.showSetTime)
  const rail: Rail =
    railMode === 'clock' && start !== null
      ? 'clock'
      : railMode === 'set'
        ? 'set'
        : origin.kind === 'show' && start !== null
          ? 'clock'
          : 'set'
  const railLabels = railOn
    ? startOffsets(rows).map(o => railLabel(o, rail === 'clock' ? start : null))
    : null

  // Back from the song page (?selected=<songId>): select and show its row.
  useEffect(() => {
    const songId = params.get('selected')
    if (!songId || !items.length) return
    const it = items.find(i => i.songId === songId)
    if (it) setSelected(it.id)
    const next = new URLSearchParams(params)
    next.delete('selected')
    setParams(next, { replace: true })
    requestAnimationFrame(() =>
      document
        .querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center' })
    )
  }, [params, items, setParams])

  // Hold (or right-click) the clock to pick Clock / Set time.
  const railHold = useRailHold(el => setRailMenu(below(el)))

  if (loading)
    return <ContentLoadingSpinner isLoading>{null}</ContentLoadingSpinner>
  if (error)
    return (
      <div data-testid="setlist-view-page">
        <RetryCard message="Couldn't load this setlist." onRetry={refetch} />
      </div>
    )
  if (!setlist)
    return (
      <div data-testid="setlist-view-page">
        <Link
          to="/setlists"
          className="inline-flex h-9 pl-1.5 pr-3 rounded-full bg-bg-3 text-ink-1 text-[14px] font-semibold items-center gap-1"
        >
          <ChevronLeft size={18} /> Setlists
        </Link>
        <Empty
          icon={<ListMusic size={28} />}
          title="This setlist was deleted."
          why="It's no longer in this band's setlists."
          data-testid="setlist-missing"
        />
      </div>
    )

  // ── Actions ──────────────────────────────────────────────────────────────
  const attempt = async <T,>(what: string, fn: () => Promise<T>) => {
    try {
      return await fn()
    } catch (err) {
      log.error(what, err)
      showToast(errorText(err), 'error')
      return undefined
    }
  }

  const setBrowsing = (on: boolean) => {
    const next = new URLSearchParams(params)
    if (on) next.set('add', '1')
    else next.delete('add')
    setParams(next, { replace: !on || desktop })
  }

  // Desktop inserts after the selected row; with nothing selected, at the end.
  const anchor =
    selected && items.some(i => i.id === selected) ? selected : null

  const addSongs = async (ids: string[]) => {
    const added = await attempt('Add songs', () =>
      run(() => addSongsToSetlist(setlistId, ids, anchor))
    )
    if (!added) return false
    setSelected(added[added.length - 1] ?? null)
    showToast(
      ids.length === 1 ? 'Added 1 song' : `Added ${ids.length} songs`,
      'success'
    )
    return true
  }

  // The browser's ×: an accidental add comes straight back out, no confirm.
  const removeSong = async (songId: string) => {
    const it = items.find(i => i.songId === songId)
    if (!it) return false
    // Undoing the add just made: select the row before, so the next + lands there.
    if (selected === it.id)
      setSelected(items[items.indexOf(it) - 1]?.id ?? null)
    const done = await attempt('Remove song', async () => {
      await run(
        () => removeSetlistItem(setlistId, it.id),
        list => list.filter(i => i.id !== it.id)
      )
      return true
    })
    if (done)
      showToast(
        `Removed "${songsById.get(songId)?.title ?? 'song'}"`,
        'success'
      )
    return !!done
  }

  const insertItem = async (item: InsertItem, afterId: string | null) => {
    const id = await attempt('Insert item', () =>
      run(() => insertSetlistItem(setlistId, item, afterId))
    )
    if (id) setSelected(id)
    return id
  }
  const insertInPlace = async (type: 'break' | 'section') => {
    const id = await insertItem(
      type === 'break'
        ? { type, minutes: 15 }
        : { type, label: nextSectionLabel(items) },
      anchor
    )
    if (id) setEditing(id)
  }

  const saveItem = (id: string, patch: ItemPatch) =>
    attempt('Update item', () =>
      run(
        () => updateSetlistItem(setlistId, id, patch),
        list => list.map(i => (i.id === id ? patchItem(i, patch) : i))
      )
    )

  const move = (id: string, to: number) => {
    const from = items.findIndex(i => i.id === id)
    if (from < 0 || from === to) return
    setSelected(id)
    void attempt('Move item', () =>
      run(
        () => moveSetlistItem(setlistId, id, to),
        list => moveItem(list, from, to)
      )
    )
  }

  const moveAfter = (id: string, afterId: string | null) => {
    const rest = items.filter(i => i.id !== id)
    move(id, afterId ? rest.findIndex(i => i.id === afterId) + 1 : 0)
  }

  const remove = async (id: string) => {
    const row = rows.find(r => r.item.id === id)
    if (!row) return
    const ok = await confirm(
      row.kind === 'song'
        ? {
            title: `Remove "${rowLabel(row)}" from ${setlist.name}?`,
            message: 'It stays in your songs and in any other setlist.',
            confirmLabel: 'Remove',
            cancelLabel: 'Keep',
            variant: 'danger',
          }
        : {
            title: `Remove "${rowLabel(row)}"?`,
            message: 'Only this row goes.',
            confirmLabel: 'Remove',
            cancelLabel: 'Keep',
            variant: 'danger',
          }
    )
    if (!ok) return
    if (selected === id) setSelected(null)
    await attempt('Remove item', () =>
      run(
        () => removeSetlistItem(setlistId, id),
        list => list.filter(i => i.id !== id)
      )
    )
  }

  const rename = async (name: string) => {
    setRenaming(false)
    const v = name.trim()
    if (!v || v === setlist.name) return
    await attempt('Rename setlist', () =>
      run(() => renameSetlist(setlistId, v))
    )
  }

  const create = async () => {
    setSwitcher(false)
    const id = await attempt('New setlist', () => newSetlist(ctxType, ctxId))
    if (id) navigate(`/setlists/${id}`)
  }

  const handleDuplicate = async () => {
    setHeaderMenu(false)
    const id = await attempt('Duplicate setlist', () => duplicate(setlistId))
    if (!id) return
    showToast(`Duplicated "${setlist.name}"`, 'success')
    navigate(`/setlists/${id}`)
  }

  const handleDelete = async () => {
    setHeaderMenu(false)
    // The confirm names the show; look it up if the index hasn't loaded yet.
    const row =
      me ??
      (await setlistIndex(ctxType, ctxId)
        .then(rows => rows.find(r => r.id === setlistId))
        .catch(() => undefined))
    const ok = await confirm({
      title: `Delete "${setlist.name}"?`,
      message: deleteSetlistMessage(row ? showLine(row) : null),
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    const done = await attempt('Delete setlist', async () => {
      await deleteSetlist(setlistId)
      return true
    })
    if (!done) return
    showToast(`Deleted "${setlist.name}"`, 'success')
    navigate('/setlists')
  }

  const openSong = (songId: string) =>
    navigate(songHref(songId, { kind: 'setlist', id: setlistId }))

  const toggleRail = () => {
    setRailOn(!railOn)
    writeRail(!railOn)
  }

  // ── Pieces ───────────────────────────────────────────────────────────────
  const round = (
    label: string,
    icon: React.ReactNode,
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void,
    testId: string,
    extra: Partial<React.ButtonHTMLAttributes<HTMLButtonElement>> = {},
    size = desktop ? 'w-11 h-11' : 'w-10 h-10'
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${size} shrink-0 grid place-items-center rounded-full text-ink-1 ${extra['aria-pressed'] ? 'bg-accent text-on-accent' : 'bg-bg-3 hover:bg-bg-4'}`}
      data-testid={testId}
      {...extra}
    >
      {icon}
    </button>
  )

  const railButton = round(
    railOn ? 'Hide timeline' : 'Show timeline',
    <Clock size={19} />,
    () => {
      if (railHold.held()) return
      toggleRail()
    },
    'setlist-timeline-toggle',
    {
      'aria-pressed': railOn,
      onContextMenu: e => {
        e.preventDefault()
        setRailMenu(below(e.currentTarget))
      },
      ...railHold.handlers,
    }
  )

  const nameDisplay = renaming ? (
    <input
      id="setlist-name-input"
      name="setlistName"
      autoFocus
      defaultValue={setlist.name}
      maxLength={80}
      onFocus={e => e.currentTarget.select()}
      onBlur={e => rename(e.currentTarget.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') rename(e.currentTarget.value)
        if (e.key === 'Escape') setRenaming(false)
      }}
      className="min-w-0 flex-1 bg-bg-2 rounded-xl px-3 font-display font-extrabold uppercase text-[40px] md:text-[56px] leading-none text-ink-1 outline-none ring-2 ring-accent/50"
      data-testid="setlist-name-input"
    />
  ) : (
    <button
      type="button"
      onClick={e =>
        desktop ? setRenaming(true) : setSwitcher(below(e.currentTarget))
      }
      title={desktop ? 'Rename' : 'Switch setlist'}
      className="min-w-0 text-left font-display font-extrabold uppercase text-[44px] md:text-[56px] leading-[.92] text-ink-1 break-words"
      data-testid="setlist-name-display"
    >
      {setlist.name}
    </button>
  )

  const switcherButton = desktop
    ? round(
        'Switch setlist',
        <ChevronDown size={20} />,
        e => setSwitcher(below(e.currentTarget, false, 360)),
        'setlist-switcher-toggle',
        {},
        'w-10 h-10'
      )
    : round(
        'Switch setlist',
        <ArrowLeftRight size={17} />,
        () => setSwitcher(null),
        'setlist-switcher-toggle',
        {},
        'w-[38px] h-[38px]'
      )

  const menuButton = round(
    'Setlist menu',
    <MoreHorizontal size={19} />,
    e => setHeaderMenu(below(e.currentTarget, true)),
    'setlist-header-menu'
  )

  const pill = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    testId: string
  ) => (
    <Button
      size="md"
      icon={icon}
      onClick={onClick}
      className="h-11"
      data-testid={testId}
    >
      {label}
    </Button>
  )

  const totalsLine = (
    <SetlistStats
      songs={totals.songs}
      minutes={totals.minutes}
      retunes={totals.retunes}
      slot={totals.slot}
      ends={
        rail === 'clock' && railOn && start !== null
          ? railLabel(totals.minutes * 60, start)
          : null
      }
    />
  )

  const notesCard = setlist.notes && (
    <button
      type="button"
      onClick={() => setNotes(true)}
      className="w-full flex items-start gap-3 mt-4 px-4 py-3 rounded-2xl bg-bg-2 text-left"
      data-testid="setlist-notes-card"
    >
      <FileText size={17} className="text-ink-3 mt-0.5 shrink-0" />
      <span className="flex-1 min-w-0 line-clamp-2 text-[14.5px] text-ink-2 [&_p]:inline [&_*]:my-0">
        <MarkdownRenderer content={setlist.notes} />
      </span>
    </button>
  )

  const empty = (
    <Empty
      icon={<Music2 size={28} />}
      title="Add your first songs"
      why={`Pick from ${catalogName} songs. Filter by another setlist to reuse its songs.`}
      action={
        <div className="flex flex-col gap-2.5 w-full max-w-[320px] mt-2">
          <Button
            variant="primary"
            size="lg"
            icon={<Plus size={19} />}
            onClick={() => setBrowsing(true)}
            data-testid="setlist-empty-add-songs"
          >
            Add songs
          </Button>
        </div>
      }
      data-testid="setlist-editor-empty"
    />
  )

  const list = rows.length ? (
    <SetlistRows
      rows={rows}
      desktop={desktop}
      selectedId={selected}
      editingId={editing}
      rail={railLabels}
      onSelect={id => setSelected(id === selected && desktop ? null : id)}
      onOpenSong={openSong}
      onMenu={(id, at) => {
        setSelected(id)
        setRowMenu({ id, at })
      }}
      onEdit={setEditing}
      onSaveItem={(id, patch) => void saveItem(id, patch)}
      onMove={move}
    />
  ) : (
    empty
  )

  // ── Layout ───────────────────────────────────────────────────────────────
  const header = desktop ? (
    <header className="pb-4 border-b border-divider">
      <div className="flex items-center gap-3">
        <Link
          to={back.href}
          className="h-9 pl-1.5 pr-3 rounded-full bg-bg-3 text-ink-1 text-[14px] font-semibold flex items-center gap-1 hover:bg-bg-4 max-w-[240px]"
          data-testid="setlist-back"
        >
          <ChevronLeft size={18} className="shrink-0" />
          <span className="truncate">{back.label}</span>
        </Link>
        <span
          className="truncate font-mono text-[11.5px] tracking-[.14em] uppercase text-ink-3"
          data-testid="setlist-show-line"
        >
          {indexLoading ? '\u00a0' : (show ?? 'Not attached to a show')}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {nameDisplay}
          {!renaming && switcherButton}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {railButton}
          {pill(
            'Notes',
            <FileText size={17} />,
            () => setNotes(true),
            'setlist-notes-button'
          )}
          {pill(
            'Break',
            <Plus size={17} />,
            () => insertInPlace('break'),
            'setlist-add-break'
          )}
          {pill(
            'Section',
            <Plus size={17} />,
            () => insertInPlace('section'),
            'setlist-add-section'
          )}
          {browsing ? (
            <Button
              size="md"
              icon={<X size={17} />}
              onClick={() => setBrowsing(false)}
              className="h-11"
              data-testid="setlist-hide-songs"
            >
              Hide songs
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={17} />}
              onClick={() => setBrowsing(true)}
              className="h-11"
              data-testid="setlist-add-songs"
            >
              Add songs
            </Button>
          )}
          {menuButton}
        </div>
      </div>
    </header>
  ) : (
    <header>
      <div className="flex items-center gap-2">
        <Link
          to={back.href}
          className="h-10 pl-2 pr-3.5 rounded-full bg-bg-3 text-ink-1 font-semibold flex items-center gap-1 max-w-[200px]"
          data-testid="setlist-back"
        >
          <ChevronLeft size={19} className="shrink-0" />
          <span className="truncate">{back.label}</span>
        </Link>
        <span className="ml-auto" />
        {railButton}
        {menuButton}
      </div>
      <p
        className="mt-4 truncate font-mono text-[11px] tracking-[.14em] uppercase text-ink-3"
        data-testid="setlist-show-line"
      >
        {indexLoading
          ? '\u00a0'
          : show
            ? `Show set · ${show}`
            : `Setlist · ${catalogName}`}
      </p>
      <div className="flex items-center gap-3 mt-1">
        {nameDisplay}
        {!renaming && switcherButton}
      </div>
      <div className="mt-2">{totalsLine}</div>
    </header>
  )

  const rowMenuRow = rowMenu && rows.find(r => r.item.id === rowMenu.id)
  const insertAfterRow =
    insert && (insert.after ? rows.find(r => r.item.id === insert.after) : null)

  return (
    <div data-testid="setlist-view-page" className={desktop ? '' : 'pb-28'}>
      {header}

      {desktop ? (
        <div className={browsing ? 'flex gap-5 items-start' : ''}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 py-3.5 mb-3 border-b border-divider">
              {totalsLine}
              <span className="ml-auto font-mono text-[11.5px] tracking-[.14em] uppercase text-ink-3">
                {browsing
                  ? 'Drag rows · add songs from the right'
                  : 'Click a row to select · drag to reorder'}
              </span>
            </div>
            {notesCard}
            <div className={setlist.notes ? 'mt-4' : ''}>{list}</div>
          </div>
          {browsing && (
            <SongBrowser
              mode="pane"
              setName={setlist.name}
              contextType={ctxType}
              contextId={ctxId}
              userId={currentUser?.id ?? ''}
              catalogName={catalogName}
              inSet={inSet}
              otherSets={sets.filter(s => s.id !== setlistId)}
              onAdd={addSongs}
              onRemove={removeSong}
              onClose={() => setBrowsing(false)}
            />
          )}
        </div>
      ) : (
        <>
          {notesCard}
          <div className="mt-5">{list}</div>
          {rows.length > 0 && (
            <div className="fixed inset-x-4 bottom-[104px] z-30">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                icon={<Plus size={19} />}
                onClick={() => setAddMenu(true)}
                className="shadow-float"
                data-testid="setlist-add"
              >
                Add
              </Button>
            </div>
          )}
          {browsing && (
            <SongBrowser
              mode="screen"
              setName={setlist.name}
              contextType={ctxType}
              contextId={ctxId}
              userId={currentUser?.id ?? ''}
              catalogName={catalogName}
              inSet={inSet}
              otherSets={sets.filter(s => s.id !== setlistId)}
              onAdd={addSongs}
              onRemove={removeSong}
              onClose={() => navigate(-1)}
            />
          )}
        </>
      )}

      {/* ── Sheets ── */}
      {switcher !== false && (
        <SwitcherSheet
          rows={sets}
          currentId={setlistId}
          at={switcher}
          desktop={desktop}
          onPick={id => {
            setSwitcher(false)
            navigate(`/setlists/${id}`)
          }}
          onAll={() => navigate('/setlists')}
          onNew={create}
          onClose={() => setSwitcher(false)}
        />
      )}

      {headerMenu !== false && (
        <Sheet
          onClose={() => setHeaderMenu(false)}
          at={headerMenu}
          title={setlist.name}
          data-testid="setlist-header-sheet"
        >
          {!desktop && (
            <SheetItem
              icon={<FileText />}
              label="Notes"
              onClick={() => {
                setHeaderMenu(false)
                setNotes(true)
              }}
              data-testid="setlist-menu-notes"
            />
          )}
          <SheetItem
            icon={<Pencil />}
            label="Rename"
            onClick={() => {
              setHeaderMenu(false)
              setRenaming(true)
            }}
            data-testid="setlist-menu-rename"
          />
          <SheetItem
            icon={<Copy />}
            label="Duplicate"
            hint="Not attached to a show"
            onClick={handleDuplicate}
            data-testid="setlist-menu-duplicate"
          />
          <SheetItem
            icon={<Trash2 />}
            label="Delete…"
            danger
            onClick={handleDelete}
            data-testid="setlist-menu-delete"
          />
        </Sheet>
      )}

      {railMenu !== false && (
        <Sheet
          onClose={() => setRailMenu(false)}
          at={railMenu}
          title="Timeline"
          data-testid="setlist-rail-sheet"
        >
          <SheetItem
            icon={<Clock />}
            label="Clock"
            hint={start === null ? 'Needs a show start' : undefined}
            disabled={start === null}
            onClick={() => {
              setRailMode('clock')
              setRailOn(true)
              writeRail(true)
              setRailMenu(false)
            }}
            data-testid="setlist-rail-clock"
          />
          <SheetItem
            icon={<ListMusic />}
            label="Set time"
            hint="From the top"
            onClick={() => {
              setRailMode('set')
              setRailOn(true)
              writeRail(true)
              setRailMenu(false)
            }}
            data-testid="setlist-rail-set"
          />
        </Sheet>
      )}

      {rowMenuRow && (
        <RowMenuSheet
          row={rowMenuRow}
          setName={setlist.name}
          at={rowMenu.at}
          canUp={moveTarget(items, rowMenuRow.item.id, 'up') !== null}
          canDown={moveTarget(items, rowMenuRow.item.id, 'down') !== null}
          onMove={where => {
            const to = moveTarget(items, rowMenuRow.item.id, where)
            setRowMenu(null)
            if (to !== null) move(rowMenuRow.item.id, to)
          }}
          onAfter={() => {
            setRowMenu(null)
            setAfter({ kind: 'move', id: rowMenuRow.item.id })
          }}
          onNote={() => {
            setRowMenu(null)
            setItemNote(rowMenuRow.item.id)
          }}
          onOpen={() =>
            rowMenuRow.item.songId && openSong(rowMenuRow.item.songId)
          }
          onEdit={() => {
            setRowMenu(null)
            setEditing(rowMenuRow.item.id)
          }}
          onRemove={() => {
            setRowMenu(null)
            void remove(rowMenuRow.item.id)
          }}
          onClose={() => setRowMenu(null)}
        />
      )}

      {after && (
        <AfterSheet
          rows={rows}
          movingId={after.kind === 'move' ? after.id : ''}
          onPick={afterId => {
            if (after.kind === 'move') moveAfter(after.id, afterId)
            else setInsert(i => i && { ...i, after: afterId })
            setAfter(null)
          }}
          onClose={() => setAfter(null)}
        />
      )}

      {addMenu && (
        <AddMenuSheet
          setName={setlist.name}
          catalogName={catalogName}
          onPick={what => {
            setAddMenu(false)
            if (what === 'songs') setBrowsing(true)
            else
              setInsert({
                type: what,
                after: anchor ?? items[items.length - 1]?.id ?? null,
              })
          }}
          onClose={() => setAddMenu(false)}
        />
      )}

      {insert && !after && (
        <InsertSheet
          type={insert.type}
          defaultLabel={nextSectionLabel(items)}
          afterLabel={
            insertAfterRow
              ? insertAfterRow.kind === 'song'
                ? `#${insertAfterRow.number} ${rowLabel(insertAfterRow)}`
                : rowLabel(insertAfterRow)
              : 'Top of the set'
          }
          onAfter={() => setAfter({ kind: 'insert' })}
          onInsert={item => {
            setInsert(null)
            void insertItem(item, insert.after ?? TOP)
          }}
          onClose={() => setInsert(null)}
        />
      )}

      {notes && (
        <NotesSheet
          title="Set notes"
          sub={`Only in ${setlist.name}`}
          value={setlist.notes ?? ''}
          markdown
          onSave={v =>
            void attempt('Save notes', () =>
              run(() => setSetlistNotes(setlistId, v))
            )
          }
          onClose={() => setNotes(false)}
          data-testid="setlist-notes-sheet"
        />
      )}

      {itemNote && (
        <NotesSheet
          title="Note for this set"
          sub={`Only shows in ${setlist.name}`}
          value={items.find(i => i.id === itemNote)?.notes ?? ''}
          markdown={false}
          onSave={v => void saveItem(itemNote, { notes: v })}
          onClose={() => setItemNote(null)}
          data-testid="setlist-item-note-sheet"
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

/** Applies an update_setlist_item patch locally (same rules as the server). */
function patchItem(item: SetlistItem, patch: ItemPatch): SetlistItem {
  if (item.type === 'break')
    return {
      ...item,
      ...(patch.breakDuration !== undefined && {
        breakDuration: patch.breakDuration,
      }),
      ...(patch.breakNotes !== undefined && {
        breakNotes: patch.breakNotes.trim() || undefined,
      }),
    }
  if (item.type === 'section' && patch.sectionTitle !== undefined)
    return { ...item, sectionTitle: patch.sectionTitle.trim() }
  if (item.type === 'song' && patch.notes !== undefined)
    return { ...item, notes: patch.notes.trim() || undefined }
  return item
}

/** Press and hold (500 ms) a button; `held()` swallows the click that follows. */
function useRailHold(onHold: (el: HTMLElement) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return {
    held: () => {
      const h = held.current
      held.current = false
      return h
    },
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        held.current = false
        const el = e.currentTarget
        timer.current = setTimeout(() => {
          held.current = true
          onHold(el)
        }, 500)
      },
      onPointerUp: stop,
      onPointerLeave: stop,
    },
  }
}
