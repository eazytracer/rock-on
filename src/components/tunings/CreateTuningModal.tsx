import { useMemo, useState } from 'react'
import { X, Minus, Plus, Check } from 'lucide-react'
import { Dropdown, type DropdownOption } from '../common/Dropdown'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { TuningService } from '../../services/TuningService'
import { BUILTIN_TUNINGS, midiToNoteName } from '../../utils/tunings'
import type { Tuning } from '../../models/Tuning'

type Instrument = 'guitar' | 'bass'

const STRING_RANGE = { guitar: [3, 12] as const, bass: [3, 12] as const }
const DEFAULT_COUNT: Record<Instrument, number> = { guitar: 6, bass: 4 }

// Note picker options across a practical MIDI range (C1 → G4), low → high.
const NOTE_OPTIONS: DropdownOption[] = Array.from(
  { length: 67 - 24 + 1 },
  (_, i) => 24 + i
).map(midi => ({ value: String(midi), label: midiToNoteName(midi) }))

// Colour swatches (built-in tuning palette) + a neutral "none".
const SWATCHES = [
  '#60a5fa',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#14b8a6',
  '#0ea5e9',
  '#eab308',
  '#ec4899',
  '#10b981',
]

/** Sensible starting pitches for an instrument + string count, from the standards. */
function defaultPitchesFor(
  instrument: Instrument,
  stringCount: number
): number[] {
  const exact = BUILTIN_TUNINGS.filter(
    t => t.instrument === instrument && t.stringCount === stringCount
  )
  const std = exact.find(t => /standard/i.test(t.slug)) ?? exact[0]
  if (std) return [...std.pitches]
  // No exact match → grow/shrink from the base standard (add lower strings a 4th down).
  const base =
    BUILTIN_TUNINGS.find(
      t => t.instrument === instrument && /standard/i.test(t.slug)
    ) ?? BUILTIN_TUNINGS.find(t => t.instrument === instrument)
  const out = base ? [...base.pitches] : [40, 45, 50, 55, 59, 64]
  while (out.length < stringCount) out.unshift(out[0] - 5)
  while (out.length > stringCount) out.shift()
  return out.slice(0, stringCount)
}

interface CreateTuningModalProps {
  onClose: () => void
  onCreated: (tuning: Tuning) => void
  /** Preselect the instrument (e.g. from the song form). */
  instrument?: Instrument
}

/**
 * Create a custom (personal) tuning (fork #2). Instrument + string-count →
 * per-string note pickers prefilled from the matching standard; name required,
 * colour optional. Saves via the RLS-scoped TuningService as a personal tuning.
 */
export function CreateTuningModal({
  onClose,
  onCreated,
  instrument: initialInstrument = 'guitar',
}: CreateTuningModalProps) {
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const [instrument, setInstrument] = useState<Instrument>(initialInstrument)
  const [stringCount, setStringCount] = useState(
    DEFAULT_COUNT[initialInstrument]
  )
  const [pitches, setPitches] = useState<number[]>(() =>
    defaultPitchesFor(initialInstrument, DEFAULT_COUNT[initialInstrument])
  )
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [min, max] = STRING_RANGE[instrument]

  const noteGroups = useMemo(() => [{ options: NOTE_OPTIONS }], [])

  const changeInstrument = (next: Instrument) => {
    setInstrument(next)
    const count = DEFAULT_COUNT[next]
    setStringCount(count)
    setPitches(defaultPitchesFor(next, count))
  }

  const changeCount = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next))
    setStringCount(clamped)
    setPitches(defaultPitchesFor(instrument, clamped))
  }

  const setString = (index: number, midi: number) => {
    setPitches(prev => prev.map((p, i) => (i === index ? midi : p)))
  }

  const save = async () => {
    if (!name.trim()) return
    if (!currentUser?.id) {
      showToast('Sign in to create a tuning', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await TuningService.createCustomTuning(
        { instrument, stringCount, pitches, name: name.trim(), color },
        {
          contextType: 'personal',
          contextId: currentUser.id,
          createdBy: currentUser.id,
        }
      )
      showToast('Tuning created', 'success')
      onCreated(created)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not create tuning',
        'error'
      )
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-testid="create-tuning-modal"
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl bg-bg-1 border border-border-1 p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-1">New custom tuning</h2>
          <button
            onClick={onClose}
            data-testid="create-tuning-close"
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-4 hover:text-ink-1 hover:bg-bg-3"
          >
            <X size={18} />
          </button>
        </div>

        {/* Instrument segmented */}
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-4">
          Instrument
        </label>
        <div className="mb-4 inline-flex rounded-lg border border-border-1 bg-bg-2 p-0.5">
          {(['guitar', 'bass'] as Instrument[]).map(inst => (
            <button
              key={inst}
              onClick={() => changeInstrument(inst)}
              data-testid={`create-tuning-instrument-${inst}`}
              aria-pressed={instrument === inst}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                instrument === inst
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-4 hover:text-ink-2'
              }`}
            >
              {inst}
            </button>
          ))}
        </div>

        {/* String count stepper */}
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-4">
          Strings
        </label>
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => changeCount(stringCount - 1)}
            disabled={stringCount <= min}
            data-testid="create-tuning-strings-dec"
            aria-label="Fewer strings"
            className="rounded-lg border border-border-1 p-2 text-ink-3 hover:text-ink-1 hover:bg-bg-3 disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
          <span
            className="w-8 text-center text-lg font-bold text-ink-1"
            data-testid="create-tuning-strings-value"
          >
            {stringCount}
          </span>
          <button
            onClick={() => changeCount(stringCount + 1)}
            disabled={stringCount >= max}
            data-testid="create-tuning-strings-inc"
            aria-label="More strings"
            className="rounded-lg border border-border-1 p-2 text-ink-3 hover:text-ink-1 hover:bg-bg-3 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Per-string note pickers (low → high) */}
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-4">
          Notes (low → high)
        </label>
        <div
          className="mb-4 grid grid-cols-2 gap-2"
          data-testid="create-tuning-notes"
        >
          {pitches.map((pitch, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 flex-shrink-0 text-right font-mono text-[10px] text-ink-5">
                {i + 1}
              </span>
              <div className="flex-1">
                <Dropdown
                  value={String(pitch)}
                  onChange={v => setString(i, parseInt(v))}
                  groups={noteGroups}
                  data-testid={`create-tuning-note-${i}`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Name */}
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-4">
          Name <span className="text-accent">*</span>
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Drop A#"
          name="tuningName"
          id="create-tuning-name"
          data-testid="create-tuning-name"
          className="mb-4 w-full rounded-lg bg-bg-2 border border-border-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
        />

        {/* Colour (optional) */}
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-4">
          Colour <span className="text-ink-5">(optional)</span>
        </label>
        <div
          className="mb-5 flex flex-wrap items-center gap-2"
          data-testid="create-tuning-colors"
        >
          <button
            onClick={() => setColor(null)}
            aria-label="No colour"
            aria-pressed={color === null}
            className={`h-6 w-6 rounded-full border bg-bg-3 text-[9px] text-ink-5 ${
              color === null
                ? 'border-accent ring-2 ring-accent/30'
                : 'border-border-2'
            }`}
          >
            ○
          </button>
          {SWATCHES.map(sw => (
            <button
              key={sw}
              onClick={() => setColor(sw)}
              aria-label={`Colour ${sw}`}
              aria-pressed={color === sw}
              style={{ backgroundColor: sw }}
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                color === sw ? 'ring-2 ring-white/80' : ''
              }`}
            >
              {color === sw && <Check size={12} className="text-white" />}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-ink-3 hover:text-ink-1"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            data-testid="create-tuning-save"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create tuning
          </button>
        </div>
      </div>
    </div>
  )
}
