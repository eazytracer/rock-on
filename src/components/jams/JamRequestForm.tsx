/**
 * Request a song (Jam Plan 10): song, artist, what you'll play and who you're
 * looking for, as chips. With no one picked to look for, the song asks for
 * the jam's starting parts.
 */
import React, { useState } from 'react'
import { Button, Group } from '../ui'
import type { Part } from '../../services/api/jams'
import { PartPicker } from './PartChip'
import { distinctParts } from './parts'

export interface JamRequestValue {
  title: string
  artist: string
  myParts: Part[]
  partsNeeded: Part[]
}

const label =
  'block px-1 pt-3 pb-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3'

export const JamRequestForm: React.FC<{
  myParts: Part[]
  defaultParts: Part[]
  busy: boolean
  closed: boolean
  onSend: (v: JamRequestValue) => Promise<boolean>
}> = ({ myParts, defaultParts, busy, closed, onSend }) => {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [mine, setMine] = useState<Part[]>(myParts)
  const [looking, setLooking] = useState<Part[]>([])
  if (closed)
    return (
      <p
        className="px-4 py-10 text-center text-[14.5px] text-ink-3"
        data-testid="jam-request-closed"
      >
        The host isn't taking song requests right now.
      </p>
    )
  const send = async () => {
    if (!title.trim()) return
    const partsNeeded = distinctParts(
      looking.length ? [...mine, ...looking] : [...defaultParts, ...mine]
    )
    if (
      await onSend({
        title: title.trim(),
        artist: artist.trim(),
        myParts: mine,
        partsNeeded,
      })
    ) {
      setTitle('')
      setArtist('')
      setLooking([])
    }
  }
  const input =
    'flex-1 min-w-0 bg-transparent text-[15px] text-ink-1 outline-none placeholder:text-ink-4'
  return (
    <div data-testid="jam-request-form">
      <Group>
        <label
          htmlFor="jam-request-title"
          className="flex items-center gap-3 min-h-14 px-4"
        >
          <span className="w-14 shrink-0 text-[13px] text-ink-3">Song</span>
          <input
            id="jam-request-title"
            name="requestTitle"
            data-testid="jam-request-title-input"
            value={title}
            maxLength={80}
            onChange={e => setTitle(e.target.value)}
            placeholder="Interstate Love Song"
            className={input}
          />
        </label>
        <label
          htmlFor="jam-request-artist"
          className="flex items-center gap-3 min-h-14 px-4"
        >
          <span className="w-14 shrink-0 text-[13px] text-ink-3">Artist</span>
          <input
            id="jam-request-artist"
            name="requestArtist"
            data-testid="jam-request-artist-input"
            value={artist}
            maxLength={80}
            onChange={e => setArtist(e.target.value)}
            placeholder="Stone Temple Pilots"
            className={input}
          />
        </label>
      </Group>
      <div className="px-3">
        <span className={label}>I'll play</span>
        <PartPicker
          value={mine}
          onChange={setMine}
          testId="jam-request-mine"
          label="I'll play"
        />
        <span className={label}>Looking for</span>
        <PartPicker
          value={looking}
          onChange={setLooking}
          testId="jam-request-looking"
          label="Looking for"
        />
        <p className="text-[12.5px] text-ink-3 pt-3">
          People who play these can raise a hand.
        </p>
        <Button
          size="lg"
          variant="primary"
          fullWidth
          className="mt-4"
          disabled={busy || !title.trim()}
          onClick={() => void send()}
          data-testid="jam-request-send"
        >
          Send request
        </Button>
      </div>
    </div>
  )
}
