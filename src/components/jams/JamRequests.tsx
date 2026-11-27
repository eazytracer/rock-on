/**
 * Pending pitches (Jam Plan 4; decision 2): song, who asked, what they'll
 * play, who they're looking for and the hands up. Hosts Approve (onto the
 * lineup with the hands) or Decline; others raise a hand from the row.
 */
import React from 'react'
import { Check, X } from 'lucide-react'
import { SongLine } from '../songs/SongLine'
import { Button } from '../ui'
import type { JamItem } from '../../hooks/useJam'
import { partName } from '../../hooks/useJam'
import { SlotChips } from './PartChip'
import { partLabel, samePart, toJamSongLine } from './parts'

type Slot = JamItem['slots'][number]

export const JamRequests: React.FC<{
  items: JamItem[]
  me: string | null
  manage: boolean
  busy: boolean
  onApprove: (item: JamItem) => void
  onDecline: (item: JamItem) => void
  onSlot: (item: JamItem, slot: Slot) => void
  onOpen: (item: JamItem) => void
}> = ({ items, me, manage, busy, onApprove, onDecline, onSlot, onOpen }) => (
  <ul
    className="rounded-[20px] bg-bg-2 shadow-group divide-y divide-divider"
    data-testid="jam-requests"
  >
    {items.map(it => {
      const own = it.hands.filter(h => h.participant_id === it.pitched_by)
      const plays = own.map(h => partLabel(h))
      const looking = it.slots
        .filter(s => s.gap && !own.some(h => samePart(h, s)))
        .map(s => partName(s, s.nth))
      return (
        <li
          key={it.id}
          onClick={() => onOpen(it)}
          className="cursor-pointer hover:bg-bg-3/40 first:rounded-t-[20px] last:rounded-b-[20px]"
          data-testid={`jam-request-${it.id}`}
        >
          <SongLine
            song={toJamSongLine(it)}
            className="px-3"
            titleTestId={`jam-request-title-${it.id}`}
            sub={
              <>
                <span className="block text-[12.5px] text-ink-3">
                  {[
                    it.pitched_by_name && `Asked by ${it.pitched_by_name}`,
                    plays.length && `plays ${plays.join(', ')}`,
                    looking.length && `looking for ${looking.join(', ')}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <SlotChips
                  item={it}
                  me={me}
                  onSlot={manage ? s => onSlot(it, s) : undefined}
                />
                {manage && (
                  <span
                    className="flex gap-2 pt-2.5"
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      variant="primary"
                      className="!h-9 !text-[13px]"
                      icon={<Check size={15} />}
                      disabled={busy}
                      onClick={() => onApprove(it)}
                      data-testid={`jam-request-approve-${it.id}`}
                    >
                      Approve
                    </Button>
                    <Button
                      className="!h-9 !text-[13px]"
                      icon={<X size={15} />}
                      disabled={busy}
                      onClick={() => onDecline(it)}
                      data-testid={`jam-request-decline-${it.id}`}
                    >
                      Decline
                    </Button>
                  </span>
                )}
              </>
            }
          />
        </li>
      )
    })}
  </ul>
)
