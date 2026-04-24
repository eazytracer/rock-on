import React from 'react'
import { Eye } from 'lucide-react'
import type { JamWatcher } from '../../hooks/useJamPresence'

interface JamWatcherListProps {
  watchers: JamWatcher[]
}

/**
 * Compact list of anonymous viewers currently connected to the jam
 * session. Rendered under the authenticated-participant list so the
 * host can see at a glance who's watching live.
 *
 * Semantically separate from JamParticipantList — watchers can't
 * contribute songs, have no catalog, and hold no jam_participants row.
 * Keeping them visually distinct (different section, eye icon) makes
 * the contribution boundary clear.
 *
 * When the watcher has no name set (lurker), we show a de-emphasized
 * "Someone watching" entry. They still count — the host can see a
 * non-zero audience even when nobody has filled in a name yet.
 */
export const JamWatcherList: React.FC<JamWatcherListProps> = ({ watchers }) => {
  if (watchers.length === 0) return null

  return (
    <div data-testid="jam-watcher-list" className="space-y-2">
      <h3 className="text-[#a0a0a0] text-xs font-medium uppercase tracking-wide flex items-center gap-2">
        <Eye size={12} />
        Watching ({watchers.length})
      </h3>
      <ul className="space-y-1.5">
        {watchers.map(w => {
          const hasName = w.name.trim().length > 0
          const label = hasName ? w.name : 'Someone watching'
          return (
            <li
              key={w.key}
              data-testid={`jam-watcher-${w.key}`}
              className="flex items-center gap-2 text-sm text-[#c0c0c0]"
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70"
              />
              <span
                className={hasName ? 'text-white' : 'text-[#808080] italic'}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
