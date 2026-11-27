/**
 * One song for a web guest: title, artist, each part's slot (who's on it, or
 * open, with the hands up), and a hand button per part the guest plays that
 * the song needs. Tap to raise, tap again to lower.
 */
import React from 'react'
import { Hand } from 'lucide-react'
import type { JamItem } from '../../../hooks/useJam'
import { partName } from '../../../hooks/useJam'
import type { Part } from '../../../services/api/jams'
import { neededParts, partId, partLabel, samePart } from './parts'

export const GuestSongRow: React.FC<{
  item: JamItem
  myParts: Part[]
  tag?: string
  busy?: boolean
  onRaise?: (item: JamItem, part: Part) => void
  onLower?: (handId: string) => void
}> = ({ item, myParts, tag, busy, onRaise, onLower }) => {
  const mine = item.hands.filter(h => h.mine)
  const handable = neededParts(item).filter(p =>
    myParts.some(m => samePart(m, p))
  )
  const testid = `guest-song-${item.id}`
  return (
    <div className="px-4 py-3" data-testid={testid} data-title={item.title}>
      <div className="flex items-baseline gap-2">
        <b className="text-[16px] text-ink-1 truncate">{item.title}</b>
        {tag && (
          <span
            className="font-mono text-[10px] tracking-[.1em] uppercase text-ink-3 shrink-0"
            data-testid={`${testid}-tag`}
          >
            {tag}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-3 shrink-0">
          {item.covered}/{item.total}
        </span>
      </div>
      {item.artist && (
        <div className="text-[13px] text-ink-3 truncate">{item.artist}</div>
      )}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {item.slots.map(s => (
          <span
            key={`${s.key}-${s.label ?? ''}-${s.nth}`}
            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12.5px] ${
              s.cast
                ? 'bg-bg-3 text-ink-1 font-semibold'
                : 'text-ink-3 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'
            }`}
          >
            <small className="font-mono text-[10px] uppercase tracking-[.06em] text-ink-3">
              {partName(s, s.nth)}
            </small>
            {s.cast ? (
              s.cast.name
            ) : s.raised ? (
              <>
                <Hand size={12} aria-label="hands up" />
                {s.raised}
              </>
            ) : (
              'Open'
            )}
          </span>
        ))}
      </div>
      {handable.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {handable.map(p => {
            const hand = mine.find(h => samePart(h, p))
            const accepted = hand?.status === 'accepted'
            return (
              <button
                key={partId(p)}
                type="button"
                disabled={busy || accepted}
                aria-pressed={!!hand}
                onClick={() => (hand ? onLower?.(hand.id) : onRaise?.(item, p))}
                className={`inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-[14px] font-semibold disabled:opacity-60 ${
                  hand
                    ? 'bg-accent text-on-accent'
                    : 'text-ink-1 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'
                }`}
                data-testid={`${testid}-hand-${p.key}`}
              >
                <Hand size={16} />
                {accepted
                  ? `You're on ${partLabel(p)}`
                  : hand
                    ? `Hand up · ${partLabel(p)}`
                    : `Raise · ${partLabel(p)}`}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
