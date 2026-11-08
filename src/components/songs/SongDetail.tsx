/**
 * Song view (Song Editor and View · 6): read-first. Facts, then Chords &
 * lyrics, links, the note layers (each labelled with who sees it), and Used in.
 * Rendered as the /songs/:id page on phones and as the pane on desktop.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Grid3x3,
  Pencil,
  ExternalLink,
  Users,
  Lock,
  Plus,
  ListMusic,
  CalendarDays,
  Mic2,
} from 'lucide-react'
import type { Song } from '../../models/Song'
import { TuningPill } from '../ui'
import { MarkdownField } from '../notes/MarkdownField'
import { linkGlyph } from './linkGlyphs'
import { formatSeconds } from '../../domain/format'
import { shortTime } from '../../domain/notifications'
import {
  useBandNotes,
  usePersonalNote,
  useNoteEntries,
} from '../../hooks/useNotes'
import { useBandMembers } from '../../hooks/useBands'
import { useSongUsage } from '../../hooks/useSongCatalog'
import { useToast } from '../../contexts/ToastContext'
import { formatShowDate } from '../../utils/dateHelpers'

const SECTION =
  'px-1 pt-5 pb-2 font-mono text-[11px] tracking-[.14em] uppercase text-ink-3 flex items-center'

export const SongDetail: React.FC<{
  song: Song
  userId: string
  onEdit: () => void
  /** Desktop pane: smaller title. */
  pane?: boolean
}> = ({ song, userId, onEdit, pane }) => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isBand = song.contextType === 'band'
  const bandId = isBand ? song.contextId : ''

  const { notes: bandNotes, updateNotes } = useBandNotes(song.id)
  const { personalNote, upsertNote } = usePersonalNote(song.id, userId, bandId)
  const { entries } = useNoteEntries(song.id, bandId, userId)
  const { members } = useBandMembers(bandId)
  const { usage } = useSongUsage(song.id)

  const editor = song.notesEditedBy
    ? members.find(m => m.membership.userId === song.notesEditedBy)
    : undefined
  const editorName =
    song.notesEditedBy === userId
      ? 'You'
      : (editor?.profile?.displayName || editor?.user?.name || '').split(' ')[0]

  const save =
    (fn: (v: string) => Promise<unknown>, what: string) =>
    async (v: string) => {
      try {
        await fn(v)
      } catch (err) {
        showToast(`Couldn't save ${what}. Try again.`, 'error')
        throw err
      }
    }

  const facts = [
    ['Key', song.key || '—'],
    ['BPM', song.bpm ? String(song.bpm) : '—'],
    ['Length', formatSeconds(song.duration) || '—'],
  ]
  const links = song.referenceLinks ?? []

  return (
    <div data-testid="song-detail">
      <p className="font-mono text-[11.5px] tracking-[.14em] uppercase text-ink-3 truncate">
        {[song.artist, song.album].filter(Boolean).join(' · ')}
      </p>
      <h1
        className={`font-display font-extrabold uppercase leading-[.9] text-ink-1 break-words ${
          pane ? 'text-[40px]' : 'text-[46px] md:text-[56px]'
        }`}
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
        <button
          type="button"
          disabled
          title="Coming soon"
          className="h-11 px-4 rounded-full bg-bg-3 text-ink-3 font-bold flex items-center gap-2 cursor-not-allowed"
          data-testid="song-chords-button"
        >
          <Grid3x3 size={17} /> Chords & lyrics
          <span className="font-mono text-[10px] uppercase tracking-[.1em]">
            Soon
          </span>
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="h-11 px-4 rounded-full bg-bg-3 text-ink-1 font-bold flex items-center gap-2 hover:bg-bg-4"
          data-testid="song-detail-edit"
        >
          <Pencil size={16} /> Edit
        </button>
      </div>

      <div className={SECTION}>
        Links
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto flex items-center gap-1 text-accent-ink tracking-[.08em]"
        >
          <Plus size={13} /> Add
        </button>
      </div>
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
              {isBand ? 'shared · bandmates see edits' : 'only you'}
            </span>
          </p>
          <MarkdownField
            value={bandNotes || ''}
            onSave={save(updateNotes, 'the note')}
            placeholder={
              isBand ? 'Add a note the band will see.' : 'Add a note.'
            }
            data-testid="song-notes-band-field"
          />
          {isBand && (editorName || entries.length > 0) && (
            <p className="pt-1.5 text-[12px] text-ink-3">
              {editorName && song.notesEditedAt && (
                <>
                  {editorName} · edited{' '}
                  {shortTime(song.notesEditedAt.toISOString())}
                </>
              )}
              {editorName && entries.length > 0 && ' · '}
              {entries.length > 0 && <>Practice log · {entries.length}</>}
            </p>
          )}
        </div>
        {isBand && (
          <div className="p-3.5">
            <p className="flex items-center gap-2 pb-1.5 text-[13.5px]">
              <Lock size={15} className="text-ink-3" />
              <b className="text-ink-1">My notes</b>
              <span className="text-ink-3 text-[12px]">only you</span>
            </p>
            <MarkdownField
              value={personalNote?.content || ''}
              onSave={save(upsertNote, 'your note')}
              placeholder="None yet. Click to add."
              tone="info"
              data-testid="song-notes-personal-field"
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
