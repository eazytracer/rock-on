/**
 * A song's notes, read-only, for stage screens: the band note and my notes
 * (practice session, chart reader). In My Songs there's just the song's note.
 * `size` is a Tailwind text-size class, `testIdPrefix` names the pieces
 * (`<prefix>-band-notes`, `<prefix>-my-notes`, `<prefix>-notes-empty`).
 */
import React from 'react'
import { Lock, Users } from 'lucide-react'
import { usePersonalNote } from '../../hooks/useNotes'
import { MarkdownRenderer } from '../notes/MarkdownRenderer'
import type { Song } from '../../models/Song'

export const SongNotesView: React.FC<{
  song: Song
  userId: string
  /** The band the song is in ('' for My Songs). */
  bandId: string
  size: string
  testIdPrefix?: string
}> = ({ song, userId, bandId, size, testIdPrefix = 'session' }) => {
  const { personalNote } = usePersonalNote(song.id!, userId, bandId)
  const mine = bandId ? personalNote?.content?.trim() : ''
  const band = song.notes?.trim()
  const head =
    'flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[.12em] text-ink-3 mb-2'
  if (!band && !mine)
    return (
      <p
        className="text-ink-3 text-[15px]"
        data-testid={`${testIdPrefix}-notes-empty`}
      >
        No notes for this song yet.
      </p>
    )
  return (
    <div className={`space-y-5 ${size} leading-snug text-ink-1`}>
      {band && (
        <section data-testid={`${testIdPrefix}-band-notes`}>
          <p className={head}>
            {bandId ? (
              <>
                <Users size={13} /> Band notes
              </>
            ) : (
              <>
                <Lock size={13} /> Notes
              </>
            )}
          </p>
          <MarkdownRenderer content={band} />
        </section>
      )}
      {mine && (
        <section data-testid={`${testIdPrefix}-my-notes`}>
          <p className={head}>
            <Lock size={13} /> My notes
          </p>
          <MarkdownRenderer content={mine} />
        </section>
      )}
    </div>
  )
}
