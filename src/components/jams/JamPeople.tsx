/**
 * Everyone in the jam (Jam Plan 5): avatar, name, parts, how they came in
 * (APP / WEB / WALK-UP / KIOSK), the house mark and co-hosts; invited people
 * who haven't joined yet are marked. Managers get a row menu.
 */
import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { PersonAvatar } from '../friends/PersonAvatar'
import type { JamPerson } from '../../hooks/useJam'
import { partLabel } from './parts'

const VIA: Record<JamPerson['via'], string> = {
  app: 'App',
  web: 'Web',
  walkup: 'Walk-up',
  kiosk: 'Kiosk',
}

export const JamPeople: React.FC<{
  people: JamPerson[]
  hostId: string | null
  onMenu?: (p: JamPerson, at: { x: number; y: number }) => void
}> = ({ people, hostId, onMenu }) => {
  const app = people.filter(p => p.joined && p.has_account).length
  const other = people.filter(p => p.joined && !p.has_account).length
  return (
    <>
      <p
        className="px-3 pb-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3"
        data-testid="jam-people-counts"
      >
        {app} on the app{other ? ` · ${other} without` : ''}
      </p>
      <ul
        className="rounded-[20px] bg-bg-2 shadow-group divide-y divide-divider"
        data-testid="jam-people"
      >
        {people.map(p => {
          const marks = [
            p.participant_id === hostId
              ? 'Host'
              : p.tier === 'cohost'
                ? 'Co-host'
                : '',
            p.is_house ? 'House' : '',
            p.joined ? '' : 'Invited',
          ].filter(Boolean)
          return (
            <li
              key={p.participant_id}
              className="flex items-center gap-3 min-h-[60px] pl-3.5 pr-2"
              data-testid={`jam-person-${p.participant_id}`}
            >
              <PersonAvatar name={p.name} color={null} size="md" />
              <span className="flex-1 min-w-0">
                <b className="block truncate text-[15px] text-ink-1">
                  {p.name}
                </b>
                <span className="block truncate text-[12.5px] text-ink-3">
                  {p.parts.map(partLabel).join(', ') || 'No parts yet'}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5 font-mono text-[10px] tracking-[.1em] uppercase">
                <span className="text-ink-3">{VIA[p.via]}</span>
                {marks.length > 0 && (
                  <span
                    className="text-accent-ink"
                    data-testid={`jam-person-marks-${p.participant_id}`}
                  >
                    {marks.join(' · ')}
                  </span>
                )}
              </span>
              {onMenu && p.participant_id !== hostId ? (
                <button
                  type="button"
                  aria-label={`${p.name} menu`}
                  onClick={e => {
                    const r = e.currentTarget.getBoundingClientRect()
                    onMenu(p, { x: r.right - 260, y: r.bottom + 6 })
                  }}
                  className="grid place-items-center w-9 h-9 rounded-full text-ink-3 hover:bg-bg-3 shrink-0"
                  data-testid={`jam-person-menu-${p.participant_id}`}
                >
                  <MoreHorizontal size={18} />
                </button>
              ) : (
                onMenu && <span className="w-9 shrink-0" />
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
