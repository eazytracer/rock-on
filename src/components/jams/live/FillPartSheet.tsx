/**
 * Fill a part (Jam Host 2): hands up first, then house players, then anyone
 * here, or Ask the room. A filled part can be emptied again.
 */
import React from 'react'
import { BellRing, UserMinus } from 'lucide-react'
import { Button, Sheet } from '../../ui'
import * as jams from '../../../services/api/jams'
import type { JamState } from '../../../services/api/jams'
import { partName, type JamItem, type JamPerson } from '../../../hooks/useJam'
import { asPart, samePart, slotName, type Slot } from './live'
import type { useLiveRunner } from './live'

const Row: React.FC<{
  lead: React.ReactNode
  title: string
  sub?: string
  tag?: string
  onClick: () => void
  'data-testid': string
}> = ({ lead, title, sub, tag, onClick, 'data-testid': testId }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 min-h-16 px-3.5 rounded-2xl bg-bg-3 hover:bg-bg-4 text-left"
    data-testid={testId}
  >
    {lead}
    <span className="flex-1 min-w-0">
      <b className="block text-[15.5px] text-ink-1 truncate">{title}</b>
      {sub && <small className="block text-[12.5px] text-ink-3">{sub}</small>}
    </span>
    {tag && (
      <span className="font-mono text-[9.5px] tracking-[.08em] px-1.5 py-0.5 rounded-md bg-accent text-on-accent">
        {tag}
      </span>
    )}
  </button>
)

const Av: React.FC<{ name: string }> = ({ name }) => (
  <span className="grid place-items-center w-9 h-9 rounded-full bg-bg-1 text-[13px] font-bold text-ink-1 shrink-0">
    {name.slice(0, 1).toUpperCase()}
  </span>
)

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="font-mono text-[10.5px] tracking-[.1em] text-ink-3 mt-2 mb-0.5 mx-1 uppercase">
    {children}
  </div>
)

export const FillPartSheet: React.FC<{
  state: JamState
  item: JamItem
  slot: Slot
  run: ReturnType<typeof useLiveRunner>['run']
  onClose: () => void
}> = ({ state, item, slot, run, onClose }) => {
  const part = asPart(slot)
  const name = partName(part)
  const onSong = new Set(
    item.slots.filter(s => s.cast).map(s => s.cast!.participant_id)
  )
  const hands = item.hands.filter(
    h =>
      h.status === 'raised' &&
      samePart(h, part) &&
      !onSong.has(h.participant_id)
  )
  const handIds = new Set(hands.map(h => h.participant_id))
  const free = (p: JamPerson) =>
    p.joined && !onSong.has(p.participant_id) && !handIds.has(p.participant_id)
  const house = state.people.filter(p => p.is_house && free(p))
  const plays = (p: JamPerson) => p.parts.some(x => samePart(x, part))
  const others = state.people
    .filter(p => !p.is_house && free(p))
    .sort((a, b) => Number(plays(b)) - Number(plays(a)))

  const cast = (participantId: string, who: string) => {
    onClose()
    void run(() => jams.setCast(item.id, part, participantId), {
      ok: `${who.split(' ')[0]} on ${name.toLowerCase()}`,
      undo: () => jams.setCast(item.id, part, participantId, false),
    })
  }

  return (
    <Sheet
      onClose={onClose}
      title={`${slotName(item, slot)} for ${item.title}`}
      sub="One tap. Or leave it open and call them up anyway."
      data-testid="fill-part-sheet"
    >
      <div className="flex flex-col gap-2 pb-2">
        {slot.cast && (
          <Row
            lead={<UserMinus size={20} className="text-danger" />}
            title={`Take ${slot.cast.name.split(' ')[0]} off`}
            sub={`${name} goes back to open`}
            onClick={() => {
              onClose()
              void run(
                () =>
                  jams.setCast(item.id, part, slot.cast!.participant_id, false),
                { ok: `${name} is open` }
              )
            }}
            data-testid="fill-uncast"
          />
        )}
        <Label>Hands up</Label>
        {hands.length === 0 && (
          <p className="text-[13px] text-ink-3 mx-1">
            No hands up for {name.toLowerCase()} yet.
          </p>
        )}
        {hands.map(h => (
          <Row
            key={h.id}
            lead={<Av name={h.name} />}
            title={h.name}
            sub={`Hand up for ${name.toLowerCase()}`}
            onClick={() => cast(h.participant_id, h.name)}
            data-testid={`fill-hand-${h.participant_id}`}
          />
        ))}
        {house.length > 0 && <Label>House players</Label>}
        {house.map(p => (
          <Row
            key={p.participant_id}
            lead={<Av name={p.name} />}
            title={p.name}
            sub={p.parts.map(x => partName(x)).join(', ') || 'House player'}
            tag="HOUSE"
            onClick={() => cast(p.participant_id, p.name)}
            data-testid={`fill-person-${p.participant_id}`}
          />
        ))}
        {others.length > 0 && <Label>Anyone here</Label>}
        {others.map(p => (
          <Row
            key={p.participant_id}
            lead={<Av name={p.name} />}
            title={p.name}
            sub={
              plays(p)
                ? `Plays ${name.toLowerCase()}`
                : p.parts.map(x => partName(x)).join(', ') || undefined
            }
            onClick={() => cast(p.participant_id, p.name)}
            data-testid={`fill-person-${p.participant_id}`}
          />
        ))}
        {state.jam.status === 'live' && slot.gap && (
          <>
            <Label>Or</Label>
            <Row
              lead={<BellRing size={20} className="text-accent-ink" />}
              title="Ask the room"
              sub={`Nudges everyone here who plays ${name.toLowerCase()}`}
              onClick={() => {
                onClose()
                void run(() => jams.askTheRoom(item.id, part), {
                  ok: `Asked the room for ${name.toLowerCase()}`,
                })
              }}
              data-testid="fill-ask-room"
            />
          </>
        )}
        <Button
          size="lg"
          fullWidth
          className="mt-2"
          onClick={onClose}
          data-testid="fill-leave-open"
        >
          {slot.gap ? 'Leave open' : 'Done'}
        </Button>
      </div>
    </Sheet>
  )
}
