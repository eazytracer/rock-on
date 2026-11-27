/**
 * Jam songs builder (/jam/songs, docs/redesign/11-jam.md decisions 5 and 11):
 * "Songs you'd jam on". Your jam songs are your My Songs songs tagged `jam`;
 * a check per song, the tagged ones checked. Your bands' songs are offered
 * too: picking one copies it to My Songs (a linked copy) tagged `jam`. Save
 * applies it all at once, then goes to `?returnTo=` (or back); Not now skips.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Plus, Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { usePersonalSongs, useSaveJamSongs } from '../../hooks/useSongs'
import { useNotInMyCatalog } from '../../hooks/useSongCatalog'
import { useMediaQuery } from '../../hooks/useResponsive'
import { DockAction } from '../../components/layout/PhoneDock'
import { BackCrumb } from '../../components/layout/MobileHeader'
import { SongLine } from '../../components/songs/SongLine'
import { Button, PageTitle, SkeletonRow } from '../../components/ui'
import {
  JAM_TAG,
  jamTagChanges,
  songMatchKey,
  toSongLine,
  type SongLineData,
} from '../../domain/songs'
import { createLogger } from '../../utils/logger'

const log = createLogger('JamSongsPage')

/** Only in-app paths ("/jam/abc"), never another origin. */
function safeReturnTo(v: string | null): string | null {
  return v && v.startsWith('/') && !v.startsWith('//') ? v : null
}

const HEADING =
  'px-3 pt-5 pb-1.5 font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3'

export const JamSongsPage: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('returnTo'))
  const { showToast } = useToast()
  const { currentUser } = useAuth()
  const userId = currentUser?.id ?? ''
  const desktop = useMediaQuery('(min-width: 768px)')
  const { songs: mySongs, loading } = usePersonalSongs(userId)
  const gaps = useNotInMyCatalog(userId, true)
  // Band songs not already in My Songs under the same title + artist (a song
  // in two bands is offered once).
  const bandSongs = useMemo(() => {
    const seen = new Set(mySongs.map(songMatchKey))
    return gaps.filter(g => {
      const k = songMatchKey(g)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [gaps, mySongs])
  const save = useSaveJamSongs()

  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  // Starts as the songs already tagged; set once My Songs has loaded.
  const [picked, setPicked] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (picked || loading) return
    setPicked(
      new Set(mySongs.filter(s => s.tags?.includes(JAM_TAG)).map(s => s.id))
    )
  }, [picked, loading, mySongs])
  const on = picked ?? new Set<string>()

  const toggle = (id: string) =>
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const t = q.trim().toLowerCase()
  const match = (s: { title: string; artist?: string | null }) =>
    !t ||
    s.title.toLowerCase().includes(t) ||
    (s.artist ?? '').toLowerCase().includes(t)
  const mine = useMemo(
    () => [...mySongs].sort((a, b) => a.title.localeCompare(b.title)),
    [mySongs]
  )
  // One heading per band, in the order the server sorts them (by title).
  const byBand = useMemo(() => {
    const m = new Map<string, typeof bandSongs>()
    for (const g of bandSongs)
      m.set(g.band_name, [...(m.get(g.band_name) ?? []), g])
    return [...m.entries()]
  }, [bandSongs])

  const bandIds = bandSongs.filter(g => on.has(g.id)).map(g => g.id)
  const count = mySongs.filter(s => on.has(s.id)).length + bandIds.length

  const leave = () => {
    if (returnTo) navigate(returnTo)
    else if (window.history.length > 1) navigate(-1)
    else navigate('/songs')
  }

  const submit = async () => {
    if (busy) return
    if (!jamTagChanges(mySongs, on).length && !bandIds.length) return leave()
    setBusy(true)
    try {
      await save({ mySongs, picked: on, bandIds })
      showToast(
        `Saved · ${count} jam ${count === 1 ? 'song' : 'songs'}`,
        'success'
      )
      leave()
    } catch (err) {
      log.error('Saving jam songs failed', err)
      showToast("Couldn't save your jam songs. Try again.", 'error')
    } finally {
      setBusy(false)
    }
  }

  const row = (id: string, line: SongLineData, sub?: string) => {
    const checked = on.has(id)
    return (
      <button
        key={id}
        type="button"
        disabled={busy}
        onClick={() => toggle(id)}
        aria-pressed={checked}
        aria-label={`${checked ? 'Not a jam song' : 'Jam on'} ${line.title}`}
        data-testid={`jam-songs-row-${id}`}
        data-checked={checked || undefined}
        className="group block w-full rounded-xl text-left hover:bg-bg-2"
      >
        <SongLine
          song={line}
          density="compact"
          className="px-3"
          sub={sub}
          trail={
            <span
              className={`w-7 h-7 shrink-0 grid place-items-center rounded-full ${
                checked
                  ? 'bg-accent text-on-accent'
                  : 'ring-[1.5px] ring-inset ring-border-1 text-ink-3 group-hover:text-ink-1 group-hover:ring-ink-3'
              }`}
            >
              {checked ? (
                <Check size={15} strokeWidth={3} />
              ) : (
                <Plus size={15} />
              )}
            </span>
          }
        />
      </button>
    )
  }

  const saveButton = (
    <Button
      variant="primary"
      onClick={submit}
      disabled={busy || !picked}
      className={desktop ? '' : 'w-full'}
      data-testid="jam-songs-save"
    >
      Save
    </Button>
  )
  const notNow = (
    <Button variant="text" onClick={leave} data-testid="jam-songs-not-now">
      Not now
    </Button>
  )

  const shownMine = mine.filter(match)
  const shownBands = byBand
    .map(([name, gs]) => [name, gs.filter(match)] as const)
    .filter(([, gs]) => gs.length)

  return (
    <div data-testid="jam-songs-page" className="pb-28 md:pb-10">
      <BackCrumb
        label="Back"
        onClick={leave}
        className="mb-4"
        data-testid="jam-songs-back"
      />
      <PageTitle
        title="Songs you'd jam on"
        eyebrow="Jam songs"
        actions={
          desktop ? (
            <>
              {notNow}
              {saveButton}
            </>
          ) : (
            notNow
          )
        }
        testId="jam-songs-title"
      />
      <p className="-mt-2 mb-4 text-[14px] text-ink-3 max-w-[560px]">
        Joining a jam shares these, so the room can see what everyone knows.
        Band songs you pick are copied to My Songs.
      </p>

      <label className="relative flex items-center md:w-[320px] mb-2">
        <Search size={17} className="absolute left-3.5 text-ink-3" />
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search your songs"
          aria-label="Search songs"
          name="jamSongsSearch"
          id="jam-songs-search"
          data-testid="jam-songs-search"
          className="w-full h-11 pl-10 pr-3 rounded-full bg-bg-3 text-[15px] text-ink-1 placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      <div className="max-w-[720px]" data-testid="jam-songs-list">
        {loading ? (
          Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
        ) : (
          <>
            <p className={HEADING}>My Songs</p>
            {shownMine.length ? (
              shownMine.map(s => row(s.id, toSongLine(s)))
            ) : (
              <p className="px-3 py-3 text-[14px] text-ink-3">
                {t ? 'No songs match.' : 'No songs in My Songs yet.'}
              </p>
            )}
            {shownBands.map(([name, gs]) => (
              <React.Fragment key={name}>
                <p className={HEADING}>From {name}</p>
                {gs.map(g =>
                  row(
                    g.id,
                    {
                      title: g.title,
                      artist: g.artist,
                      tuning: g.guitar_tuning,
                      seconds: g.duration || 0,
                    },
                    on.has(g.id) ? 'Copies to My Songs' : undefined
                  )
                )}
              </React.Fragment>
            ))}
          </>
        )}
      </div>

      {!desktop && <DockAction>{saveButton}</DockAction>}
    </div>
  )
}

export default JamSongsPage
