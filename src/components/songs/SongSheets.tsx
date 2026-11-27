/**
 * Sheets for the song list: the hold / right-click menu, View options, Sort,
 * and Add to….
 */
import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  ListPlus,
  CopyPlus,
  Copy,
  EyeOff,
  Eye,
  Trash2,
  User,
  Hash,
  Activity,
  Link2,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Check,
  Plus,
  ListMusic,
} from 'lucide-react'
import type { Song } from '../../models/Song'
import { Sheet, SheetItem, Segmented, Switch, TuningPill } from '../ui'
import { formatSeconds } from '../../domain/format'
import {
  SORT_KINDS,
  SORT_LABELS,
  type ListView,
  type SortField,
} from '../../domain/songs'
import { defaultDir } from '../../domain/sort'
import { useSetlistIndex } from '../../hooks/useSetlists'
import {
  addSongsToSetlist,
  removeSetlistItem,
} from '../../services/api/setlists'
import { repository } from '../../services/data/RepositoryFactory'
import { queryKeys } from '../../services/queryClient'
import {
  freshPracticeSong,
  practiceStatus,
  practiceTitle,
} from '../../domain/calendar'
import { formatShowDate } from '../../utils/dateHelpers'
import { useToast } from '../../contexts/ToastContext'
import { createLogger } from '../../utils/logger'

const log = createLogger('SongSheets')

export interface SongMenuProps {
  song: Song
  at: { x: number; y: number } | null
  hidden: boolean
  /** Band songs only: is there already a linked copy in My Songs? */
  inMySongs?: boolean
  usage: string
  onClose: () => void
  /** Rows and the pane; the song page itself has no Open. */
  onOpen?: () => void
  onAddToSet?: () => void
  onCopyToMine?: () => void
  onDuplicate: () => void
  onToggleHidden: () => void
  onDelete: () => void
}

export const SongMenu: React.FC<SongMenuProps> = ({
  song,
  at,
  hidden,
  inMySongs,
  usage,
  onClose,
  onOpen,
  onAddToSet,
  onCopyToMine,
  onDuplicate,
  onToggleHidden,
  onDelete,
}) => {
  const run = (fn: () => void) => () => {
    onClose()
    fn()
  }
  return (
    <Sheet
      onClose={onClose}
      at={at}
      title={
        at ? (
          song.title
        ) : (
          <span className="flex items-center gap-3">
            <TuningPill tuning={song.guitarTuning || 'Standard'} />
            <span className="min-w-0">
              <span className="block truncate text-[17px]">{song.title}</span>
              <span className="block truncate text-[12.5px] font-normal text-ink-3">
                {[formatSeconds(song.duration), song.artist]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </span>
        )
      }
      data-testid="song-menu"
    >
      <div role="menu" className="divide-y divide-divider md:divide-y-0">
        {onOpen && (
          <SheetItem
            icon={<ExternalLink />}
            label="Open song"
            onClick={run(onOpen)}
            data-testid="song-menu-open"
          />
        )}
        {onAddToSet && (
          <SheetItem
            icon={<ListPlus />}
            label="Add to…"
            onClick={run(onAddToSet)}
            data-testid="add-to-setlist-button"
          />
        )}
        {onCopyToMine && (
          <SheetItem
            icon={<CopyPlus />}
            label={inMySongs ? 'In My Songs' : 'Add to My Songs'}
            hint="Linked copy"
            disabled={inMySongs}
            onClick={run(onCopyToMine)}
            data-testid="copy-to-personal-button"
          />
        )}
        <SheetItem
          icon={<Copy />}
          label="Duplicate"
          onClick={run(onDuplicate)}
          data-testid="duplicate-song-button"
        />
        <SheetItem
          icon={hidden ? <Eye /> : <EyeOff />}
          label={hidden ? 'Show again' : 'Hide'}
          hint="Just for you"
          onClick={run(onToggleHidden)}
          data-testid={hidden ? 'song-readd-button' : 'song-hide-button'}
        />
        <SheetItem
          icon={<Trash2 />}
          label="Delete…"
          hint={usage}
          danger
          onClick={run(onDelete)}
          data-testid="delete-song-button"
        />
      </div>
    </Sheet>
  )
}

const FIELDS: {
  key: keyof Pick<ListView, 'artist' | 'key' | 'bpm' | 'links' | 'nextShow'>
  label: string
  sub?: string
  icon: React.ReactNode
}[] = [
  {
    key: 'artist',
    label: 'Artist',
    sub: 'On by default in the catalog',
    icon: <User />,
  },
  { key: 'key', label: 'Key', icon: <Hash /> },
  { key: 'bpm', label: 'BPM', icon: <Activity /> },
  {
    key: 'links',
    label: 'Links',
    sub: 'Up to 2 · tap to open',
    icon: <Link2 />,
  },
  {
    key: 'nextShow',
    label: 'Next show',
    sub: 'Catalog only',
    icon: <CalendarDays />,
  },
]

export const ViewOptionsSheet: React.FC<{
  view: ListView
  hiddenCount: number
  onChange: (changes: Partial<ListView>) => void
  onClose: () => void
}> = ({ view, hiddenCount, onChange, onClose }) => (
  <Sheet
    onClose={onClose}
    title="View options"
    sub="Songs list · saved to your account"
    data-testid="songs-view-sheet"
  >
    <Segmented
      label="Density"
      value={view.density}
      onChange={v => onChange({ density: v as ListView['density'] })}
      options={[
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'compact', label: 'Compact' },
      ]}
      data-testid="songs-view-density"
    />
    <p className="flex items-center gap-1.5 px-1 pt-3 pb-1 text-[12.5px] text-ink-3">
      Always:
      {['Title', 'Tuning', 'Time'].map(t => (
        <span
          key={t}
          className="rounded-md bg-bg-3 px-2 py-0.5 text-ink-2 font-semibold"
        >
          {t}
        </span>
      ))}
    </p>
    <div className="divide-y divide-divider">
      {FIELDS.map(f => (
        <div
          key={f.key}
          className="flex items-center gap-3 min-h-[52px] px-1 [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:text-ink-3"
        >
          {f.icon}
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-ink-1">
              {f.label}
            </span>
            {f.sub && (
              <span className="block text-[12px] text-ink-3">{f.sub}</span>
            )}
          </span>
          <Switch
            checked={view[f.key]}
            onChange={v => onChange({ [f.key]: v })}
            label={f.label}
            data-testid={`songs-view-${f.key}`}
          />
        </div>
      ))}
      <div className="flex items-center gap-3 min-h-[52px] px-1">
        <EyeOff size={18} className="text-ink-3" />
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-ink-1">
            Show hidden songs
          </span>
          <span className="block text-[12px] text-ink-3">
            {hiddenCount} hidden
          </span>
        </span>
        <Switch
          checked={view.showHidden}
          onChange={v => onChange({ showHidden: v })}
          label="Show hidden songs"
          data-testid="songs-view-show-hidden"
        />
      </div>
    </div>
  </Sheet>
)

const SORTS: SortField[] = ['title', 'artist', 'added', 'nextShow']

export const SortSheet: React.FC<{
  view: ListView
  canNextShow: boolean
  onChange: (changes: Partial<ListView>) => void
  onClose: () => void
}> = ({ view, canNextShow, onChange, onClose }) => (
  <Sheet onClose={onClose} title="Sort" data-testid="songs-sort-sheet">
    <div role="menu" className="divide-y divide-divider md:divide-y-0 pb-1">
      {SORTS.filter(f => f !== 'nextShow' || canNextShow).map(f => {
        const on = view.sort === f
        return (
          <SheetItem
            key={f}
            icon={
              on ? (
                <Check className="!text-accent" />
              ) : (
                <span className="w-[19px]" />
              )
            }
            label={SORT_LABELS[f]}
            onClick={() =>
              onChange(on ? {} : { sort: f, dir: defaultDir(SORT_KINDS[f]) })
            }
            data-testid={`song-sort-option-${f}`}
          />
        )
      })}
    </div>
  </Sheet>
)

export function SortIcon({ dir }: { dir: 'asc' | 'desc' }) {
  return dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
}

/**
 * Add to…: the setlists of the song's own context and, for a band song, the
 * band's upcoming practices. Tap one to put the song in or take it out (the
 * check, as in Add songs); new setlists start with the song.
 */
export const AddToSheet: React.FC<{
  song: Song
  onClose: () => void
  onNewSetlist: () => void
}> = ({ song, onClose, onNewSetlist }) => {
  const isBand = song.contextType === 'band'
  const { rows: setlists, loading } = useSetlistIndex(
    isBand ? 'band' : 'personal',
    song.contextId
  )
  const practicesQuery = useQuery({
    queryKey: queryKeys.practices.band(song.contextId),
    queryFn: () => repository.getPracticeSessions(song.contextId),
    enabled: isBand,
  })
  const practices = useMemo(() => {
    const now = new Date()
    return (practicesQuery.data ?? [])
      .filter(
        p =>
          p.status !== 'cancelled' &&
          practiceStatus(new Date(p.scheduledDate), p.duration, now) !== 'done'
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime()
      )
  }, [practicesQuery.data])
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  // Toggled here, until the refetch catches up.
  const [on, setOn] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const toggle = async (
    key: string,
    next: boolean,
    op: () => Promise<unknown>
  ) => {
    if (busy) return
    setBusy(true)
    try {
      await op()
      setOn(o => ({ ...o, [key]: next }))
    } catch (err) {
      log.error('Add to failed', err)
      showToast("Couldn't change it. Try again.", 'error')
    } finally {
      setBusy(false)
      void queryClient.invalidateQueries({ queryKey: ['setlists'] })
      void queryClient.invalidateQueries({ queryKey: ['practices'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
    }
  }

  const row = (
    key: string,
    icon: React.ReactNode,
    label: string,
    hint: string,
    has: boolean,
    onToggle: () => void,
    testId: string
  ) => (
    <button
      key={key}
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={has}
      data-testid={testId}
      data-in-set={has || undefined}
      className="group w-full flex items-center gap-3 min-h-[52px] md:min-h-[44px] px-2.5 rounded-xl text-left hover:bg-bg-3 [&>svg]:w-[19px] [&>svg]:h-[19px] [&>svg]:shrink-0 [&>svg]:text-ink-3"
    >
      {icon}
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[15.5px] md:text-[14px] font-semibold text-ink-1">
          {label}
        </span>
        <span className="block truncate font-mono text-[10.5px] tracking-[.08em] uppercase text-ink-3">
          {hint}
        </span>
      </span>
      <span
        className={`w-7 h-7 shrink-0 grid place-items-center rounded-full ${
          has
            ? 'bg-accent text-on-accent'
            : 'ring-[1.5px] ring-inset ring-border-1 text-ink-3 group-hover:text-ink-1 group-hover:ring-ink-3'
        }`}
      >
        {has ? <Check size={15} strokeWidth={3} /> : <Plus size={15} />}
      </span>
    </button>
  )

  const label = (text: string) => (
    <p className="px-2.5 pt-3 pb-1 font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3">
      {text}
    </p>
  )

  return (
    <Sheet
      onClose={onClose}
      title="Add to…"
      sub={song.title}
      data-testid="add-to-setlist-sheet"
    >
      <div className="max-h-[55vh] overflow-y-auto custom-scrollbar-thin">
        {label('Setlists')}
        {loading && <p className="px-2.5 py-3 text-sm text-ink-3">Loading…</p>}
        {!loading && setlists.length === 0 && (
          <p className="px-2.5 py-3 text-sm text-ink-3">No setlists yet.</p>
        )}
        {setlists.map(sl => {
          const has = on[sl.id] ?? sl.songs.some(s => s.id === song.id)
          const count = `${sl.songs.length} ${sl.songs.length === 1 ? 'song' : 'songs'}`
          return row(
            sl.id,
            <ListMusic />,
            sl.name,
            sl.showId
              ? `${count} · Show set · ${sl.showName || 'show'}`
              : count,
            has,
            () =>
              void toggle(sl.id, !has, async () => {
                if (!has) return addSongsToSetlist(sl.id, [song.id], null)
                const item = (await repository.getSetlist(sl.id))?.items?.find(
                  i => i.type === 'song' && i.songId === song.id
                )
                if (item) await removeSetlistItem(sl.id, item.id)
              }),
            `add-to-setlist-${sl.id}`
          )
        })}
        {practices.length > 0 && label('Upcoming practices')}
        {practices.map(p => {
          const at = new Date(p.scheduledDate)
          const has = on[p.id] ?? p.songs.some(s => s.songId === song.id)
          return row(
            p.id,
            <CalendarDays />,
            practiceTitle(p.name, at),
            `${formatShowDate(at)} · ${p.songs.length} ${p.songs.length === 1 ? 'song' : 'songs'}`,
            has,
            () =>
              void toggle(p.id, !has, () =>
                repository.updatePracticeSession(p.id, {
                  songs: has
                    ? p.songs.filter(s => s.songId !== song.id)
                    : [...p.songs, freshPracticeSong(song.id)],
                })
              ),
            `add-to-practice-${p.id}`
          )
        })}
      </div>
      <div className="flex gap-2.5 mt-3 mb-1">
        <button
          type="button"
          onClick={() => {
            onClose()
            onNewSetlist()
          }}
          className="flex-1 h-12 rounded-full bg-bg-3 text-ink-1 font-bold flex items-center justify-center gap-2"
          data-testid="add-to-setlist-new"
        >
          <Plus size={18} /> New setlist
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-12 rounded-full bg-accent text-on-accent font-bold"
          data-testid="add-to-done"
        >
          Done
        </button>
      </div>
    </Sheet>
  )
}
