/**
 * The song row every list draws (Songs, setlists, a show's set, practices,
 * Add songs, search): title · artist, then tuning, length, key, BPM and links,
 * always in that order. Narrow, it takes two lines; once its own box is 560px
 * wide it is one line of fixed columns, so rows line up wherever they sit
 * (`.song-line` in index.css). Lists put their own controls in the slots: lead
 * (grip, number, checkbox), marks (after the title), trail (×, +, ⋯) and sub
 * (a note, "Next: …", Played). The row's element and its clicks belong to the
 * list.
 */
import React from 'react'
import { Activity, Clock, FileLock2, FileText, Files, Hash } from 'lucide-react'
import { TuningPill } from '../ui'
import { formatSeconds, showKey } from '../../domain/format'
import type { Density, NoteMark, SongLineData } from '../../domain/songs'
import type { ReferenceLink } from '../../types'
import { linkGlyph } from './linkGlyphs'

/** 30 px outlined tile, 16 px glyph, 44 px hit area. Opens the link. */
export const LinkTile: React.FC<{ link: ReferenceLink }> = ({ link }) => {
  const g = linkGlyph(link)
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      title={link.description || g.name}
      aria-label={`${g.name}: ${link.description || link.url}`}
      data-testid="song-link-tile"
      className="grid place-items-center w-11 h-11 -m-[7px] shrink-0"
    >
      <span
        className={`grid place-items-center w-[30px] h-[30px] rounded-[9px] border border-border-1 bg-bg-2 [&>svg]:w-4 [&>svg]:h-4 ${g.tone}`}
      >
        {g.icon}
      </span>
    </a>
  )
}

/** Grey mark after the title: band notes, mine (lock), or both (stacked). */
export const NoteMarkIcon: React.FC<{ mark: NoteMark }> = ({ mark }) => {
  if (mark === 'none') return null
  const Icon = mark === 'both' ? Files : mark === 'mine' ? FileLock2 : FileText
  const label =
    mark === 'both'
      ? 'Band and my notes'
      : mark === 'mine'
        ? 'My notes'
        : 'Band notes'
  return (
    <Icon
      size={15}
      className="inline-block shrink-0 text-ink-4"
      aria-label={label}
      data-testid="song-notes-mark"
    />
  )
}

/** The row's number, right-aligned so 9 and 10 line up. */
export const LineNumber: React.FC<{ n: number }> = ({ n }) => (
  <span className="w-5 shrink-0 text-right font-mono text-[12.5px] text-ink-3">
    {n}
  </span>
)

export interface SongLineFields {
  artist?: boolean
  key?: boolean
  bpm?: boolean
  links?: boolean
}

const DEFAULT_FIELDS: SongLineFields = { artist: true, key: true }

// Whole class names, so Tailwind keeps their rules (index.css).
const DENSITY = {
  comfortable: 'song-line--comfortable',
  compact: 'song-line--compact',
}
const CELL = {
  len: 'song-line__len',
  key: 'song-line__key',
  bpm: 'song-line__bpm',
}

export interface SongLineProps {
  /** null: the song left the catalog. */
  song: SongLineData | null
  fields?: SongLineFields
  density?: Density
  lead?: React.ReactNode
  marks?: React.ReactNode
  trail?: React.ReactNode
  sub?: React.ReactNode
  /** In place of the plain title (search highlights the match). */
  name?: React.ReactNode
  /** Padding and the like; defaults to px-4. */
  className?: string
  titleTestId?: string
}

export const SongLine: React.FC<SongLineProps> = ({
  song,
  fields = DEFAULT_FIELDS,
  density = 'comfortable',
  lead,
  marks,
  trail,
  sub,
  name,
  className = 'px-4',
  titleTestId = 'song-title',
}) => {
  const links = fields.links ? (song?.links ?? []).slice(0, 2) : []
  const cell = (
    name: keyof typeof CELL,
    value: React.ReactNode,
    icon?: React.ReactNode
  ) => (
    <span
      className={`song-line__cell ${CELL[name]} ${value ? '' : 'song-line__empty'}`}
    >
      {icon}
      {value || '—'}
    </span>
  )
  return (
    <div className={`song-line ${DENSITY[density]} ${className}`}>
      <div className="song-line__grid">
        {lead && <span className="song-line__lead">{lead}</span>}
        <span className="song-line__title">
          <b className="song-line__name" data-testid={titleTestId}>
            {name ?? song?.title ?? 'Song removed from catalog'}
          </b>
          {fields.artist && song?.artist && (
            <span className="song-line__artist">{song.artist}</span>
          )}
          {marks && <span className="song-line__marks">{marks}</span>}
        </span>
        {song && (
          <span className="song-line__meta">
            <span className="song-line__tuning">
              {song.noTuning ? (
                <span className="text-ink-4" aria-label="No tuning">
                  –
                </span>
              ) : (
                <TuningPill
                  tuning={song.tuning || 'Standard'}
                  size={density === 'compact' ? 'sm' : 'md'}
                />
              )}
            </span>
            {cell(
              'len',
              formatSeconds(song.seconds),
              <Clock size={13} className="song-line__icon text-ink-4" />
            )}
            {fields.key &&
              cell(
                'key',
                song.key ? showKey(song.key) : '',
                <Hash size={13} className="song-line__icon text-ink-4" />
              )}
            {fields.bpm &&
              cell(
                'bpm',
                song.bpm || '',
                <Activity size={13} className="song-line__icon text-ink-4" />
              )}
            {fields.links && (
              <span className="song-line__links">
                {links.map((l, i) => (
                  <LinkTile key={i} link={l} />
                ))}
              </span>
            )}
          </span>
        )}
        {trail && <span className="song-line__trail">{trail}</span>}
        {sub && <div className="song-line__sub">{sub}</div>}
      </div>
    </div>
  )
}
