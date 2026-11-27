/**
 * Tonight's sheets: raise a hand on a song (pick parts, yours first), pitch a
 * song (title, artist, I'll play), and compare songs with one person (in
 * common / only you / only them, Pitch one together).
 */
import React, { useState } from 'react'
import { Hand as HandIcon, Send } from 'lucide-react'
import { Button, Segmented, Sheet, SkeletonRow } from '../../ui'
import { PartPicker, PartToggle } from '../PartChip'
import * as jams from '../../../services/api/jams'
import type { JamState, Part } from '../../../services/api/jams'
import {
  partName,
  useWhoKnowsYourSongs,
  type JamItem,
} from '../../../hooks/useJam'
import { asPart, pitchToast, samePart, type useLiveRunner } from './live'

type Run = ReturnType<typeof useLiveRunner>['run']

const input =
  'w-full h-14 rounded-2xl bg-bg-3 px-4 text-[16px] text-ink-1 placeholder:text-ink-4 outline-none focus:ring-2 focus:ring-accent'

/** The song's distinct parts. */
const songParts = (item: JamItem): Part[] => {
  const out: Part[] = []
  item.parts_needed.forEach(p => {
    if (!out.some(o => samePart(o, p))) out.push(asPart(p))
  })
  return out
}

export const RaiseHandSheet: React.FC<{
  state: JamState
  item: JamItem
  run: Run
  onClose: () => void
}> = ({ state, item, run, onClose }) => {
  const mine = item.hands.filter(h => h.mine)
  const myParts = state.me?.parts ?? []
  const open = songParts(item).filter(p =>
    item.slots.some(s => s.gap && samePart(s, p))
  )
  const [picked, setPicked] = useState<Part[]>(() => {
    const fits = open.filter(p => myParts.some(m => samePart(m, p)))
    return fits.filter(p => !mine.some(h => samePart(h, p)))
  })
  const parts = songParts(item).filter(p => !mine.some(h => samePart(h, p)))
  const taken = (p: Part) => !item.slots.some(s => s.gap && samePart(s, p))
  const toggle = (p: Part) =>
    setPicked(cur =>
      cur.some(x => samePart(x, p))
        ? cur.filter(x => !samePart(x, p))
        : [...cur, p]
    )
  // Your parts first.
  parts.sort(
    (a, b) =>
      Number(myParts.some(m => samePart(m, b))) -
      Number(myParts.some(m => samePart(m, a)))
  )

  return (
    <Sheet
      onClose={onClose}
      title={`Raise your hand · ${item.title}`}
      sub={
        open.length
          ? `Open: ${open.map(p => partName(p)).join(', ')}. Pick every part you'd play.`
          : 'Every part is filled. Your hand still tells the host you know it.'
      }
      data-testid="raise-sheet"
    >
      {mine.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {mine.map(h => (
            <div
              key={h.id}
              className="flex items-center gap-3 min-h-14 rounded-2xl bg-bg-3 px-3.5"
            >
              <HandIcon size={18} className="text-accent-ink" />
              <span className="flex-1 text-[15px] font-semibold">
                {h.status === 'accepted'
                  ? `You're on ${partName(h).toLowerCase()}`
                  : `Hand up for ${partName(h).toLowerCase()}`}
              </span>
              <Button
                onClick={() => {
                  onClose()
                  void run(() => jams.lowerHand(h.id), {
                    ok: 'Hand lowered',
                  })
                }}
                data-testid={`raise-lower-${h.key}`}
              >
                Lower
              </Button>
            </div>
          ))}
        </div>
      )}
      {parts.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-2">
            {parts.map(p => (
              <PartToggle
                key={`${p.key}-${p.label ?? ''}`}
                part={p}
                on={picked.some(x => samePart(x, p))}
                onClick={() => toggle(p)}
                data-testid={`raise-part-${p.label ? p.label.toLowerCase() : p.key}`}
              >
                {taken(p) && (
                  <small className="font-normal opacity-70">· taken</small>
                )}
              </PartToggle>
            ))}
          </div>
          <p className="font-mono text-[10.5px] tracking-[.1em] text-ink-3 mb-3 mx-1">
            YOUR PARTS ARE FIRST · ANY PART CAN BE PICKED
          </p>
        </>
      )}
      <div className="grid grid-cols-2 gap-2 pb-2">
        <Button size="lg" onClick={onClose} data-testid="raise-cancel">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          icon={<HandIcon size={18} />}
          disabled={picked.length === 0}
          onClick={() => {
            onClose()
            void run(() => jams.raiseHand(item.id, picked), {
              ok: `Hand up on ${item.title}`,
            })
          }}
          data-testid="raise-submit"
        >
          Raise hand{picked.length > 1 ? ` · ${picked.length} parts` : ''}
        </Button>
      </div>
    </Sheet>
  )
}

export const PitchSheet: React.FC<{
  state: JamState
  run: Run
  onClose: () => void
  initial?: { title: string; artist?: string | null; songId?: string }
}> = ({ state, run, onClose, initial }) => {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [artist, setArtist] = useState(initial?.artist ?? '')
  const [parts, setParts] = useState<Part[]>(state.me?.parts ?? [])
  const [busy, setBusy] = useState(false)
  const closed = !state.jam.requests_open && !state.me?.is_manager
  const approval = state.jam.approve_myself && !state.me?.is_manager

  const submit = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    const fromSong = initial?.songId && title === initial.title
    const r = await run(
      () =>
        jams.pitchSong(state.jam.id, {
          songId: fromSong ? initial!.songId : undefined,
          title: fromSong ? undefined : title.trim(),
          artist: fromSong ? undefined : artist.trim() || undefined,
          myParts: parts,
        }),
      { ok: pitchToast(state) }
    )
    setBusy(false)
    if (r) onClose()
  }

  return (
    <Sheet
      onClose={onClose}
      title="Pitch a song"
      sub={
        closed
          ? 'The host closed requests for now.'
          : approval
            ? `Others who know it can jump on. ${state.jam.host_name || 'The host'} approves pitches.`
            : 'Others who know it can jump on.'
      }
      data-testid="pitch-sheet"
    >
      <form
        onSubmit={e => {
          e.preventDefault()
          void submit()
        }}
        className="flex flex-col gap-2 pb-2"
      >
        <label htmlFor="pitch-title" className="sr-only">
          Song
        </label>
        <input
          id="pitch-title"
          name="pitchTitle"
          maxLength={80}
          autoFocus={!initial}
          disabled={closed}
          placeholder="Song"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className={input}
          data-testid="pitch-title-input"
        />
        <label htmlFor="pitch-artist" className="sr-only">
          Artist
        </label>
        <input
          id="pitch-artist"
          name="pitchArtist"
          maxLength={80}
          disabled={closed}
          placeholder="Artist (optional)"
          value={artist ?? ''}
          onChange={e => setArtist(e.target.value)}
          className={input}
          data-testid="pitch-artist-input"
        />
        <div className="font-mono text-[10.5px] tracking-[.1em] text-ink-3 mt-2 mx-1">
          I'LL PLAY
        </div>
        <PartPicker
          value={parts}
          onChange={setParts}
          extra={state.jam.default_parts}
          testId="pitch-part"
          label="I'll play"
        />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button size="lg" onClick={onClose} data-testid="pitch-cancel">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={<Send size={17} />}
            disabled={closed || busy || !title.trim()}
            data-testid="pitch-submit"
          >
            Send pitch
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

type Tab = 'common' | 'mine' | 'theirs'
interface OverlapSong {
  title: string
  artist: string | null
  my_song_id?: string
}

export const CompareSheet: React.FC<{
  state: JamState
  other: { participant_id: string; name: string }
  onPitch: (song: {
    title: string
    artist?: string | null
    songId?: string
  }) => void
  onClose: () => void
}> = ({ state, other, onPitch, onClose }) => {
  const q = useWhoKnowsYourSongs(state.jam.id, other.participant_id)
  const [tab, setTab] = useState<Tab>('common')
  const row = q.data?.[0]
  const first = other.name.split(' ')[0]
  const lists: Record<Tab, OverlapSong[]> = {
    common: (row?.common as unknown as OverlapSong[]) ?? [],
    mine: (row?.only_mine as unknown as OverlapSong[]) ?? [],
    theirs: (row?.only_theirs as unknown as OverlapSong[]) ?? [],
  }
  const person = state.people.find(
    p => p.participant_id === other.participant_id
  )
  return (
    <Sheet
      onClose={onClose}
      title={`You and ${first}`}
      data-testid="compare-sheet"
    >
      <div className="flex items-center justify-around py-2 mb-2">
        <span className="text-center">
          <b className="block text-[15px]">You</b>
          <small className="text-[12.5px] text-ink-3">
            {(state.me?.parts ?? []).map(p => partName(p)).join(', ')}
          </small>
        </span>
        <span className="text-center">
          <b
            className="block font-display text-[40px] leading-none"
            data-testid="compare-count"
          >
            {lists.common.length}
          </b>
          <small className="font-mono text-[10px] tracking-[.1em] text-ink-3">
            IN COMMON
          </small>
        </span>
        <span className="text-center">
          <b className="block text-[15px]">{first}</b>
          <small className="text-[12.5px] text-ink-3">
            {(person?.parts ?? []).map(p => partName(p)).join(', ')}
          </small>
        </span>
      </div>
      <Segmented
        label="Songs"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'common', label: `In common ${lists.common.length}` },
          { value: 'mine', label: `Only you ${lists.mine.length}` },
          { value: 'theirs', label: `Only ${first} ${lists.theirs.length}` },
        ]}
        data-testid="compare-tab"
      />
      <div className="mt-3 pb-2">
        {q.isLoading ? (
          <SkeletonRow />
        ) : lists[tab].length === 0 ? (
          <p className="text-[13.5px] text-ink-3 px-1 py-3">No songs here.</p>
        ) : (
          <ul className="rounded-[20px] bg-bg-3 divide-y divide-divider overflow-hidden">
            {lists[tab].map((s, i) => (
              <li
                key={`${s.title}-${i}`}
                className="flex items-center gap-3 min-h-14 pl-4 pr-2"
                data-testid={`compare-song-${i}`}
              >
                <span className="flex-1 min-w-0">
                  <b className="block text-[15px] truncate">{s.title}</b>
                  {s.artist && (
                    <small className="block text-[12.5px] text-ink-3 truncate">
                      {s.artist}
                    </small>
                  )}
                </span>
                {(state.jam.requests_open || state.me?.is_manager) && (
                  <Button
                    onClick={() =>
                      onPitch({
                        title: s.title,
                        artist: s.artist,
                        songId: s.my_song_id,
                      })
                    }
                    data-testid="compare-pitch"
                  >
                    Pitch
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
