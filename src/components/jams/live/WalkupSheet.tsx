/**
 * Walk-up (Jam Host 5, Jam Venue): someone at the stage right now. Name and
 * what they play; optionally a hand on a song in the list, or a new song.
 */
import React, { useState } from 'react'
import { Button, Chip, Sheet } from '../../ui'
import * as jams from '../../../services/api/jams'
import type { JamState, Part } from '../../../services/api/jams'
import { partName, type JamItem } from '../../../hooks/useJam'
import { partOptions, samePart, type useLiveRunner } from './live'

const input =
  'w-full h-14 rounded-2xl bg-bg-3 px-4 text-[16px] text-ink-1 placeholder:text-ink-4 outline-none focus:ring-2 focus:ring-accent'

export const WalkupSheet: React.FC<{
  state: JamState
  run: ReturnType<typeof useLiveRunner>['run']
  onClose: () => void
}> = ({ state, run, onClose }) => {
  const [name, setName] = useState('')
  const [parts, setParts] = useState<Part[]>([])
  const [song, setSong] = useState<string | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [busy, setBusy] = useState(false)

  const songs: JamItem[] = [
    ...state.queue.map(id => state.items.find(i => i.id === id)!),
    ...state.items.filter(i => i.state === 'open' || i.state === 'pending'),
  ].filter(Boolean)
  const fits = (i: JamItem) =>
    parts.length === 0 ||
    i.parts_needed.some(p => parts.some(x => samePart(x, p)))

  const toggle = (p: Part) =>
    setParts(cur =>
      cur.some(x => samePart(x, p))
        ? cur.filter(x => !samePart(x, p))
        : [...cur, p]
    )

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const who = name.trim()
    const r = await run(
      () =>
        jams.addWalkup(state.jam.id, {
          name: who,
          parts,
          itemId: song && song !== 'new' ? song : undefined,
          pitchTitle: song === 'new' ? title.trim() : undefined,
          pitchArtist: song === 'new' ? artist.trim() || undefined : undefined,
        }),
      { ok: `${who} is here` }
    )
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Sheet
      onClose={onClose}
      title="Walk-up"
      sub="Someone at the stage right now."
      data-testid="walkup-sheet"
    >
      <form
        onSubmit={e => {
          e.preventDefault()
          void submit()
        }}
        className="flex flex-col gap-2 pb-2"
      >
        <label htmlFor="walkup-name" className="sr-only">
          Name
        </label>
        <input
          id="walkup-name"
          name="walkupName"
          autoFocus
          maxLength={40}
          placeholder="First name is fine"
          value={name}
          onChange={e => setName(e.target.value)}
          className={input}
          data-testid="walkup-name-input"
        />
        <div className="font-mono text-[10.5px] tracking-[.1em] text-ink-3 mt-2 mx-1">
          PLAYS
        </div>
        <div className="flex flex-wrap gap-2">
          {partOptions(state).map(p => (
            <Chip
              key={`${p.key}-${p.label ?? ''}`}
              on={parts.some(x => samePart(x, p))}
              onClick={() => toggle(p)}
              className="!h-12 !px-4 !text-[15px]"
              data-testid={`walkup-part-${p.label ? p.label.toLowerCase() : p.key}`}
            >
              {partName(p)}
            </Chip>
          ))}
        </div>
        <div className="font-mono text-[10.5px] tracking-[.1em] text-ink-3 mt-3 mx-1">
          FOR A SONG · OPTIONAL
        </div>
        <div className="flex flex-wrap gap-2">
          {songs.filter(fits).map(i => (
            <Chip
              key={i.id}
              on={song === i.id}
              onClick={() => setSong(song === i.id ? null : i.id)}
              className="!h-12 !px-4"
              data-testid={`walkup-song-${i.id}`}
            >
              {i.title}
            </Chip>
          ))}
          {state.jam.requests_open && (
            <Chip
              on={song === 'new'}
              onClick={() => setSong(song === 'new' ? null : 'new')}
              className="!h-12 !px-4"
              data-testid="walkup-song-new"
            >
              Something else…
            </Chip>
          )}
        </div>
        {song === 'new' && (
          <div className="flex flex-col gap-2 mt-1">
            <label htmlFor="walkup-title" className="sr-only">
              Song
            </label>
            <input
              id="walkup-title"
              name="walkupTitle"
              maxLength={80}
              placeholder="Song"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={input}
              data-testid="walkup-title-input"
            />
            <label htmlFor="walkup-artist" className="sr-only">
              Artist
            </label>
            <input
              id="walkup-artist"
              name="walkupArtist"
              maxLength={80}
              placeholder="Artist (optional)"
              value={artist}
              onChange={e => setArtist(e.target.value)}
              className={input}
              data-testid="walkup-artist-input"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button size="xl" onClick={onClose} data-testid="walkup-cancel">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="xl"
            disabled={!name.trim() || busy || (song === 'new' && !title.trim())}
            data-testid="walkup-submit"
          >
            Add walk-up
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
