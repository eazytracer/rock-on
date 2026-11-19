/**
 * Push notifications (Account and Settings 8): a master switch, three groups
 * of types, a per-band mute and quiet hours, saved to `user_preferences.push`.
 * Preferences only: delivery comes in a later phase.
 */
import React from 'react'
import { BandMark, Group, Switch } from '../ui'
import type { BandMarkValue } from '../ui/bandMarkPalette'
import { usePushPrefs } from '../../hooks/useAccount'
import { useMyContexts } from '../../hooks/useMyContexts'
import { useToast } from '../../contexts/ToastContext'
import { errorText } from '../../services/api/errors'
import type { PushPrefs, PushType } from '../../services/api/preferences'
import { formatTime12Hour } from '../../utils/dateHelpers'
import { fieldInput, fieldLabel, groupNote } from './fields'

const GROUPS: { label: string; types: [PushType, string, string][] }[] = [
  {
    label: 'Reminders',
    types: [
      ['shows', 'Shows', 'Day before, and 2 hours before load-in'],
      ['practices', 'Practices', '3 hours before'],
      ['events', "Events I'm going to", 'Day before'],
    ],
  },
  {
    label: 'Changes to my plans',
    types: [
      ['planChanged', 'Show or practice changed', 'Time, place, or cancelled'],
      [
        'setChanged',
        'Set changed close to a show',
        "Edits within 7 days of a show you're playing",
      ],
    ],
  },
  {
    label: 'People',
    types: [
      ['invites', 'Invites', 'To a band or an event'],
      ['friendRequests', 'Friend requests', ''],
    ],
  },
]

const SwitchRow: React.FC<{
  title: React.ReactNode
  sub?: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  lead?: React.ReactNode
  testId: string
}> = ({ title, sub, checked, disabled, onChange, lead, testId }) => (
  <div
    className={`flex items-center gap-3 min-h-14 py-2 pl-4 pr-3 ${
      disabled ? 'opacity-50' : ''
    }`}
  >
    {lead}
    <span className="flex-1 min-w-0">
      <b className="block text-[15px] font-semibold text-ink-1">{title}</b>
      {sub && (
        <small className="block text-[12.5px] leading-snug text-ink-3">
          {sub}
        </small>
      )}
    </span>
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      label={typeof title === 'string' ? title : testId}
      data-testid={testId}
    />
  </div>
)

/** "23:00" → a Date today at that time, for the 12-hour formatter. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

export const NotificationSettings: React.FC = () => {
  const { prefs, save } = usePushPrefs()
  const { data: bands } = useMyContexts()
  const { showToast } = useToast()
  const off = !prefs.enabled
  const set = (changes: Partial<PushPrefs>) =>
    save(changes).catch(err => showToast(errorText(err), 'error'))
  const q = prefs.quietHours

  return (
    <div data-testid="settings-notifications">
      <Group>
        <SwitchRow
          title="Allow push notifications"
          sub="Off turns everything below off"
          checked={prefs.enabled}
          onChange={enabled => set({ enabled })}
          testId="push-enabled-switch"
        />
      </Group>

      {GROUPS.map(g => (
        <Group key={g.label} label={g.label}>
          {g.types.map(([t, title, sub]) => (
            <SwitchRow
              key={t}
              title={title}
              sub={sub}
              checked={prefs.types[t]}
              disabled={off}
              onChange={v => set({ types: { ...prefs.types, [t]: v } })}
              testId={`push-type-${t}-switch`}
            />
          ))}
        </Group>
      ))}

      {!!bands?.length && (
        <Group label="Per band">
          {bands.map(b => {
            const muted = prefs.mutedBands.includes(b.band_id)
            return (
              <SwitchRow
                key={b.band_id}
                lead={
                  <BandMark
                    name={b.name}
                    mark={b.mark as BandMarkValue | null}
                    size={32}
                  />
                }
                title={b.name}
                sub={muted ? 'Muted' : 'All of the above'}
                checked={!muted}
                disabled={off}
                onChange={on =>
                  set({
                    mutedBands: on
                      ? prefs.mutedBands.filter(id => id !== b.band_id)
                      : [...prefs.mutedBands, b.band_id],
                  })
                }
                testId={`push-band-${b.band_id}-switch`}
              />
            )
          })}
        </Group>
      )}

      <Group label="Quiet hours">
        <SwitchRow
          title={
            q.enabled
              ? `${formatTime12Hour(at(q.start))} – ${formatTime12Hour(at(q.end))}`
              : 'Quiet hours'
          }
          sub={q.enabled ? 'Push waits until it ends' : 'Off'}
          checked={q.enabled}
          disabled={off}
          onChange={enabled => set({ quietHours: { ...q, enabled } })}
          testId="push-quiet-switch"
        />
        {q.enabled && (
          <div
            className={`grid grid-cols-2 gap-3 px-4 pb-4 pt-3 ${off ? 'opacity-50' : ''}`}
          >
            {(['start', 'end'] as const).map(k => (
              <div key={k}>
                <label htmlFor={`push-quiet-${k}`} className={fieldLabel}>
                  {k === 'start' ? 'From' : 'Until'}
                </label>
                <input
                  type="time"
                  id={`push-quiet-${k}`}
                  name={k === 'start' ? 'quietStart' : 'quietEnd'}
                  data-testid={`push-quiet-${k}-input`}
                  value={q[k]}
                  disabled={off}
                  onChange={e =>
                    e.target.value &&
                    set({
                      quietHours: {
                        ...q,
                        [k]: e.target.value,
                        tz:
                          Intl.DateTimeFormat().resolvedOptions().timeZone ||
                          q.tz,
                      },
                    })
                  }
                  className={fieldInput}
                />
              </div>
            ))}
            <p className="col-span-2 text-[12.5px] text-ink-3">
              In your time zone ({q.tz}).
            </p>
          </div>
        )}
      </Group>
      <p className={groupNote} data-testid="push-not-on-yet">
        Push isn't on yet. These choices are saved and apply when it arrives;
        everything still shows in Notifications.
      </p>
    </div>
  )
}
