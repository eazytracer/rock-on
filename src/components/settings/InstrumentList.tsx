/**
 * Your instruments as an ordered list (Account and Settings 11): drag or
 * ↑ ↓ to reorder, × to remove, chips below to add, "Other" for anything else.
 * No primary flag; the first shows first where space is short.
 */
import React, { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react'
import { Group } from '../ui'
import { fieldInput } from './fields'

const COMMON = [
  'Guitar',
  'Vocals',
  'Bass',
  'Drums',
  'Keys',
  'Harmonica',
  'Mandolin',
  'Banjo',
  'Violin',
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const move = (list: string[], from: number, to: number) => {
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

export const InstrumentList: React.FC<{
  value: string[]
  onChange: (next: string[]) => void
}> = ({ value, onChange }) => {
  const [dragging, setDragging] = useState<number | null>(null)
  const [other, setOther] = useState<string | null>(null)
  const has = (n: string) =>
    value.some(v => v.toLowerCase() === n.trim().toLowerCase())
  const add = (n: string) => {
    const name = n.trim()
    if (name && !has(name)) onChange([...value, name])
  }
  const iconBtn =
    'grid place-items-center w-9 h-9 rounded-full text-ink-3 hover:bg-bg-3 hover:text-ink-1 disabled:opacity-30 disabled:pointer-events-none'

  return (
    <>
      <Group label="Instruments" data-testid="profile-instruments">
        {value.length === 0 && (
          <p className="px-4 py-4 text-[14px] text-ink-3">
            None yet. Add what you play below.
          </p>
        )}
        {value.map((name, i) => (
          <div
            key={name}
            draggable
            onDragStart={() => setDragging(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (dragging !== null && dragging !== i)
                onChange(move(value, dragging, i))
              setDragging(null)
            }}
            onDragEnd={() => setDragging(null)}
            className={`flex items-center gap-2 min-h-14 pl-2 pr-1.5 ${
              dragging === i ? 'opacity-50' : ''
            }`}
            data-testid={`profile-instrument-row-${i}`}
          >
            <GripVertical
              size={18}
              className="text-ink-4 cursor-grab shrink-0"
              aria-hidden
            />
            <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-ink-1">
              {name}
            </span>
            <button
              type="button"
              className={iconBtn}
              disabled={i === 0}
              onClick={() => onChange(move(value, i, i - 1))}
              aria-label={`Move ${name} up`}
              data-testid={`profile-instrument-up-${i}`}
            >
              <ChevronUp size={18} />
            </button>
            <button
              type="button"
              className={iconBtn}
              disabled={i === value.length - 1}
              onClick={() => onChange(move(value, i, i + 1))}
              aria-label={`Move ${name} down`}
              data-testid={`profile-instrument-down-${i}`}
            >
              <ChevronDown size={18} />
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Remove ${name}`}
              data-testid={`profile-instrument-remove-${i}`}
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </Group>
      <Group label="Add">
        <div className="flex flex-wrap gap-2 p-3">
          {COMMON.filter(n => !has(n)).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => add(n)}
              className="h-10 px-3.5 rounded-full bg-bg-3 text-[14px] font-semibold text-ink-1 hover:bg-bg-4"
              data-testid={`profile-instrument-add-${slug(n)}`}
            >
              {n}
            </button>
          ))}
          {other === null ? (
            <button
              type="button"
              onClick={() => setOther('')}
              className="h-10 px-3.5 rounded-full text-[14px] font-semibold text-ink-3 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))] inline-flex items-center gap-1"
              data-testid="profile-instrument-other-button"
            >
              <Plus size={15} />
              Other
            </button>
          ) : (
            <form
              className="flex w-full gap-2"
              onSubmit={e => {
                e.preventDefault()
                add(other)
                setOther(null)
              }}
            >
              <label htmlFor="profile-instrument-other" className="sr-only">
                Other instrument
              </label>
              <input
                id="profile-instrument-other"
                name="otherInstrument"
                data-testid="profile-instrument-other-input"
                value={other}
                onChange={e => setOther(e.target.value)}
                maxLength={40}
                autoFocus
                placeholder="Cello, pedal steel…"
                className={`${fieldInput} flex-1`}
              />
              <button
                type="submit"
                disabled={!other.trim() || has(other)}
                className="h-11 px-4 rounded-full bg-accent text-on-accent font-bold disabled:opacity-40"
                data-testid="profile-instrument-other-add"
              >
                Add
              </button>
            </form>
          )}
        </div>
      </Group>
    </>
  )
}
