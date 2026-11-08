/**
 * Setlists index (redesign phase 3 · docs/redesign/10 Part 2, design/demo
 * Setlist Nav.html?nav=ab). One list per context: the band's sets, or your own
 * in Personal. Desktop: a grid of cards, next show first and outlined, ending
 * with a dashed New setlist card. Phone: a list with a New setlist button.
 * ⋯ (or hold on a phone row) opens Open / Duplicate / Delete.
 */
import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpDown,
  Check,
  Copy,
  ListMusic,
  MoreHorizontal,
  Plus,
  Search,
  SearchX,
  SquareArrowOutUpRight,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  useSetlistIndex,
  useNewSetlist,
  useDuplicateSetlist,
  useDeleteSetlist,
} from '../hooks/useSetlists'
import { useMediaQuery } from '../hooks/useResponsive'
import { useConfirm } from '../hooks/useConfirm'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import {
  Button,
  Chip,
  Empty,
  PageTitle,
  RetryCard,
  Sheet,
  SheetItem,
  SkeletonRow,
} from '../components/ui'
import {
  SETLIST_SORT_LABELS,
  deleteSetlistMessage,
  indexTotals,
  nextShowSetId,
  previewTitles,
  showLine,
  sortSetlistIndex,
  type IndexRow,
  type SetlistSort,
} from '../domain/setlist'
import { SetlistStats } from '../components/setlists/SetlistStats'
import { createLogger } from '../utils/logger'

const log = createLogger('SetlistsPage')

type At = { x: number; y: number } | null

const anchorBelow = (el: HTMLElement): At => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.bottom + 8 }
}

/** A row's numbers, runtime first (the shared stat line, small). */
const Stats: React.FC<{ row: IndexRow; className?: string }> = ({
  row,
  className,
}) => {
  const t = indexTotals(row)
  return (
    <SetlistStats
      size="sm"
      songs={t.songs}
      minutes={t.minutes}
      retunes={t.retunes}
      className={className}
    />
  )
}

export const SetlistsPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { currentBand, currentBandId, currentUser } = useAuth()
  const isBand = !!currentBandId
  const contextType = isBand ? 'band' : 'personal'
  const contextId = (isBand ? currentBandId : currentUser?.id) ?? ''
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const { rows, loading, error, refetch } = useSetlistIndex(
    contextType,
    contextId
  )
  const newSetlist = useNewSetlist()
  const duplicate = useDuplicateSetlist()
  const { deleteSetlist } = useDeleteSetlist()
  const { confirm, dialogProps } = useConfirm()

  const [sort, setSort] = useState<SetlistSort>('nextShow')
  const [sortAt, setSortAt] = useState<At | false>(false)
  const [menu, setMenu] = useState<{ row: IndexRow; at: At } | null>(null)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')

  const now = useMemo(() => new Date(), [])
  const nextId = useMemo(() => nextShowSetId(rows, now), [rows, now])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = sortSetlistIndex(rows, sort, now)
    if (!q) return sorted
    return sorted.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.songs.some(s => s.title.toLowerCase().includes(q))
    )
  }, [rows, sort, now, query])

  const open = (id: string) => navigate(`/setlists/${id}`)

  const create = async () => {
    try {
      open(await newSetlist(contextType, contextId))
    } catch (err) {
      log.error('Create setlist failed', err)
      showToast("Couldn't create it. Try again.", 'error')
    }
  }

  const handleDuplicate = async (row: IndexRow) => {
    try {
      await duplicate(row.id)
      showToast(`Duplicated "${row.name}"`, 'success')
    } catch (err) {
      log.error('Duplicate setlist failed', err)
      showToast("Couldn't duplicate it. Try again.", 'error')
    }
  }

  const handleDelete = async (row: IndexRow) => {
    const show = showLine(row)
    const ok = await confirm({
      title: `Delete "${row.name}"?`,
      message: deleteSetlistMessage(show),
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteSetlist(row.id)
      showToast(`Deleted "${row.name}"`, 'success')
    } catch (err) {
      log.error('Delete setlist failed', err)
      showToast("Couldn't delete it. Try again.", 'error')
    }
  }

  const newButton = (
    <Button
      variant="primary"
      onClick={create}
      data-testid="create-setlist-button"
      className={
        isDesktop ? '' : 'fixed right-4 bottom-[104px] z-30 shadow-float'
      }
    >
      <Plus size={18} /> New setlist
    </Button>
  )

  const sortChip = (
    <Chip
      onClick={e =>
        setSortAt(
          isDesktop ? anchorBelow(e.currentTarget as HTMLElement) : null
        )
      }
      aria-haspopup="menu"
      data-testid="setlists-sort"
    >
      <ArrowUpDown size={15} /> {SETLIST_SORT_LABELS[sort]}
    </Chip>
  )

  const list = () => {
    if (loading)
      return (
        <div className="rounded-[20px] bg-bg-2 shadow-group">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )
    if (error)
      return (
        <RetryCard
          message="Couldn't load your setlists."
          onRetry={() => void refetch()}
        />
      )
    if (rows.length === 0)
      return (
        <Empty
          icon={<ListMusic size={28} />}
          title="No setlists yet"
          why="Put songs in the order you'll play them, with breaks and sections."
          action={
            <Button variant="primary" onClick={create}>
              <Plus size={18} /> New setlist
            </Button>
          }
          data-testid="setlist-empty-state"
        />
      )
    if (visible.length === 0)
      return (
        <Empty
          icon={<SearchX size={28} />}
          title={`Nothing matches "${query.trim()}"`}
          why="Search looks at set names and the songs in them."
          data-testid="setlists-no-match"
        />
      )
    if (isDesktop)
      return (
        <div
          className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]"
          data-testid="setlists-grid"
        >
          {visible.map(row => (
            <SetlistCard
              key={row.id}
              row={row}
              next={row.id === nextId}
              onOpen={() => open(row.id)}
              onMenu={at => setMenu({ row, at })}
            />
          ))}
          <button
            type="button"
            onClick={create}
            className="min-h-[148px] rounded-[18px] border-[1.5px] border-dashed border-border-1 text-ink-2 font-semibold flex items-center justify-center gap-2 hover:bg-bg-2 hover:text-ink-1"
            data-testid="setlist-new-card"
          >
            <Plus size={18} /> New setlist
          </button>
        </div>
      )
    return (
      <div
        className="rounded-[20px] bg-bg-2 shadow-group divide-y divide-divider overflow-hidden"
        data-testid="setlists-list"
      >
        {visible.map(row => (
          <SetlistListRow
            key={row.id}
            row={row}
            next={row.id === nextId}
            onOpen={() => open(row.id)}
            onMenu={() => setMenu({ row, at: null })}
          />
        ))}
      </div>
    )
  }

  return (
    <div data-testid="setlists-page" className="pb-28 md:pb-8">
      <PageTitle
        eyebrow={isBand ? currentBand?.name : 'My Setlists'}
        title="Setlists"
        count={loading ? undefined : rows.length}
        actions={
          isDesktop ? (
            <>
              {sortChip}
              {newButton}
            </>
          ) : undefined
        }
      />

      {!isDesktop && (
        <div className="flex items-center gap-2 mb-4">
          {searching ? (
            <label className="flex-1 flex items-center gap-2 h-10 px-3.5 rounded-full bg-bg-2 shadow-group">
              <Search size={16} className="text-ink-3 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search sets and songs"
                name="setlistSearch"
                id="setlist-search"
                data-testid="setlists-search-input"
                className="flex-1 min-w-0 bg-transparent text-[15px] text-ink-1 placeholder:text-ink-4 outline-none"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => {
                  setSearching(false)
                  setQuery('')
                }}
                className="text-ink-3"
                data-testid="setlists-search-close"
              >
                <X size={16} />
              </button>
            </label>
          ) : (
            <>
              {sortChip}
              <Chip
                onClick={() => setSearching(true)}
                data-testid="setlists-search-toggle"
              >
                <Search size={15} /> Search
              </Chip>
            </>
          )}
        </div>
      )}

      {list()}
      {!isDesktop && rows.length > 0 && newButton}

      {sortAt !== false && (
        <Sheet
          onClose={() => setSortAt(false)}
          at={sortAt}
          title="Sort"
          data-testid="setlists-sort-sheet"
        >
          <div role="menu" className="pb-1">
            {(Object.keys(SETLIST_SORT_LABELS) as SetlistSort[]).map(s => (
              <SheetItem
                key={s}
                icon={
                  sort === s ? (
                    <Check className="!text-accent" />
                  ) : (
                    <span className="w-[19px]" />
                  )
                }
                label={SETLIST_SORT_LABELS[s]}
                onClick={() => {
                  setSort(s)
                  setSortAt(false)
                }}
                data-testid={`setlist-sort-option-${s}`}
              />
            ))}
          </div>
        </Sheet>
      )}

      {menu && (
        <Sheet
          onClose={() => setMenu(null)}
          at={menu.at}
          title={menu.row.name}
          data-testid="setlist-menu"
        >
          <div role="menu" className="pb-1">
            <SheetItem
              icon={<SquareArrowOutUpRight />}
              label="Open"
              onClick={() => {
                setMenu(null)
                open(menu.row.id)
              }}
              data-testid="setlist-menu-open"
            />
            <SheetItem
              icon={<Copy />}
              label="Duplicate"
              onClick={() => {
                setMenu(null)
                void handleDuplicate(menu.row)
              }}
              data-testid="setlist-menu-duplicate"
            />
            <SheetItem
              icon={<Trash2 />}
              label="Delete…"
              danger
              onClick={() => {
                setMenu(null)
                void handleDelete(menu.row)
              }}
              data-testid="setlist-menu-delete"
            />
          </div>
        </Sheet>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

/** Desktop card: show line, name, totals, the first five songs, ⋯. */
const SetlistCard: React.FC<{
  row: IndexRow
  next: boolean
  onOpen: () => void
  onMenu: (at: At) => void
}> = ({ row, next, onOpen, onMenu }) => {
  const show = showLine(row)
  const preview = previewTitles(row)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      onContextMenu={e => {
        e.preventDefault()
        onMenu({ x: e.clientX, y: e.clientY })
      }}
      className={`group relative rounded-[18px] bg-bg-2 p-[18px] cursor-pointer outline-none hover:bg-bg-3 focus-visible:ring-2 focus-visible:ring-accent ${
        next ? 'ring-2 ring-accent' : 'shadow-group'
      }`}
      data-testid={`setlist-card-${row.id}`}
      data-next={next || undefined}
    >
      <p
        className={`pr-10 font-mono text-[11px] tracking-[.14em] uppercase truncate ${
          next ? 'text-accent-ink' : 'text-ink-3'
        }`}
        data-testid="setlist-card-show"
      >
        {next && 'Next show · '}
        {show ?? 'Not attached to a show'}
      </p>
      <h2 className="mt-2.5 font-display font-extrabold uppercase leading-[.95] text-[30px] text-ink-1 break-words">
        {row.name}
      </h2>
      <Stats row={row} className="mt-2" />
      <p className="mt-3 text-[14px] text-ink-2 truncate">
        {preview || <span className="text-ink-4 italic">No songs yet</span>}
      </p>
      <button
        type="button"
        aria-label={`More for ${row.name}`}
        onClick={e => {
          e.stopPropagation()
          onMenu(anchorBelow(e.currentTarget))
        }}
        className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-full text-ink-3 hover:bg-bg-4 hover:text-ink-1"
        data-testid={`setlist-card-menu-${row.id}`}
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  )
}

/** Phone row: name and totals; the show's date and venue on the right. */
const SetlistListRow: React.FC<{
  row: IndexRow
  next: boolean
  onOpen: () => void
  onMenu: () => void
}> = ({ row, next, onOpen, onMenu }) => {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const cancel = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
  }
  const date = row.showAt
    ? new Date(row.showAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null
  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={() => {
        held.current = false
        hold.current = setTimeout(() => {
          held.current = true
          onMenu()
        }, 450)
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerMove={e =>
        (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4) && cancel()
      }
      onClick={() => !held.current && onOpen()}
      onContextMenu={e => e.preventDefault()}
      className="flex items-center gap-3 px-4 py-3.5 select-none active:bg-bg-3"
      data-testid={`setlist-card-${row.id}`}
      data-next={next || undefined}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[17px] font-bold text-ink-1 truncate">
          {row.name}
        </span>
        <Stats row={row} className="mt-1" />
      </span>
      <span className="shrink-0 text-right max-w-[45%]">
        {date ? (
          <>
            <span
              className={`block font-mono text-[11px] tracking-[.1em] uppercase ${
                next ? 'text-accent-ink' : 'text-ink-3'
              }`}
            >
              {date}
            </span>
            <span className="block text-[14px] text-ink-2 truncate">
              {row.showVenue || row.showName}
            </span>
          </>
        ) : (
          <span className="text-[14px] text-ink-4">No show</span>
        )}
      </span>
    </div>
  )
}
