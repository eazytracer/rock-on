/**
 * Profile (Account and Settings 7, 11; desktop `settings.profile`): display
 * name, your instruments in order, and a personal colour. The name saves on
 * Save / Enter; instruments and colour save as you change them.
 */
import React, { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { Button, Group } from '../ui'
import { useMyProfile } from '../../hooks/useAccount'
import { useToast } from '../../contexts/ToastContext'
import { errorText } from '../../services/api/errors'
import type { MyProfile } from '../../services/api/account'
import { InstrumentList } from './InstrumentList'
import { fieldInput, fieldLabel, groupNote } from './fields'

/** Mid-tone colours that read on both themes (`user_profiles.personal_color`). */
const PERSONAL_COLORS = [
  { hex: '#ff7a1a', name: 'Orange' },
  { hex: '#f5c518', name: 'Yellow' },
  { hex: '#4ade80', name: 'Green' },
  { hex: '#2dd4bf', name: 'Teal' },
  { hex: '#60a5fa', name: 'Blue' },
  { hex: '#a78bfa', name: 'Violet' },
  { hex: '#f472b6', name: 'Pink' },
  { hex: '#f87171', name: 'Red' },
] as const

export const ProfileSettings: React.FC = () => {
  const { data, isLoading, save, saving } = useMyProfile()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  useEffect(() => {
    if (data) setName(data.name)
  }, [data?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (changes: Partial<MyProfile>, done?: string) => {
    try {
      await save(changes)
      if (done) showToast(done, 'success')
    } catch (err) {
      showToast(errorText(err), 'error')
    }
  }

  if (isLoading || !data)
    return <p className="px-6 py-4 text-ink-3 text-sm">Loading…</p>

  const nameDirty = name.trim() !== data.name && name.trim().length > 0

  return (
    <div data-testid="settings-profile">
      <div className="flex flex-col items-center gap-2 pt-2 pb-5">
        <Avatar
          label={data.name || '?'}
          color={data.personalColor ?? undefined}
          className="!w-24 !h-24 !text-[34px]"
          data-testid="profile-avatar"
        />
      </div>

      <Group>
        <form
          className="p-4"
          onSubmit={e => {
            e.preventDefault()
            if (nameDirty) void apply({ name: name.trim() }, 'Name saved')
          }}
        >
          <label htmlFor="profile-display-name" className={fieldLabel}>
            Display name
          </label>
          <div className="flex gap-2">
            <input
              id="profile-display-name"
              name="displayName"
              data-testid="profile-name-input"
              value={name}
              maxLength={60}
              onChange={e => setName(e.target.value)}
              className={`${fieldInput} flex-1`}
            />
            {nameDirty && (
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                data-testid="profile-name-save"
              >
                Save
              </Button>
            )}
          </div>
        </form>
      </Group>

      <InstrumentList
        value={data.instruments}
        onChange={instruments => void apply({ instruments })}
      />
      <p className={groupNote}>
        Drag or use the arrows to reorder. The first shows first where space is
        short. For jams you pick what you'll play each time.
      </p>

      <Group label="Colour">
        <div
          role="radiogroup"
          aria-label="Personal colour"
          className="flex flex-wrap gap-2.5 p-4"
        >
          <ColorChoice
            label="Auto"
            selected={!data.personalColor}
            onPick={() => void apply({ personalColor: null })}
            testId="profile-color-auto"
          />
          {PERSONAL_COLORS.map(c => (
            <ColorChoice
              key={c.hex}
              label={c.name}
              hex={c.hex}
              selected={data.personalColor === c.hex}
              onPick={() => void apply({ personalColor: c.hex })}
              testId={`profile-color-${c.name.toLowerCase()}`}
            />
          ))}
        </div>
      </Group>
      <p className={groupNote} data-testid="profile-email-note">
        Shown on rosters, events and jams. Your email isn't shown here or to
        bandmates.
      </p>
    </div>
  )
}

const ColorChoice: React.FC<{
  label: string
  hex?: string
  selected: boolean
  onPick: () => void
  testId: string
}> = ({ label, hex, selected, onPick, testId }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    aria-label={label}
    title={label}
    onClick={onPick}
    data-testid={testId}
    className={`grid place-items-center w-10 h-10 rounded-full ${
      selected ? 'ring-2 ring-offset-2 ring-offset-bg-2 ring-ink-1' : ''
    } ${hex ? '' : 'bg-bg-3 text-[11px] font-bold text-ink-2'}`}
    style={hex ? { backgroundColor: hex } : undefined}
  >
    {hex ? selected && <Check size={18} className="text-[#1a1208]" /> : 'Auto'}
  </button>
)
