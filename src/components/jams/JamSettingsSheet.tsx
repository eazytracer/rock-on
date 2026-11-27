/**
 * Jam settings (⋯ → Settings, FP 22): who can join, song requests, approving
 * them, the starting parts every new song gets, and under Advanced whether
 * pending requests show to everyone (decision 2).
 */
import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button, Segmented, Sheet, Switch } from '../ui'
import type { JamState, Part, WhoCanJoin } from '../../services/api/jams'
import { PartPicker } from './PartChip'

export interface JamSettingsValue {
  whoCanJoin: WhoCanJoin
  requestsOpen: boolean
  approveMyself: boolean
  requestsVisible: boolean
  defaultParts: Part[]
}

const WHO: { value: WhoCanJoin; label: string }[] = [
  { value: 'invite', label: 'Invite only' },
  { value: 'friends', label: 'Friends' },
  { value: 'code', label: 'Anyone' },
]

const WHO_HINT: Record<WhoCanJoin, string> = {
  invite: 'Not listed. You and co-hosts invite people.',
  friends: "Listed in your friends' Jam hub. Anyone in it can invite friends.",
  code: 'Anyone with the code, link or QR, with or without the app.',
}

const Row: React.FC<{
  title: string
  sub: string
  children: React.ReactNode
}> = ({ title, sub, children }) => (
  <div className="flex items-center gap-3 py-3">
    <div className="flex-1 min-w-0">
      <b className="block text-[15px] text-ink-1">{title}</b>
      <span className="block text-[12.5px] text-ink-3">{sub}</span>
    </div>
    {children}
  </div>
)

export const JamSettingsSheet: React.FC<{
  jam: JamState['jam']
  saving: boolean
  onSave: (v: JamSettingsValue) => void
  onClose: () => void
}> = ({ jam, saving, onSave, onClose }) => {
  const [v, setV] = useState<JamSettingsValue>({
    whoCanJoin: jam.who_can_join,
    requestsOpen: jam.requests_open,
    approveMyself: jam.approve_myself,
    requestsVisible: jam.requests_visible,
    defaultParts: jam.default_parts,
  })
  const [advanced, setAdvanced] = useState(!jam.requests_visible)
  const set = (patch: Partial<JamSettingsValue>) =>
    setV(o => ({ ...o, ...patch }))
  const label =
    'font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 pt-3 pb-2'
  return (
    <Sheet
      onClose={onClose}
      title="Jam settings"
      data-testid="jam-settings-sheet"
    >
      <div className="pb-2">
        <p className={label}>Who can join</p>
        <Segmented
          options={WHO}
          value={v.whoCanJoin}
          onChange={w => set({ whoCanJoin: w })}
          label="Who can join"
          data-testid="jam-settings-who"
        />
        <p
          className="text-[12.5px] text-ink-3 mt-2"
          data-testid="jam-settings-who-hint"
        >
          {WHO_HINT[v.whoCanJoin]}
        </p>

        <div className="divide-y divide-divider mt-2">
          <Row
            title="Song requests"
            sub="People pitch songs with the parts they need"
          >
            <Switch
              checked={v.requestsOpen}
              onChange={c => set({ requestsOpen: c })}
              label="Song requests"
              data-testid="jam-settings-requests-open"
            />
          </Row>
          <Row
            title="Approve requests myself"
            sub={
              v.approveMyself
                ? 'Requests wait for you'
                : 'Requests go straight onto the lineup'
            }
          >
            <Switch
              checked={v.approveMyself}
              onChange={c => set({ approveMyself: c })}
              label="Approve requests myself"
              data-testid="jam-settings-approve-myself"
            />
          </Row>
        </div>

        <p className={label}>Starting parts</p>
        <PartPicker
          value={v.defaultParts}
          onChange={p => set({ defaultParts: p })}
          testId="jam-settings-parts"
          label="Starting parts"
        />
        <p className="text-[12.5px] text-ink-3 mt-2">
          Every song you add starts with these. Change them per song.
        </p>

        <button
          type="button"
          onClick={() => setAdvanced(a => !a)}
          aria-expanded={advanced}
          className="mt-3 flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 hover:text-ink-1"
          data-testid="jam-settings-advanced"
        >
          Advanced
          <ChevronDown
            size={14}
            className={`transition-transform ${advanced ? 'rotate-180' : ''}`}
          />
        </button>
        {advanced && (
          <Row
            title="Show song requests to everyone"
            sub="Off: a request shows only to you and the person who asked"
          >
            <Switch
              checked={v.requestsVisible}
              onChange={c => set({ requestsVisible: c })}
              label="Show song requests to everyone"
              data-testid="jam-settings-requests-visible"
            />
          </Row>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            size="lg"
            className="flex-1"
            onClick={onClose}
            data-testid="jam-settings-cancel"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            variant="primary"
            className="flex-1"
            disabled={saving || !v.defaultParts.length}
            onClick={() => onSave(v)}
            data-testid="jam-settings-save"
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
