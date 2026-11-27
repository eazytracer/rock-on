/**
 * The song page's origin (docs/redesign/10 · 1.1): Back's label and link, the
 * breadcrumb, and the list ‹ › steps through, resolved from `?from=`.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import { repository } from '../services/data/RepositoryFactory'
import { useSongs, usePersonalSongs } from './useSongs'
import { useHiddenSongs } from './useHiddenSongs'
import { useListView, useSongNextShows } from './useSongCatalog'
import { useSearch } from './useSearch'
import { catalogList } from '../domain/songs'
import { formatShowDate } from '../utils/dateHelpers'
import {
  originHref,
  originLabel,
  stepIn,
  type SongOrigin,
} from '../utils/songOrigin'
import type { Song } from '../models/Song'
import type { SetlistItem } from '../models/Setlist'

const STORE = 'rockon:songs-filter'

/** The Songs list's search and tuning filter, kept for the song page and Back. */
export interface SongsFilter {
  query: string
  tunings: string[]
  /** My Songs: only songs with all of these tags ("Jam songs"). */
  tags: string[]
}

export function readSongsFilter(contextKey: string): SongsFilter {
  try {
    const raw = sessionStorage.getItem(`${STORE}:${contextKey}`)
    const v = raw ? JSON.parse(raw) : null
    return {
      query: typeof v?.query === 'string' ? v.query : '',
      tunings: Array.isArray(v?.tunings) ? v.tunings : [],
      tags: Array.isArray(v?.tags) ? v.tags : [],
    }
  } catch {
    return { query: '', tunings: [], tags: [] }
  }
}

export function writeSongsFilter(contextKey: string, f: SongsFilter) {
  try {
    sessionStorage.setItem(`${STORE}:${contextKey}`, JSON.stringify(f))
  } catch {
    // Private mode / storage off: the song page falls back to the whole list.
  }
}

export interface ResolvedOrigin {
  label: string
  href: string
  /** Breadcrumb between the band and the song ("Setlists / Fall Set"). */
  crumbs: string[]
  /** Song ids ‹ › steps through, in order. */
  ids: string[]
  /** from=setlist: this song's item in that set ("In ‹set›" note). */
  setlistItem?: SetlistItem
  setlistName?: string
}

export function useSongOrigin(
  origin: SongOrigin,
  song: Song | null,
  userId: string
): ResolvedOrigin & { step: ReturnType<typeof stepIn> } {
  const isBand = song?.contextType === 'band'
  const bandId = isBand ? (song?.contextId ?? '') : ''
  const kind = origin.kind
  const id = 'id' in origin ? origin.id : ''

  // Songs: the catalog as the Songs page shows it (sort, hidden, filter).
  const band = useSongs(kind === 'songs' ? bandId : '')
  const personal = usePersonalSongs(kind === 'songs' && !isBand ? userId : '')
  const [view] = useListView(userId, `songs:${bandId || 'personal'}`)
  const { hiddenIds } = useHiddenSongs()
  const nextShows = useSongNextShows(kind === 'songs' ? bandId : '')

  const setlistId = kind === 'setlist' ? id : ''
  const show = useQuery({
    queryKey: queryKeys.shows.detail(id),
    queryFn: () => repository.getShow(id),
    enabled: kind === 'show' && !!id,
  })
  const practice = useQuery({
    queryKey: queryKeys.practices.detail(id),
    queryFn: () => repository.getPracticeSession(id),
    enabled: kind === 'practice' && !!id,
  })
  const listId =
    setlistId ||
    (kind === 'show' ? show.data?.setlistId : undefined) ||
    (kind === 'practice' && !practice.data?.songs?.length
      ? practice.data?.setlistId
      : undefined) ||
    ''
  const setlist = useQuery({
    queryKey: queryKeys.setlists.detail(listId),
    queryFn: () => repository.getSetlist(listId),
    enabled: !!listId,
  })
  const search = useSearch(
    origin.kind === 'search' ? origin.q : '',
    bandId || null,
    false
  )

  const resolved = useMemo((): ResolvedOrigin => {
    const setItems = (setlist.data?.items ?? EMPTY_ARRAY) as SetlistItem[]
    const setSongIds = setItems
      .filter(i => i.type === 'song' && i.songId)
      .map(i => i.songId!)
    switch (origin.kind) {
      case 'songs': {
        const contextKey = bandId || 'personal'
        const songs = isBand ? band.songs : personal.songs
        const nextShowAt = new Map(
          [...nextShows].map(([k, n]) => [k, n.at] as const)
        )
        return {
          label: originLabel(origin),
          href: originHref(origin, song?.id),
          crumbs: ['Songs'],
          ids: catalogList(
            songs,
            view,
            hiddenIds,
            readSongsFilter(contextKey),
            nextShowAt
          ).map(s => s.id),
        }
      }
      case 'setlist': {
        const name = setlist.data?.name
        return {
          label: originLabel(origin, name),
          href: originHref(origin, song?.id),
          crumbs: ['Setlists', name ?? '…'],
          ids: setSongIds,
          setlistItem: setItems.find(
            i => i.type === 'song' && i.songId === song?.id
          ),
          setlistName: name,
        }
      }
      case 'show': {
        const name = show.data?.name
        return {
          label: originLabel(origin, name),
          href: originHref(origin),
          crumbs: ['Calendar', name ?? '…'],
          ids: setSongIds,
        }
      }
      case 'practice': {
        const p = practice.data
        const name = p
          ? `Practice · ${formatShowDate(p.scheduledDate)}`
          : undefined
        const ids = p?.songs?.length
          ? p.songs.map(s => s.songId).filter(Boolean)
          : setSongIds
        return {
          label: originLabel(origin, name),
          href: originHref(origin),
          crumbs: ['Calendar', name ?? '…'],
          ids,
        }
      }
      case 'search':
        return {
          label: originLabel(origin),
          href: originHref(origin),
          crumbs: [`Search "${origin.q}"`],
          ids: (search.data ?? [])
            .filter(h => h.kind === 'song')
            .map(h => h.id),
        }
    }
  }, [
    origin,
    song?.id,
    bandId,
    isBand,
    band.songs,
    personal.songs,
    view,
    hiddenIds,
    nextShows,
    setlist.data,
    show.data,
    practice.data,
    search.data,
  ])

  const step = song ? stepIn(resolved.ids, song.id) : null
  return { ...resolved, step }
}
