/**
 * An ended jam: "Ended · N songs played", the played songs in called order,
 * and (hosts) Save tonight as a setlist in Personal or one of your bands,
 * which then opens the new set.
 */
import React, { useState } from 'react'
import { ListMusic, User } from 'lucide-react'
import { Button, Sheet, SheetItem } from '../ui'
import { BandMark } from '../ui/BandMark'
import { LineNumber, SongLine } from '../songs/SongLine'
import { useMyContexts } from '../../hooks/useMyContexts'
import type { BandMarkValue } from '../ui/bandMarkPalette'
import type { JamState } from '../../services/api/jams'
import { toJamSongLine } from './parts'

export const JamEnded: React.FC<{
  state: JamState
  busy: boolean
  onSave: (contextType: 'personal' | 'band', contextId?: string) => void
}> = ({ state, busy, onSave }) => {
  const [picking, setPicking] = useState(false)
  const { data: bands = [] } = useMyContexts()
  const played = state.items
    .filter(i => i.state === 'played')
    .sort((a, b) => (a.called_at ?? '').localeCompare(b.called_at ?? ''))
  const cancelled = state.jam.status === 'cancelled'
  const manage = !!state.me?.is_manager
  return (
    <section data-testid="jam-ended">
      <p
        className="px-1 pb-2 font-mono text-[11px] tracking-[.12em] uppercase text-ink-3"
        data-testid="jam-ended-summary"
      >
        {cancelled
          ? 'Called off'
          : `Ended · ${played.length} ${played.length === 1 ? 'song' : 'songs'} played`}
      </p>
      {played.length > 0 ? (
        <ol
          className="rounded-[20px] bg-bg-2 shadow-group divide-y divide-divider"
          data-testid="jam-played"
        >
          {played.map((it, i) => (
            <li key={it.id} data-testid={`jam-played-${it.id}`}>
              <SongLine
                song={toJamSongLine(it)}
                className="px-3"
                lead={<LineNumber n={i + 1} />}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-1 py-6 text-[14.5px] text-ink-3">
          Nothing was played.
        </p>
      )}
      {manage && played.length > 0 && (
        <Button
          size="lg"
          variant="primary"
          icon={<ListMusic size={18} />}
          className="mt-4 w-full md:w-auto"
          disabled={busy}
          onClick={() => setPicking(true)}
          data-testid="jam-save-setlist"
        >
          Save tonight as a setlist
        </Button>
      )}
      {picking && (
        <Sheet
          onClose={() => setPicking(false)}
          title="Save tonight as a setlist"
          sub="The played songs in order. Songs not in the catalog are added."
          data-testid="jam-save-setlist-sheet"
        >
          <div role="menu" className="pb-2">
            <SheetItem
              icon={<User />}
              label="Personal"
              hint="My songs"
              disabled={busy}
              onClick={() => onSave('personal')}
              data-testid="jam-save-setlist-personal"
            />
            {bands.map(b => (
              <SheetItem
                key={b.band_id}
                icon={
                  <BandMark
                    name={b.name}
                    mark={b.mark as unknown as BandMarkValue}
                    size={19}
                  />
                }
                label={b.name}
                disabled={busy}
                onClick={() => onSave('band', b.band_id)}
                data-testid={`jam-save-setlist-band-${b.band_id}`}
              />
            ))}
          </div>
        </Sheet>
      )}
    </section>
  )
}
