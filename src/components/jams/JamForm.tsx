/**
 * A jam's name, date + start and where, as Host a jam and ⋯ → Edit use them.
 * Dates go through utils/dateHelpers (local, never UTC-shifted).
 */
import React, { useState } from 'react'
import { MapPin } from 'lucide-react'
import { DatePicker } from '../common/DatePicker'
import { TimePickerDropdown } from '../common/TimePickerDropdown'
import { Button, Sheet } from '../ui'
import type { JamState } from '../../services/api/jams'
import { jamFormFrom, type JamFormValue } from './parts'

const label =
  'block font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 mb-1.5'

export const JamFields: React.FC<{
  value: JamFormValue
  onChange: (v: JamFormValue) => void
  onSubmit: () => void
  error?: string | null
  testId: string
}> = ({ value: v, onChange, onSubmit, error, testId }) => {
  const set = (patch: Partial<JamFormValue>) => onChange({ ...v, ...patch })
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${testId}-name`} className={label}>
          Name <span className="text-accent-ink">required</span>
        </label>
        <input
          id={`${testId}-name`}
          name="jamName"
          data-testid={`${testId}-name-input`}
          autoFocus
          value={v.name}
          maxLength={80}
          onChange={e => set({ name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder="Friday Night Jam"
          aria-invalid={!!error}
          className="w-full h-14 px-4 rounded-2xl bg-bg-3 text-[17px] font-semibold text-ink-1 outline-none placeholder:text-ink-4 focus:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]"
        />
        {error && (
          <p
            className="mt-2 text-[13px] text-danger"
            role="alert"
            data-testid={`${testId}-error`}
          >
            {error}
          </p>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div>
          <span className={label}>Date</span>
          <DatePicker
            value={v.date}
            onChange={d => set({ date: d })}
            name="jamDate"
            id={`${testId}-date`}
            data-testid={`${testId}-date`}
          />
        </div>
        <div>
          <span className={label}>Start</span>
          <TimePickerDropdown
            value={v.time}
            onChange={t => set({ time: t })}
            name="jamTime"
            id={`${testId}-time`}
            data-testid={`${testId}-time`}
            placeholder="Start"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${testId}-where`} className={label}>
          Where · optional
        </label>
        <div className="flex items-center gap-3 h-12 px-4 rounded-2xl bg-bg-3">
          <MapPin size={18} className="text-ink-3 shrink-0" />
          <input
            id={`${testId}-where`}
            name="jamWhere"
            data-testid={`${testId}-where-input`}
            value={v.where}
            maxLength={120}
            onChange={e => set({ where: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && onSubmit()}
            placeholder="Lucky's Tavern"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-ink-1 outline-none placeholder:text-ink-4"
          />
        </div>
      </div>
    </div>
  )
}

/** ⋯ → Edit: name, date + start, where. */
export const JamEditSheet: React.FC<{
  jam: JamState['jam']
  saving: boolean
  onSave: (v: JamFormValue) => void
  onClose: () => void
}> = ({ jam, saving, onSave, onClose }) => {
  const [v, setV] = useState(() =>
    jamFormFrom(new Date(jam.scheduled_date), jam.name, jam.venue ?? '')
  )
  const [error, setError] = useState<string | null>(null)
  const save = () => {
    if (!v.name.trim()) return setError('Give the jam a name.')
    onSave(v)
  }
  return (
    <Sheet onClose={onClose} title="Edit jam" data-testid="jam-edit-sheet">
      <div className="pb-2">
        <JamFields
          value={v}
          onChange={setV}
          onSubmit={save}
          error={error}
          testId="jam-edit"
        />
        <div className="flex gap-2 pt-5">
          <Button
            size="lg"
            className="flex-1"
            onClick={onClose}
            data-testid="jam-edit-cancel"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            variant="primary"
            className="flex-1"
            disabled={saving}
            onClick={save}
            data-testid="jam-edit-save"
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
