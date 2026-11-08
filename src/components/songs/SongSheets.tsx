/**
 * Sheets for the song list: the hold / right-click menu, View options, Sort,
 * and Add to setlist.
 */
import React from 'react'
import {
  ExternalLink,
  Pencil,
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
} from 'lucide-react'
import type { Song } from '../../models/Song'
import { Sheet, SheetItem, Segmented, Switch, TuningPill } from '../ui'
import { formatSeconds } from '../../domain/format'
import { SORT_LABELS, type ListView, type SortField } from '../../domain/songs'
import {
  useSetlists,
  usePersonalSetlists,
  useAddSetlistItem,
} from '../../hooks/useSetlists'
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
  onOpen: () => void
  onEdit: () => void
  onAddToSet: () => void
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
  onEdit,
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
        <SheetItem
          icon={<ExternalLink />}
          label="Open song"
          onClick={run(onOpen)}
          data-testid="song-menu-open"
        />
        <SheetItem
          icon={<Pencil />}
          label="Edit"
          onClick={run(onEdit)}
          data-testid="edit-song-button"
        />
        <SheetItem
          icon={<ListPlus />}
          label="Add to setlist"
          onClick={run(onAddToSet)}
          data-testid="add-to-setlist-button"
        />
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

const SORTS: SortField[] = ['title', 'artist', 'newest', 'oldest', 'nextShow']

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
        const directional = f === 'title' || f === 'artist' || f === 'nextShow'
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
            hint={
              on && directional
                ? view.dir === 'asc'
                  ? 'A → Z'
                  : 'Z → A'
                : undefined
            }
            onClick={() =>
              on && directional
                ? onChange({ dir: view.dir === 'asc' ? 'desc' : 'asc' })
                : onChange({ sort: f, dir: 'asc' })
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

/** Setlists of the song's own context; tap one to append the song. */
export const AddToSetlistSheet: React.FC<{
  song: Song
  onClose: () => void
  onNewSetlist: () => void
}> = ({ song, onClose, onNewSetlist }) => {
  const isBand = song.contextType === 'band'
  const band = useSetlists(isBand ? song.contextId : '')
  const mine = usePersonalSetlists(isBand ? '' : song.contextId)
  const { setlists, loading } = isBand ? band : mine
  const { addItem } = useAddSetlistItem()
  const { showToast } = useToast()

  const add = async (id: string, name: string) => {
    try {
      await addItem(id, { type: 'song', songId: song.id })
      showToast(`Added to ${name}`, 'success')
      onClose()
    } catch (err) {
      log.error('Failed to add to setlist', err)
      showToast("Couldn't add it. Try again.", 'error')
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title="Add to setlist"
      sub={song.title}
      data-testid="add-to-setlist-sheet"
    >
      <div className="divide-y divide-divider max-h-[50vh] overflow-y-auto custom-scrollbar-thin">
        {loading && <p className="px-1 py-4 text-sm text-ink-3">Loading…</p>}
        {!loading && setlists.length === 0 && (
          <p className="px-1 py-4 text-sm text-ink-3">No setlists yet.</p>
        )}
        {setlists.map(sl => {
          const has = sl.items?.some(
            i => i.type === 'song' && i.songId === song.id
          )
          const count = sl.items?.filter(i => i.type === 'song').length ?? 0
          return (
            <SheetItem
              key={sl.id}
              icon={<ListPlus />}
              label={sl.name}
              hint={has ? 'Already in it' : `${count} songs`}
              disabled={has}
              onClick={() => add(sl.id, sl.name)}
              data-testid={`add-to-setlist-${sl.id}`}
            />
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          onClose()
          onNewSetlist()
        }}
        className="mt-3 mb-1 w-full h-12 rounded-full bg-bg-3 text-ink-1 font-bold flex items-center justify-center gap-2"
        data-testid="add-to-setlist-new"
      >
        <Plus size={18} /> New setlist
      </button>
    </Sheet>
  )
}
