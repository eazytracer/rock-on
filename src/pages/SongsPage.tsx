/**
 * Songs (redesign phase 2 · design/demo/screens/Song Row.html, Final Pass
 * 13–17, desktop.js Songs). One catalog per context: the band's songs, or My
 * Songs in Personal. Tap a row to open it (desktop: the pane), hold or
 * right-click for the menu, swipe left for Hide / Add to set.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Music2,
  SearchX,
  X,
  Copy,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useSongs, usePersonalSongs, useDeleteSong } from '../hooks/useSongs'
import { useHiddenSongs } from '../hooks/useHiddenSongs'
import { useBulkPersonalNotePresence } from '../hooks/useNotes'
import { useMediaQuery } from '../hooks/useResponsive'
import {
  useListView,
  useSongNextShows,
  useNotInMyCatalog,
  useCopyToPersonal,
  useDuplicateSong,
  useSaveSong,
} from '../hooks/useSongCatalog'
import { useConfirm } from '../hooks/useConfirm'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { EditSongModal } from '../components/songs/EditSongModal'
import { SongRow } from '../components/songs/SongRow'
import { SongDetail } from '../components/songs/SongDetail'
import { TuningFilter } from '../components/songs/TuningFilter'
import {
  SongMenu,
  ViewOptionsSheet,
  SortSheet,
  SortIcon,
  AddToSetlistSheet,
} from '../components/songs/SongSheets'
import {
  Button,
  Chip,
  Empty,
  PageTitle,
  RetryCard,
  Sheet,
  SkeletonRow,
  TuningPill,
} from '../components/ui'
import type { Song } from '../models/Song'
import {
  SORT_LABELS,
  filterSongs,
  noteMark,
  sortSongs,
  tuningsInUse,
  usageSummary,
} from '../domain/songs'
import { songUsage } from '../services/api/songs'
import { createLogger } from '../utils/logger'

const log = createLogger('SongsPage')

type Editing = { song?: Song } | null
type MenuState = { song: Song; at: { x: number; y: number } | null } | null

export const SongsPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const { currentBand, currentBandId, currentUser } = useAuth()
  const userId = currentUser?.id ?? ''
  const bandId = currentBandId ?? ''
  const isBand = !!currentBandId
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const hasPane = useMediaQuery('(min-width: 1440px)')

  const band = useSongs(bandId)
  const personal = usePersonalSongs(userId)
  const { songs, loading, error, refetch } = isBand ? band : personal

  const [view, setView] = useListView(
    userId,
    `songs:${currentBandId ?? 'personal'}`
  )
  const nextShows = useSongNextShows(bandId)
  const { hiddenIds, hide, unhide } = useHiddenSongs()
  const { deleteSong } = useDeleteSong()
  const duplicate = useDuplicateSong()
  const copyToMine = useCopyToPersonal()
  const saveSong = useSaveSong(currentBandId, userId)
  const { confirm, dialogProps } = useConfirm()

  const [query, setQuery] = useState('')
  const [tuning, setTuning] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  const [menuUsage, setMenuUsage] = useState('')
  const [sheet, setSheet] = useState<'view' | 'sort' | 'pick' | null>(null)
  const [addToSet, setAddToSet] = useState<Song | null>(null)

  // Band songs already copied to My Songs (for the menu and the link mark).
  const copiedIds = useMemo(
    () =>
      new Set(
        personal.songs.map(s => s.linkedFromSongId).filter(Boolean) as string[]
      ),
    [personal.songs]
  )

  const hiddenCount = useMemo(
    () => songs.filter(s => hiddenIds.has(s.id)).length,
    [songs, hiddenIds]
  )
  const tunings = useMemo(() => tuningsInUse(songs), [songs])
  const tuningCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of songs) {
      const t = s.guitarTuning || 'Standard'
      m.set(t, (m.get(t) ?? 0) + 1)
    }
    return m
  }, [songs])
  const nextShowAt = useMemo(
    () => new Map([...nextShows].map(([id, n]) => [id, n.at])),
    [nextShows]
  )

  const visible = useMemo(() => {
    const shown = view.showHidden
      ? songs
      : songs.filter(s => !hiddenIds.has(s.id))
    return sortSongs(
      filterSongs(shown, query, tuning),
      view.sort,
      view.dir,
      nextShowAt
    )
  }, [songs, hiddenIds, view, query, tuning, nextShowAt])

  const myNotes = useBulkPersonalNotePresence(
    useMemo(() => visible.map(s => s.id), [visible]),
    userId,
    bandId
  )

  const selected = hasPane
    ? (songs.find(s => s.id === selectedId) ?? visible[0] ?? null)
    : null

  // /songs?song=<id> (search, notifications) opens that song.
  useEffect(() => {
    const id = searchParams.get('song')
    if (!id) return
    const next = new URLSearchParams(searchParams)
    next.delete('song')
    setSearchParams(next, { replace: true })
    if (hasPane) setSelectedId(id)
    else navigate(`/songs/${id}`)
  }, [searchParams, setSearchParams, hasPane, navigate])

  const open = (song: Song) =>
    hasPane ? setSelectedId(song.id) : navigate(`/songs/${song.id}`)

  const openMenu = useCallback(
    (song: Song, at: { x: number; y: number } | null) => {
      setMenu({ song, at })
      setMenuUsage('')
      songUsage(song.id)
        .then(u => setMenuUsage(usageSummary(u)))
        .catch(() => setMenuUsage(''))
    },
    []
  )

  const toggleHidden = async (song: Song) => {
    if (hiddenIds.has(song.id)) {
      await unhide(song.id)
      showToast(`"${song.title}" is back in your list`, 'success')
    } else {
      await hide(song.id)
      showToast(
        'Hidden. Turn on Show hidden songs under View to see it.',
        'success'
      )
    }
  }

  const handleDelete = async (song: Song) => {
    let summary = ''
    try {
      summary = usageSummary(await songUsage(song.id))
    } catch (err) {
      log.error('song_usage failed', err)
    }
    const ok = await confirm({
      title: `Delete "${song.title}"?`,
      message: summary
        ? `${summary}. It comes out of those setlists. This can't be undone.`
        : "This can't be undone.",
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteSong(song.id)
      if (selectedId === song.id) setSelectedId(null)
      showToast(`Deleted "${song.title}"`, 'success')
    } catch (err) {
      log.error('Error deleting song', err)
      showToast("Couldn't delete it. Try again.", 'error')
    }
  }

  const handleDuplicate = async (song: Song) => {
    try {
      const id = await duplicate(song.id)
      showToast(`Duplicated "${song.title}"`, 'success')
      if (hasPane) setSelectedId(id)
    } catch (err) {
      log.error('Error duplicating song', err)
      showToast("Couldn't duplicate it. Try again.", 'error')
    }
  }

  const handleCopyToMine = async (ids: string[] | null) => {
    try {
      const n = await copyToMine(ids)
      showToast(
        n === 1 ? 'Added 1 song to My Songs' : `Added ${n} songs to My Songs`,
        'success'
      )
    } catch (err) {
      log.error('Copy to My Songs failed', err)
      showToast("Couldn't copy them. Try again.", 'error')
    }
  }

  const rowProps = (song: Song) => ({
    song,
    view,
    layout: (isDesktop ? 'table' : 'list') as 'table' | 'list',
    mark: noteMark(!!song.notes?.trim(), myNotes.has(song.id)),
    nextShow: nextShows.get(song.id)?.name,
    hidden: hiddenIds.has(song.id),
    linked: isBand ? copiedIds.has(song.id) : !!song.linkedFromSongId,
    selected: selected?.id === song.id,
    onOpen: () => open(song),
    onMenu: (at: { x: number; y: number } | null) => openMenu(song, at),
    onHide: () => toggleHidden(song),
    onAddToSet: () => setAddToSet(song),
  })

  const addButton = (
    <Button
      variant="primary"
      onClick={() => setEditing({})}
      data-testid="add-song-button"
      className={
        isDesktop ? '' : 'fixed right-4 bottom-[104px] z-30 shadow-float'
      }
    >
      <Plus size={18} /> Add song
    </Button>
  )

  const sortLabel = (
    <>
      {SORT_LABELS[view.sort]}
      {(view.sort === 'title' ||
        view.sort === 'artist' ||
        view.sort === 'nextShow') && <SortIcon dir={view.dir} />}
    </>
  )

  const list = () => {
    if (loading)
      return (
        <div className="rounded-[20px] bg-bg-2 shadow-group md:rounded-none md:bg-transparent md:shadow-none">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )
    if (error)
      return (
        <RetryCard
          message="Couldn't load your songs."
          onRetry={() => void refetch()}
        />
      )
    if (songs.length === 0)
      return (
        <Empty
          icon={<Music2 size={28} />}
          title="No songs yet"
          why={
            isBand
              ? 'Add the songs your band plays. Only the title is required.'
              : 'Songs you add here are just for you.'
          }
          action={
            <Button variant="primary" onClick={() => setEditing({})}>
              <Plus size={18} /> Add song
            </Button>
          }
          data-testid="songs-empty"
        />
      )
    if (visible.length === 0)
      return (
        <Empty
          icon={<SearchX size={28} />}
          title="No matches"
          why={
            query ? `Nothing matches "${query}".` : 'No songs in that tuning.'
          }
          action={
            <Button
              onClick={() => {
                setQuery('')
                setTuning(null)
              }}
            >
              Clear
            </Button>
          }
          data-testid="songs-no-matches"
        />
      )
    if (isDesktop)
      return (
        <div role="table" aria-label="Songs" data-testid="songs-table">
          <div className="grid grid-cols-[minmax(0,1fr)_96px_52px_52px_64px_92px_72px] gap-2 pl-7 pr-4 h-10 items-center border-b border-divider font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3">
            <button
              type="button"
              className="flex items-center gap-1 text-left uppercase whitespace-nowrap"
              onClick={() =>
                setView(
                  view.sort === 'title'
                    ? { dir: view.dir === 'asc' ? 'desc' : 'asc' }
                    : { sort: 'title', dir: 'asc' }
                )
              }
            >
              Title{view.artist && ' · Artist'}
              {view.sort === 'title' && <SortIcon dir={view.dir} />}
            </button>
            <span>Tuning</span>
            <span>{view.key && 'Key'}</span>
            <span>{view.bpm && 'BPM'}</span>
            <span>Length</span>
            <span>{view.links && 'Links'}</span>
            <span />
          </div>
          {visible.map(s => (
            <SongRow key={s.id} {...rowProps(s)} />
          ))}
        </div>
      )
    return (
      <div
        className="rounded-[20px] bg-bg-2 shadow-group overflow-hidden"
        data-testid="songs-list"
      >
        {visible.map(s => (
          <SongRow key={s.id} {...rowProps(s)} />
        ))}
      </div>
    )
  }

  return (
    <div
      data-testid="songs-page"
      className={`md:-mx-7 lg:-mx-8 md:-mt-6 ${hasPane ? 'min-[1440px]:mr-[440px] 2xl:mr-[520px]' : ''}`}
    >
      <div className="md:px-7 lg:px-8 md:pt-6">
        <PageTitle
          title="Songs"
          eyebrow={isBand ? currentBand?.name : 'My Songs'}
          count={songs.length}
          actions={isDesktop ? addButton : undefined}
          testId="songs-title"
        />

        {!isBand && (
          <PersonalBanner
            userId={userId}
            onCopyAll={() => handleCopyToMine(null)}
            onPick={() => setSheet('pick')}
          />
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-2.5 mb-4">
          <label className="relative flex items-center md:w-[260px] md:shrink-0">
            <Search size={17} className="absolute left-3.5 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search title, artist, album"
              aria-label="Search songs"
              name="songSearch"
              id="song-search"
              data-testid="song-search"
              className="w-full h-11 pl-10 pr-3 rounded-full md:rounded-xl bg-bg-3 text-[15px] text-ink-1 placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <div className="min-w-0 md:flex-1">
            <TuningFilter
              tunings={tunings}
              counts={tuningCounts}
              value={tuning}
              onChange={setTuning}
              fit={isDesktop}
            />
          </div>
          <div className="flex items-center gap-2">
            <Chip
              icon={<ArrowUpDown size={15} />}
              onClick={() => setSheet('sort')}
              data-testid="song-sort-trigger"
            >
              {sortLabel}
            </Chip>
            <Chip
              icon={<SlidersHorizontal size={15} />}
              on={view.showHidden}
              onClick={() => setSheet('view')}
              data-testid="songs-view-button"
            >
              View
              {hiddenCount > 0 && (
                <span className="font-mono text-[11.5px] opacity-70">
                  {hiddenCount} hidden
                </span>
              )}
            </Chip>
          </div>
        </div>
      </div>

      {list()}

      {!isDesktop && songs.length > 0 && addButton}

      {hasPane && selected && (
        <aside
          className="fixed right-0 top-0 h-screen w-[440px] 2xl:w-[520px] border-l border-border-1 bg-bg-1 overflow-y-auto custom-scrollbar-thin px-6 pt-7"
          data-testid="song-pane"
        >
          <SongDetail
            key={selected.id}
            song={selected}
            userId={userId}
            pane
            onEdit={() => setEditing({ song: selected })}
          />
        </aside>
      )}

      {editing && (
        <EditSongModal
          song={editing.song}
          mode={editing.song ? 'edit' : 'add'}
          showAlsoSaveToPersonal={isBand}
          onClose={() => setEditing(null)}
          onSave={async (song, options) => {
            try {
              const id = await saveSong(
                song,
                !editing.song,
                options?.alsoSaveToPersonal
              )
              showToast(
                editing.song
                  ? `Saved "${song.title}"`
                  : options?.alsoSaveToPersonal
                    ? `Added "${song.title}" to the band and My Songs`
                    : `Added "${song.title}"`,
                'success'
              )
              setEditing(null)
              if (hasPane) setSelectedId(id)
            } catch (err) {
              log.error('Error saving song', err)
              showToast("Couldn't save the song. Try again.", 'error')
              throw err
            }
          }}
        />
      )}

      {menu && (
        <SongMenu
          song={menu.song}
          at={menu.at}
          hidden={hiddenIds.has(menu.song.id)}
          inMySongs={copiedIds.has(menu.song.id)}
          usage={menuUsage}
          onClose={() => setMenu(null)}
          onOpen={() => navigate(`/songs/${menu.song.id}`)}
          onEdit={() => setEditing({ song: menu.song })}
          onAddToSet={() => setAddToSet(menu.song)}
          onCopyToMine={
            isBand ? () => handleCopyToMine([menu.song.id]) : undefined
          }
          onDuplicate={() => handleDuplicate(menu.song)}
          onToggleHidden={() => toggleHidden(menu.song)}
          onDelete={() => handleDelete(menu.song)}
        />
      )}

      {sheet === 'view' && (
        <ViewOptionsSheet
          view={view}
          hiddenCount={hiddenCount}
          onChange={setView}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'sort' && (
        <SortSheet
          view={view}
          canNextShow={isBand}
          onChange={changes => {
            setView(changes)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'pick' && (
        <PickSongsSheet
          userId={userId}
          onCopy={ids => handleCopyToMine(ids)}
          onClose={() => setSheet(null)}
        />
      )}
      {addToSet && (
        <AddToSetlistSheet
          song={addToSet}
          onClose={() => setAddToSet(null)}
          onNewSetlist={() => navigate('/setlists/new')}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

/** Personal: "N songs in your bands aren't in My Songs · Copy all · Pick some". */
const PersonalBanner: React.FC<{
  userId: string
  onCopyAll: () => void
  onPick: () => void
}> = ({ userId, onCopyAll, onPick }) => {
  const gaps = useNotInMyCatalog(userId, true)
  const [dismissed, setDismissed] = useState(false)
  if (!gaps.length || dismissed) return null
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] bg-info/10 px-4 py-3"
      data-testid="songs-personal-banner"
    >
      <Copy size={18} className="text-info shrink-0" />
      <p className="flex-1 min-w-[180px] text-[14px] text-ink-1">
        <b>{gaps.length}</b> song{gaps.length === 1 ? '' : 's'} in your bands
        {gaps.length === 1 ? " isn't" : " aren't"} in My Songs
      </p>
      <Button size="md" onClick={onCopyAll} data-testid="songs-copy-all">
        Copy all
      </Button>
      <Button
        size="md"
        variant="text"
        onClick={onPick}
        data-testid="songs-pick-some"
      >
        Pick some
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-ink-3 hover:text-ink-1"
      >
        <X size={17} />
      </button>
    </div>
  )
}

const PickSongsSheet: React.FC<{
  userId: string
  onCopy: (ids: string[]) => void
  onClose: () => void
}> = ({ userId, onCopy, onClose }) => {
  const gaps = useNotInMyCatalog(userId, true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <Sheet
      onClose={onClose}
      title="Copy to My Songs"
      sub="Linked copies that follow the band's version"
      data-testid="songs-pick-sheet"
    >
      <div className="max-h-[52vh] overflow-y-auto custom-scrollbar-thin divide-y divide-divider">
        {gaps.map(g => (
          <label
            key={g.id}
            className="flex items-center gap-3 min-h-[52px] px-1 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={picked.has(g.id!)}
              onChange={() => toggle(g.id!)}
              className="w-5 h-5 accent-[rgb(var(--accent-rgb))]"
              data-testid={`songs-pick-${g.id}`}
            />
            <span className="flex-1 min-w-0">
              <span className="block truncate text-[15px] font-bold text-ink-1">
                {g.title}
              </span>
              <span className="block truncate text-[12.5px] text-ink-3">
                {[g.artist, g.band_name].filter(Boolean).join(' · ')}
              </span>
            </span>
            <TuningPill tuning={g.guitar_tuning} size="sm" />
          </label>
        ))}
      </div>
      <Button
        variant="primary"
        className="mt-3 mb-1 w-full"
        disabled={!picked.size}
        onClick={() => {
          onCopy([...picked])
          onClose()
        }}
        data-testid="songs-pick-copy"
      >
        Copy {picked.size || ''} to My Songs
      </Button>
    </Sheet>
  )
}
