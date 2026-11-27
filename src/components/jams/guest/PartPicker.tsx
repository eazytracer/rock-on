/**
 * The multi-select part chips for join, web guest and kiosk: the base parts,
 * the jam's custom parts, "Other" to type one in, and optionally "Just
 * listening" (no parts). `size="xl"` is the kiosk's 64 px targets.
 */
import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Part } from '../../../services/api/jams'
import { partId, partLabel, partOptions, samePart } from './parts'

export const PartPicker: React.FC<{
  value: Part[]
  onChange: (next: Part[]) => void
  /** The jam's default parts (custom ones such as Harmonica are offered). */
  jamParts?: Part[]
  listening?: boolean
  size?: 'md' | 'xl'
  testid: string
}> = ({ value, onChange, jamParts, listening, size = 'md', testid }) => {
  const [other, setOther] = useState<string | null>(null)
  const options = partOptions(jamParts, value)
  const on = (p: Part) => value.some(v => samePart(v, p))
  const toggle = (p: Part) =>
    onChange(on(p) ? value.filter(v => !samePart(v, p)) : [...value, p])
  const addOther = () => {
    const label = (other ?? '').trim().slice(0, 30)
    if (label) {
      const p: Part = { key: 'other', label }
      if (!on(p)) onChange([...value, p])
    }
    setOther(null)
  }
  const chip = `inline-flex items-center gap-2 rounded-full font-semibold whitespace-nowrap ${
    size === 'xl' ? 'h-16 px-7 text-[22px]' : 'h-11 px-4 text-[15px]'
  }`
  const look = (active: boolean) =>
    active
      ? 'bg-ink-1 text-bg-1'
      : 'text-ink-2 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'

  return (
    <div className="flex flex-wrap gap-2" data-testid={testid}>
      {options.map(p => (
        <button
          key={partId(p)}
          type="button"
          aria-pressed={on(p)}
          onClick={() => toggle(p)}
          className={`${chip} ${look(on(p))}`}
          data-testid={`${testid}-${p.key}${p.label ? `-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''}`}
        >
          {partLabel(p)}
        </button>
      ))}
      {other === null ? (
        <button
          type="button"
          onClick={() => setOther('')}
          className={`${chip} ${look(false)}`}
          data-testid={`${testid}-other`}
        >
          <Plus size={size === 'xl' ? 22 : 16} />
          Other
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <label htmlFor={`${testid}-other-input`} className="sr-only">
            Other part
          </label>
          <input
            id={`${testid}-other-input`}
            name="otherPart"
            data-testid={`${testid}-other-input`}
            autoFocus
            maxLength={30}
            value={other}
            onChange={e => setOther(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOther()
              }
              if (e.key === 'Escape') setOther(null)
            }}
            onBlur={addOther}
            placeholder="Harmonica"
            className={`${chip} w-40 bg-bg-3 text-ink-1 outline-none placeholder:text-ink-4 focus:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]`}
          />
        </span>
      )}
      {listening && (
        <button
          type="button"
          aria-pressed={value.length === 0}
          onClick={() => onChange([])}
          className={`${chip} ${look(value.length === 0)}`}
          data-testid={`${testid}-listening`}
        >
          Just listening
        </button>
      )}
    </div>
  )
}
