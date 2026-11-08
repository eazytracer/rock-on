/**
 * Song page, right column (docs/redesign/10 · 1.2): Details (album, tags),
 * Links (inline add / edit / remove), Used in, and the context line. Each edit
 * saves on its own through the page's field save.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronRight,
  ExternalLink,
  ListMusic,
  Mic2,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import type { Song } from '../../models/Song'
import type { ReferenceLink } from '../../types'
import { linkGlyph } from './linkGlyphs'
import { InlineText, type SaveField } from './SongFacts'
import { useSongUsage } from '../../hooks/useSongCatalog'
import { detectLinkType } from '../../utils/linkDetection'
import { formatShowDate } from '../../utils/dateHelpers'

const SECTION =
  'px-1 pt-6 pb-2 font-mono text-[11px] tracking-[.14em] uppercase text-ink-3 flex items-center'
const GROUP =
  'rounded-[18px] bg-bg-2 shadow-group divide-y divide-divider overflow-hidden'

/** URL in, link out: the type is detected from the address. */
function linkFrom(url: string, description?: string): ReferenceLink {
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`
  return {
    icon: detectLinkType(u).type,
    url: u,
    ...(description ? { description } : {}),
  }
}

const LinkInput: React.FC<{
  initial?: string
  onCommit: (url: string) => void
  onCancel: () => void
}> = ({ initial = '', onCommit, onCancel }) => {
  const [url, setUrl] = useState(initial)
  return (
    <input
      autoFocus
      value={url}
      onChange={e => setUrl(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') url.trim() ? onCommit(url.trim()) : onCancel()
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
      onBlur={() => (url.trim() ? onCommit(url.trim()) : onCancel())}
      placeholder="Paste a Spotify, YouTube, Ultimate Guitar or lyrics URL"
      name="songLinkUrl"
      id="song-link-url"
      data-testid="song-link-input"
      className="w-full h-12 px-3.5 bg-transparent text-[14.5px] text-ink-1 placeholder:text-ink-4 outline-none ring-2 ring-inset ring-accent rounded-[18px]"
    />
  )
}

export const SongSide: React.FC<{
  song: Song
  onSave: SaveField
  bandName?: string
  hasLinkedCopy?: boolean
  showKeys?: boolean
}> = ({ song, onSave, bandName, hasLinkedCopy, showKeys }) => {
  const navigate = useNavigate()
  const { usage } = useSongUsage(song.id)
  const [adding, setAdding] = useState(false)
  const [editingAt, setEditingAt] = useState<number | null>(null)
  const links = song.referenceLinks ?? []

  useEffect(() => {
    setAdding(false)
    setEditingAt(null)
  }, [song.id])

  const saveLinks = (next: ReferenceLink[]) =>
    onSave('Links', { referenceLinks: next })

  const isBand = song.contextType === 'band'
  const context = isBand
    ? `In ${bandName ?? 'the band'}.${
        hasLinkedCopy
          ? " Linked copy in My Songs: your edits here are the band's."
          : ''
      }`
    : song.linkedFromSongId
      ? 'In My Songs. A linked copy of a band song.'
      : 'In My Songs. Only you see it.'

  return (
    <div>
      <div className={SECTION}>Details</div>
      <div className={GROUP}>
        {(
          [
            ['Album', 'album', song.album || ''],
            ['Tags', 'tags', (song.tags ?? []).join(', ')],
          ] as const
        ).map(([label, field, value]) => (
          <div
            key={field}
            className="flex items-center gap-4 px-3.5 min-h-[50px]"
          >
            <span className="w-14 shrink-0 font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3">
              {label}
            </span>
            <InlineText
              value={value}
              placeholder={`Add ${label.toLowerCase()}`}
              label={label}
              inputTestId={`song-${field}-input`}
              testId={`song-${field}`}
              className="flex-1 min-w-0 py-1 text-[15px] text-ink-1 truncate"
              onCommit={v => {
                const t = v.trim()
                if (t === value) return
                void onSave(
                  label,
                  field === 'album'
                    ? { album: t }
                    : {
                        tags: t
                          .split(',')
                          .map(x => x.trim())
                          .filter(Boolean),
                      }
                )
              }}
            />
          </div>
        ))}
      </div>

      <div className={SECTION}>
        Links
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="ml-auto flex items-center gap-1 text-accent-ink tracking-[.08em]"
          data-testid="song-link-add"
        >
          <Plus size={13} /> Add
        </button>
      </div>
      {links.length === 0 && !adding ? (
        <p className="px-1 text-[14px] text-ink-3">No links yet.</p>
      ) : (
        <div className={GROUP}>
          {links.map((l, i) =>
            editingAt === i ? (
              <LinkInput
                key={i}
                initial={l.url}
                onCancel={() => setEditingAt(null)}
                onCommit={url => {
                  setEditingAt(null)
                  if (url === l.url) return
                  void saveLinks(
                    links.map((x, j) =>
                      j === i ? linkFrom(url, x.description) : x
                    )
                  )
                }}
              />
            ) : (
              <LinkRow
                key={i}
                link={l}
                onEdit={() => setEditingAt(i)}
                onRemove={() => void saveLinks(links.filter((_, j) => j !== i))}
              />
            )
          )}
          {adding && (
            <LinkInput
              onCancel={() => setAdding(false)}
              onCommit={url => {
                setAdding(false)
                void saveLinks([...links, linkFrom(url)])
              }}
            />
          )}
        </div>
      )}

      <div className={SECTION}>Used in</div>
      {usage.length === 0 ? (
        <p className="px-1 text-[14px] text-ink-3">Not in any setlist yet.</p>
      ) : (
        <div className={GROUP}>
          {usage.map(u => {
            const Icon =
              u.kind === 'setlist'
                ? ListMusic
                : u.kind === 'show'
                  ? Mic2
                  : CalendarDays
            const path =
              u.kind === 'setlist'
                ? `/setlists/${u.id}`
                : u.kind === 'show'
                  ? `/shows/${u.id}`
                  : `/practices/${u.id}`
            const sub =
              u.kind === 'setlist'
                ? `Song ${u.position}`
                : u.starts_at
                  ? formatShowDate(new Date(u.starts_at))
                  : ''
            return (
              <button
                key={`${u.kind}-${u.id}`}
                type="button"
                onClick={() => navigate(path)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-bg-3"
                data-testid={`song-used-in-${u.kind}`}
              >
                <Icon size={18} className="text-ink-3" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-ink-1 truncate">
                    {u.name}
                  </span>
                  <span className="block text-[12.5px] text-ink-3">{sub}</span>
                </span>
                <ChevronRight size={17} className="text-ink-3" />
              </button>
            )
          })}
        </div>
      )}

      <p
        className="px-1 pt-4 text-[13px] text-ink-3"
        data-testid="song-context-line"
      >
        {context}
      </p>
      {showKeys && (
        <p className="px-1 pt-3 pb-6 font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-4 leading-loose">
          <Kbd>Esc</Kbd> Back · <Kbd>J</Kbd> <Kbd>K</Kbd> Next / prev ·{' '}
          <Kbd>E</Kbd> Edit band note
        </p>
      )}
    </div>
  )
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="px-1.5 py-0.5 rounded-md bg-bg-3 text-ink-2 font-mono">
    {children}
  </kbd>
)

const LinkRow: React.FC<{
  link: ReferenceLink
  onEdit: () => void
  onRemove: () => void
}> = ({ link, onEdit, onRemove }) => {
  const g = linkGlyph(link)
  return (
    <div
      className="group flex items-center gap-3 px-3.5 py-2.5 hover:bg-bg-3"
      data-testid="song-detail-link"
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 flex items-center gap-3"
      >
        <span
          className={`grid place-items-center w-9 h-9 shrink-0 rounded-[10px] border border-border-1 [&>svg]:w-[17px] [&>svg]:h-[17px] ${g.tone}`}
        >
          {g.icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-ink-1 truncate">
            {g.name}
          </span>
          <span className="block text-[12.5px] text-ink-3 truncate">
            {link.description || link.url}
          </span>
        </span>
      </a>
      {/* Hover on desktop; always there on touch (no hover to reveal them). */}
      <span className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit link"
          className="grid place-items-center w-9 h-9 rounded-lg text-ink-3 hover:bg-bg-4 hover:text-ink-1"
          data-testid="song-link-edit"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove link"
          className="grid place-items-center w-9 h-9 rounded-lg text-ink-3 hover:bg-bg-4 hover:text-danger"
          data-testid="song-link-remove"
        >
          <X size={16} />
        </button>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open link"
          className="hidden md:grid place-items-center w-9 h-9 rounded-lg text-ink-3 hover:bg-bg-4 hover:text-ink-1"
        >
          <ExternalLink size={15} />
        </a>
      </span>
    </div>
  )
}
