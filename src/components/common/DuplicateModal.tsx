import { useState } from 'react'
import { SlideOutTray } from './SlideOutTray'
import { Dropdown, type DropdownGroup } from './Dropdown'
import { DatePicker } from './DatePicker'
import { TimePickerDropdown } from './TimePickerDropdown'
import {
  formatDateForInput,
  parseDateInputAsLocal,
  formatTime12Hour,
  parseTime12Hour,
} from '../../utils/dateHelpers'

/**
 * A prefilled, editable scalar field shown in the duplicate modal.
 * Collections (setlists, songs, contacts, lineups) are NOT edited here — they
 * are copied wholesale and shown as read-only summary lines; deep edits happen
 * on the detail page the user lands on after creating.
 */
export type DuplicateField =
  | {
      kind: 'text'
      key: string
      label: string
      value: string
      placeholder?: string
    }
  | {
      kind: 'number'
      key: string
      label: string
      value: number | undefined
      /** Suffix hint, e.g. "min" or "$". */
      suffix?: string
      placeholder?: string
    }
  | {
      kind: 'datetime'
      key: string
      label: string
      value: Date
      /** Required fields block submit when empty (used for the new date). */
      required?: boolean
    }
  | {
      kind: 'select'
      key: string
      label: string
      value: string
      options: { value: string; label: string }[]
    }
  | {
      kind: 'textarea'
      key: string
      label: string
      value: string
      placeholder?: string
    }

/** A read-only "this collection will be copied" summary line. */
export interface DuplicateSummary {
  key: string
  label: string
}

/**
 * An optional setlist selector (shows only). Lets the user fork the source
 * show's setlist, fork a different one, or start with none.
 */
export interface DuplicateSetlistSelector {
  /** Currently-selected setlist id, or '' for "none / create new". */
  value: string
  /** Available setlists to fork from. */
  options: { id: string; name: string }[]
  label?: string
}

export interface DuplicateModalResult {
  /** Edited scalar values, keyed by field key. Dates are Date objects. */
  values: Record<string, string | number | Date | undefined>
  /** Chosen setlist id ('' = none), when a selector was provided. */
  setlistId?: string
}

interface DuplicateModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** Short line under the title, e.g. "Creates a new show from this one." */
  description?: string
  fields: DuplicateField[]
  summaries?: DuplicateSummary[]
  setlist?: DuplicateSetlistSelector
  submitting?: boolean
  onSubmit: (result: DuplicateModalResult) => void
  'data-testid'?: string
}

const inputClass =
  'w-full rounded-lg bg-bg-3 border border-border-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none'

/**
 * Reusable "Duplicate <thing>" modal: prefilled, editable scalar inputs plus
 * read-only summaries of the collections that will be copied. Shared by shows
 * and practices (and future duplicable calendar items).
 */
export function DuplicateModal({
  isOpen,
  onClose,
  title,
  description,
  fields,
  summaries,
  setlist,
  submitting = false,
  onSubmit,
  'data-testid': testId = 'duplicate-modal',
}: DuplicateModalProps) {
  // Local editable copy of each field's value, keyed by field key.
  const [values, setValues] = useState<
    Record<string, string | number | Date | undefined>
  >(() => Object.fromEntries(fields.map(f => [f.key, f.value])))
  const [setlistId, setSetlistId] = useState(setlist?.value ?? '')

  const setValue = (key: string, v: string | number | Date | undefined) =>
    setValues(prev => ({ ...prev, [key]: v }))

  // Required datetime fields must have a value to submit.
  const missingRequired = fields.some(
    f => f.kind === 'datetime' && f.required && !values[f.key]
  )

  const setlistGroups: DropdownGroup[] = setlist
    ? [
        {
          options: [
            { value: '', label: 'No setlist' },
            ...setlist.options.map(o => ({ value: o.id, label: o.name })),
          ],
        },
      ]
    : []

  const handleSubmit = () => {
    if (missingRequired || submitting) return
    onSubmit({ values, setlistId: setlist ? setlistId : undefined })
  }

  return (
    <SlideOutTray
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      position="right"
      data-testid={testId}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        {description && <p className="text-sm text-ink-4">{description}</p>}

        {fields.map(field => (
          <div key={field.key}>
            <label
              htmlFor={`dup-${field.key}`}
              className="mb-1 block text-xs text-ink-4"
            >
              {field.label}
              {field.kind === 'datetime' && field.required && (
                <span className="ml-0.5 text-danger">*</span>
              )}
            </label>

            {field.kind === 'text' && (
              <input
                id={`dup-${field.key}`}
                name={field.key}
                data-testid={`dup-field-${field.key}`}
                value={(values[field.key] as string) ?? ''}
                placeholder={field.placeholder}
                onChange={e => setValue(field.key, e.target.value)}
                className={inputClass}
              />
            )}

            {field.kind === 'textarea' && (
              <textarea
                id={`dup-${field.key}`}
                name={field.key}
                data-testid={`dup-field-${field.key}`}
                value={(values[field.key] as string) ?? ''}
                placeholder={field.placeholder}
                onChange={e => setValue(field.key, e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            )}

            {field.kind === 'number' && (
              <div className="relative">
                <input
                  id={`dup-${field.key}`}
                  name={field.key}
                  type="number"
                  data-testid={`dup-field-${field.key}`}
                  value={
                    values[field.key] === undefined
                      ? ''
                      : (values[field.key] as number)
                  }
                  placeholder={field.placeholder}
                  onChange={e =>
                    setValue(
                      field.key,
                      e.target.value === '' ? undefined : Number(e.target.value)
                    )
                  }
                  className={inputClass}
                />
                {field.suffix && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-5">
                    {field.suffix}
                  </span>
                )}
              </div>
            )}

            {field.kind === 'datetime' && (
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[150px]">
                  <DatePicker
                    value={
                      values[field.key]
                        ? formatDateForInput(values[field.key] as Date)
                        : ''
                    }
                    onChange={dateStr => {
                      const picked = parseDateInputAsLocal(dateStr)
                      const cur = (values[field.key] as Date) ?? new Date()
                      picked.setHours(cur.getHours(), cur.getMinutes(), 0, 0)
                      setValue(field.key, picked)
                    }}
                    data-testid={`dup-field-${field.key}-date`}
                  />
                </div>
                <div className="w-[130px]">
                  <TimePickerDropdown
                    value={
                      values[field.key]
                        ? formatTime12Hour(values[field.key] as Date)
                        : ''
                    }
                    onChange={timeStr => {
                      const base = (values[field.key] as Date) ?? new Date()
                      const combined = parseTime12Hour(timeStr, base)
                      if (combined) setValue(field.key, combined)
                    }}
                    data-testid={`dup-field-${field.key}-time`}
                  />
                </div>
              </div>
            )}

            {field.kind === 'select' && (
              <select
                id={`dup-${field.key}`}
                name={field.key}
                data-testid={`dup-field-${field.key}`}
                value={(values[field.key] as string) ?? ''}
                onChange={e => setValue(field.key, e.target.value)}
                className={inputClass}
              >
                {field.options.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

        {setlist && (
          <div>
            <label className="mb-1 block text-xs text-ink-4">
              {setlist.label ?? 'Setlist'}
            </label>
            <Dropdown
              groups={setlistGroups}
              value={setlistId}
              onChange={setSetlistId}
              data-testid="dup-setlist-select"
            />
            {setlistId && (
              <p className="mt-1 text-xs text-ink-5">
                A copy of this setlist will be created for the new show.
              </p>
            )}
          </div>
        )}

        {summaries && summaries.length > 0 && (
          <div className="rounded-lg border border-border-1 bg-bg-1 p-3">
            <p className="mb-1.5 text-xs font-semibold text-ink-3">
              Also copied
            </p>
            <ul className="flex flex-col gap-1">
              {summaries.map(s => (
                <li
                  key={s.key}
                  data-testid={`dup-summary-${s.key}`}
                  className="text-xs text-ink-4"
                >
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            data-testid="duplicate-cancel"
            className="rounded-lg border border-border-1 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-border-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={missingRequired || submitting}
            data-testid="duplicate-submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity disabled:opacity-40"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </SlideOutTray>
  )
}
