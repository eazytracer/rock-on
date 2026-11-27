/**
 * /songs/:songId?from=<origin> — the song page (docs/redesign/10 · Part 1), the
 * one place a song is edited. Back is named after where you came from and links
 * there; ‹ › (J / K) step through that same list. Facts save per field with
 * Undo; notes edit in place with Done.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  useSong,
  useDuplicateSong,
  useCopyToPersonal,
  useSongFieldSave,
} from '../hooks/useSongCatalog'
import { useSongOrigin } from '../hooks/useSongOrigin'
import { useDeleteSong, usePersonalSongs } from '../hooks/useSongs'
import { useHiddenSongs } from '../hooks/useHiddenSongs'
import { useConfirm } from '../hooks/useConfirm'
import { useMediaQuery } from '../hooks/useResponsive'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { MoreButton } from '../components/common/MoreButton'
import { BackCrumb } from '../components/layout/MobileHeader'
import { SongFacts } from '../components/songs/SongFacts'
import { SongNotes, type NoteLayerKey } from '../components/songs/SongNotes'
import { SongSide } from '../components/songs/SongSide'
import { SongMenu } from '../components/songs/SongSheets'
import { Empty } from '../components/ui'
import { songUsage } from '../services/api/songs'
import { usageSummary } from '../domain/songs'
import { parseOrigin, songHref, originHref } from '../utils/songOrigin'
import { createLogger } from '../utils/logger'

const log = createLogger('SongViewPage')

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

export const SongViewPage: React.FC = () => {
  const { songId = '' } = useParams()
  const navigate = useNavigate()
  const { hash, search } = useLocation()
  const [params] = useSearchParams()
  const origin = useMemo(() => parseOrigin(search), [search])
  const { showToast } = useToast()
  const { currentBand, currentUser } = useAuth()
  const userId = currentUser?.id ?? ''
  const desktop = useMediaQuery('(min-width: 1024px)')
  const anchored = useMediaQuery('(min-width: 768px)')

  const { song, loading } = useSong(songId)
  const saveField = useSongFieldSave(song)
  const where = useSongOrigin(origin, song, userId)
  const duplicate = useDuplicateSong()
  const copyToMine = useCopyToPersonal()
  const { deleteSong } = useDeleteSong()
  const { songs: mine } = usePersonalSongs(userId)
  const { hiddenIds, hide, unhide } = useHiddenSongs()
  const { confirm, dialogProps } = useConfirm()
  const [menu, setMenu] = useState(false)
  const [usage, setUsage] = useState('')
  const [editing, setEditing] = useState<NoteLayerKey | null>(null)

  const go = useCallback(
    (id?: string) => id && navigate(songHref(id, origin), { replace: true }),
    [navigate, origin]
  )

  // Arriving on a song: #notes scrolls to the notes. Stepping to another song
  // closes any open note.
  const ready = !!song
  useEffect(() => {
    if (!ready) return
    setEditing(null)
    if (hash === '#notes')
      requestAnimationFrame(() =>
        document.getElementById('notes')?.scrollIntoView({ block: 'start' })
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, songId])

  // Keys: Esc = Back, J / K = next / prev, E = edit the band note. Not while
  // typing, editing a note, or with a sheet or dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      if (editing) return
      const k = e.key.toLowerCase()
      if (e.key === 'Escape') navigate(where.href)
      else if (k === 'j') go(where.step?.next)
      else if (k === 'k') go(where.step?.prev)
      else if (k === 'e') {
        e.preventDefault()
        setEditing('band')
        document.getElementById('notes')?.scrollIntoView({ block: 'start' })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editing, go, navigate, where.href, where.step])

  if (loading)
    return <ContentLoadingSpinner isLoading>{null}</ContentLoadingSpinner>

  const backButton = (
    <BackCrumb
      to={where.href}
      label={where.label}
      data-testid="song-page-back"
    />
  )

  if (!song)
    return (
      <div data-testid="song-view-page">
        <BackCrumb
          to={where.href}
          label={where.label}
          className="mb-4"
          data-testid="song-page-back"
        />
        <Empty
          icon={<Music2 size={28} />}
          title="This song was deleted."
          why="It's no longer in this catalog."
          data-testid="song-view-missing"
        />
      </div>
    )

  const isBand = song.contextType === 'band'
  const hidden = hiddenIds.has(song.id)
  // A direct link (no ?from) has no list to step through: Back only.
  const step = params.has('from') ? where.step : null
  // Notes can't be left mid-edit by stepping; finish or cancel first.
  const stepTo = (id?: string) => {
    if (editing) {
      showToast("Finish or cancel the note you're editing", 'info')
      return
    }
    go(id)
  }
  const run = async (what: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      log.error(what, err)
      showToast("That didn't work. Try again.", 'error')
    }
  }
  const openMenu = () => {
    setMenu(true)
    songUsage(song.id)
      .then(u => setUsage(usageSummary(u)))
      .catch(() => setUsage(''))
  }
  const setlistNote =
    origin.kind === 'setlist' && where.setlistItem
      ? {
          id: origin.id,
          name: where.setlistName ?? 'this set',
          item: where.setlistItem,
        }
      : undefined
  const bandName = isBand ? currentBand?.name : 'My Songs'

  const menuButton = (
    <MoreButton
      label="Song menu"
      onClick={openMenu}
      data-testid="song-view-menu"
    />
  )

  const stepper = step && (
    <div className="flex items-center gap-1" data-testid="song-page-stepper">
      <button
        type="button"
        onClick={() => stepTo(step.prev)}
        disabled={!step.prev}
        aria-label="Previous song"
        className="w-10 h-10 grid place-items-center rounded-full text-ink-1 hover:bg-bg-3 disabled:text-ink-5 disabled:hover:bg-transparent"
        data-testid="song-page-prev"
      >
        <ChevronLeft size={19} />
      </button>
      <span
        className="font-mono text-[12.5px] text-ink-3 min-w-[56px] text-center"
        data-testid="song-page-position"
      >
        {step.index + 1} of {step.total}
      </span>
      <button
        type="button"
        onClick={() => stepTo(step.next)}
        disabled={!step.next}
        aria-label="Next song"
        className="w-10 h-10 grid place-items-center rounded-full text-ink-1 hover:bg-bg-3 disabled:text-ink-5 disabled:hover:bg-transparent"
        data-testid="song-page-next"
      >
        <ChevronRight size={19} />
      </button>
    </div>
  )

  const notes = (
    <SongNotes
      song={song}
      userId={userId}
      editing={editing}
      setEditing={setEditing}
      setlist={setlistNote}
    />
  )
  const side = (
    <SongSide
      song={song}
      onSave={saveField}
      bandName={currentBand?.name}
      hasLinkedCopy={mine.some(m => m.linkedFromSongId === song.id)}
      showKeys={desktop}
    />
  )

  return (
    <div data-testid="song-view-page">
      {desktop ? (
        <div className="sticky top-0 z-20 -mx-7 lg:-mx-8 -mt-6 mb-7 h-[68px] px-7 lg:px-8 flex items-center gap-3 bg-bg-1/95 backdrop-blur border-b border-divider">
          {backButton}
          <p
            className="min-w-0 truncate font-mono text-[11.5px] tracking-[.12em] uppercase text-ink-3"
            data-testid="song-page-crumbs"
          >
            {[bandName, ...where.crumbs].filter(Boolean).join(' / ')} /{' '}
            <span className="text-ink-2">{song.title}</span>
          </p>
          <span className="ml-auto" />
          {stepper}
          {menuButton}
        </div>
      ) : (
        <BackCrumb
          to={where.href}
          label={where.label}
          className="mb-4"
          data-testid="song-page-back"
        />
      )}

      <div className={desktop ? 'max-w-[1180px] mx-auto' : 'max-w-3xl'}>
        <SongFacts
          song={song}
          onSave={saveField}
          desktop={anchored}
          menu={desktop ? undefined : menuButton}
        />

        {desktop ? (
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_300px] gap-6 min-[1180px]:grid-cols-[minmax(0,1fr)_340px] min-[1180px]:gap-8 items-start">
            <div>{notes}</div>
            <div>{side}</div>
          </div>
        ) : (
          <>
            {notes}
            <div className="pb-8">{side}</div>
          </>
        )}
      </div>

      {menu && (
        <SongMenu
          song={song}
          at={null}
          hidden={hidden}
          inMySongs={mine.some(m => m.linkedFromSongId === song.id)}
          usage={usage}
          onClose={() => setMenu(false)}
          onCopyToMine={
            isBand
              ? () =>
                  run('copy', async () => {
                    await copyToMine([song.id])
                    showToast('Added to My Songs', 'success')
                  })
              : undefined
          }
          onDuplicate={() =>
            run('duplicate', async () => {
              const id = await duplicate(song.id)
              showToast(`Duplicated "${song.title}"`, 'success')
              navigate(songHref(id, { kind: 'songs' }))
            })
          }
          onToggleHidden={() =>
            run('hide', () => (hidden ? unhide(song.id) : hide(song.id)))
          }
          onDelete={() =>
            run('delete', async () => {
              const ok = await confirm({
                title: `Delete "${song.title}"?`,
                message: usage
                  ? `${usage}. It comes out of those setlists. This can't be undone.`
                  : "This can't be undone.",
                confirmLabel: 'Delete',
                variant: 'danger',
              })
              if (!ok) return
              await deleteSong(song.id)
              showToast(`Deleted "${song.title}"`, 'success')
              navigate(originHref(origin), { replace: true })
            })
          }
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
