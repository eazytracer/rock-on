/**
 * The desktop song pane (docs/redesign/10 · 1.6; Songs, setlists, practices):
 * a read-only preview of the selected song. One way out: Open goes to the song
 * page, where a song is edited (double-clicking the row does the same), with
 * Back to the list it came from (`origin`).
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ExternalLink,
  Users,
  Lock,
  ListMusic,
  CalendarDays,
  Mic2,
  Maximize2,
  X,
} from 'lucide-react'
import type { Song } from '../../models/Song'
import { TuningPill } from '../ui'
import { MarkdownRenderer } from '../notes/MarkdownRenderer'
import { ChartButton } from '../chart/ChartButton'
import { linkGlyph } from './linkGlyphs'
import { formatSeconds, showKey } from '../../domain/format'
import { usePersonalNote } from '../../hooks/useNotes'
import { useSongUsage } from '../../hooks/useSongCatalog'
import { formatShowDate } from '../../utils/dateHelpers'
import { formatOrigin, songHref, type SongOrigin } from '../../utils/songOrigin'

const SONGS: SongOrigin = { kind: 'songs' }

const SECTION =
  'px-1 pt-5 pb-2 font-mono text-[11px] tracking-[.14em] uppercase text-ink-3 flex items-center'

export const SongDetail: React.FC<{
  song: Song
  userId: string
  origin?: SongOrigin
  /** Shows × (a pane that can close; the Songs pane always has a song). */
  onClose?: () => void
}> = ({ song, userId, origin = SONGS, onClose }) => {
  const navigate = useNavigate()
  const isBand = song.contextType === 'band'
  const bandId = isBand ? song.contextId : ''
  const { personalNote } = usePersonalNote(song.id, userId, bandId)
  const { usage } = useSongUsage(song.id)

  const open = () => navigate(songHref(song.id, origin))

  const facts = [
    ['Key', song.key ? showKey(song.key) : '—'],
    ['BPM', song.bpm ? String(song.bpm) : '—'],
    ['Length', formatSeconds(song.duration) || '—'],
  ]
  const links = song.referenceLinks ?? []

  return (
    <div data-testid="song-detail">
      <div className="flex items-start gap-3">
        <p className="flex-1 min-w-0 pt-1 font-mono text-[11.5px] tracking-[.14em] uppercase text-ink-3 truncate">
          {[song.artist, song.album].filter(Boolean).join(' · ')}
        </p>
        <button
          type="button"
          onClick={open}
          className="shrink-0 -mt-1 h-9 px-3.5 rounded-full bg-bg-3 text-ink-1 font-semibold flex items-center gap-1.5 hover:bg-bg-4"
          data-testid="songs-pane-open"
        >
          <Maximize2 size={15} /> Open
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 -mt-1 grid place-items-center w-9 h-9 rounded-full bg-bg-3 text-ink-2 hover:bg-bg-4 hover:text-ink-1"
            data-testid="song-pane-close"
          >
            <X size={17} />
          </button>
        )}
      </div>
      <h1
        className="font-display font-extrabold uppercase leading-[.9] text-ink-1 break-words text-[40px]"
        data-testid="song-detail-title"
      >
        {song.title}
      </h1>

      <div className="mt-3 flex items-end gap-5">
        <TuningPill tuning={song.guitarTuning || 'Standard'} size="lg" />
        {facts.map(([k, v]) => (
          <span key={k}>
            <span className="block font-mono text-[10px] tracking-[.14em] uppercase text-ink-3">
              {k}
            </span>
            <span className="block font-mono text-[19px] font-bold text-ink-1 leading-tight">
              {v}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <ChartButton
          song={song}
          search={`?${new URLSearchParams({ from: formatOrigin(origin) })}`}
          testId="songs-pane-chords-button"
        />
      </div>

      <div className={SECTION}>Links</div>
      {links.length === 0 ? (
        <p className="px-1 text-[14px] text-ink-3">No links yet.</p>
      ) : (
        <div className="rounded-[18px] bg-bg-2 shadow-group divide-y divide-divider overflow-hidden">
          {links.map((l, i) => {
            const g = linkGlyph(l)
            return (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-bg-3"
                data-testid="song-detail-link"
              >
                <span
                  className={`grid place-items-center w-9 h-9 rounded-[10px] border border-border-1 [&>svg]:w-[17px] [&>svg]:h-[17px] ${g.tone}`}
                >
                  {g.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-ink-1 truncate">
                    {g.name}
                  </span>
                  <span className="block text-[12.5px] text-ink-3 truncate">
                    {l.description || l.url}
                  </span>
                </span>
                <ExternalLink size={16} className="text-ink-3" />
              </a>
            )
          })}
        </div>
      )}

      <div className={SECTION}>Notes</div>
      <div className="rounded-[18px] bg-bg-2 shadow-group divide-y divide-divider">
        <div className="p-3.5">
          <p className="flex items-center gap-2 pb-1.5 text-[13.5px]">
            {isBand ? (
              <Users size={15} className="text-ink-3" />
            ) : (
              <Lock size={15} className="text-ink-3" />
            )}
            <b className="text-ink-1">{isBand ? 'Band notes' : 'Notes'}</b>
            <span className="text-ink-3 text-[12px]">
              {isBand ? 'shared' : 'only you'}
            </span>
          </p>
          <NotePreview
            value={song.notes || ''}
            data-testid="song-notes-band-preview"
          />
        </div>
        {isBand && (
          <div className="p-3.5">
            <p className="flex items-center gap-2 pb-1.5 text-[13.5px]">
              <Lock size={15} className="text-ink-3" />
              <b className="text-ink-1">My notes</b>
              <span className="text-ink-3 text-[12px]">only you</span>
            </p>
            <NotePreview
              value={personalNote?.content || ''}
              data-testid="song-notes-personal-preview"
            />
          </div>
        )}
      </div>

      <div className={SECTION}>Used in</div>
      {usage.length === 0 ? (
        <p className="px-1 pb-6 text-[14px] text-ink-3">
          Not in any setlist yet.
        </p>
      ) : (
        <div className="rounded-[18px] bg-bg-2 shadow-group divide-y divide-divider overflow-hidden mb-6">
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
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Read-only note in the pane: rendered, clipped with a fade. */
const NotePreview: React.FC<{
  value: string
  'data-testid'?: string
}> = ({ value, 'data-testid': testId }) => (
  <div data-testid={testId}>
    {value.trim() ? (
      <div className="relative max-h-[168px] overflow-hidden text-[14px]">
        <MarkdownRenderer content={value} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-bg-2" />
      </div>
    ) : (
      <span className="block py-1 text-[14px] italic text-ink-4">
        None yet.
      </span>
    )}
  </div>
)
