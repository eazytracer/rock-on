/**
 * Custom tuning editor, style B "neck" (design/demo/screens/Custom Tuning.html;
 * DECISIONS · Custom tuning; docs/redesign/12 · 2.4, 5g). Vertical strings
 * under an orange nut, low string left, drawn at their gauge; ↑ / ↓ per string
 * (silent, −12 … +7 from standard, the arrow dims at the limit); tap a note to
 * pluck it; the goal-post frame comes down to ↓ ½ step ↑ for every string.
 *
 * Opens in place (no route): a full-screen layer on phones, a centred panel on
 * desktop (decision 11). New tunings start at the instrument's standard; an
 * existing custom tuning opens with its strings (instrument and count stay).
 * Save is grey until there's a name and the strings don't match a built-in or
 * a custom tuning in this context.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useTunings } from '../../hooks/useTunings'
import { useMediaQuery } from '../../hooks/useResponsive'
import { queryKeys } from '../../services/queryClient'
import { createTuning, updateTuning } from '../../services/api/tunings'
import { errorText } from '../../services/api/errors'
import { pluck } from '../../services/audio/synth'
import { Button, Segmented, Sheet } from '../ui'
import { noteLetter, noteOctave } from '../../domain/notes'
import { showKey } from '../../domain/format'
import {
  STRING_COUNTS,
  TUNING_SWATCHES,
  autoColour,
  canStep,
  canStepAll,
  firstFreeSwatch,
  matchTuning,
  standardFor,
  stepAll,
  stepString,
  stringWidths,
  themedSwatch,
  type TuningInstrument,
} from '../../domain/tuningEdit'
import { BUILTIN_TUNINGS } from '../../utils/tunings'
import { createLogger } from '../../utils/logger'
import type { Tuning } from '../../models/Tuning'

const log = createLogger('TuningEditor')

const NAME_MAX = 24

export interface TuningEditorProps {
  onClose: () => void
  /** Called with the saved tuning (new or edited). */
  onSaved: (tuning: Tuning) => void
  /** A new tuning's starting instrument. */
  instrument?: TuningInstrument
  /** Edit this custom tuning instead of making a new one. */
  tuning?: Tuning | null
  /** Where a new tuning lives (default: the current band, or Personal). */
  context?: { type: 'personal' | 'band'; id: string } | null
}

interface Candidate {
  key: string
  name: string
  instrument: TuningInstrument
  pitches: readonly number[]
}

/** One 320 ms orange fade on the pressed stepper (DECISIONS · press feedback). */
const flash = (el: HTMLElement) =>
  el.animate?.(
    [
      {
        background: 'var(--accent)',
        color: 'rgb(var(--on-accent-rgb, 17 17 17))',
      },
      {},
    ],
    { duration: 320, easing: 'ease-out' }
  )

const Stepper: React.FC<{
  dir: 'up' | 'down'
  disabled: boolean
  onStep: () => void
  label: string
  wide?: boolean
  /** 8 strings on a phone: a smaller round button. */
  small?: boolean
  'data-testid': string
}> = ({ dir, disabled, onStep, label, wide, small, 'data-testid': testId }) => {
  const Icon = dir === 'up' ? ChevronUp : ChevronDown
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={e => {
        flash(e.currentTarget)
        onStep()
      }}
      className={`relative z-[1] grid place-items-center text-ink-1 disabled:opacity-30 ${
        wide
          ? 'w-16 h-[52px] rounded-full bg-bg-2 shadow-[0_0_0_6px_var(--bg-1)]'
          : small
            ? 'w-9 h-9 rounded-full bg-bg-4'
            : 'w-11 h-11 rounded-full bg-bg-4'
      }`}
      data-testid={testId}
    >
      <Icon size={small ? 18 : 22} strokeWidth={2.4} />
    </button>
  )
}

export const TuningEditor: React.FC<TuningEditorProps> = ({
  onClose,
  onSaved,
  instrument: startInstrument = 'guitar',
  tuning: editing = null,
  context,
}) => {
  const desktop = useMediaQuery('(min-width: 768px)')
  const { currentBandId, currentUser } = useAuth()
  const { showToast } = useToast()
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'light' ? 'light' : 'dark'
  const queryClient = useQueryClient()
  const { customs } = useTunings()

  const ctx = useMemo(
    () =>
      editing?.contextType && editing.contextId
        ? { type: editing.contextType, id: editing.contextId }
        : (context ??
          (currentBandId
            ? { type: 'band' as const, id: currentBandId }
            : { type: 'personal' as const, id: currentUser?.id ?? '' })),
    [editing, context, currentBandId, currentUser?.id]
  )
  const ctxCustoms = useMemo(
    () =>
      customs.filter(t => t.contextType === ctx.type && t.contextId === ctx.id),
    [customs, ctx]
  )

  const [instrument, setInstrument] = useState<TuningInstrument>(
    editing?.instrument ?? startInstrument
  )
  const [count, setCount] = useState(
    editing?.stringCount ?? STRING_COUNTS[startInstrument][0]
  )
  const std = useMemo(
    () => standardFor(instrument, count) ?? [],
    [instrument, count]
  )
  const [pitches, setPitches] = useState<readonly number[]>(
    () => editing?.pitches ?? std
  )
  const [name, setName] = useState(editing?.name ?? '')
  // null = automatic (from pitch). A new tuning opens on a free swatch.
  const [color, setColor] = useState<string | null>(() =>
    editing
      ? (editing.color ?? null)
      : firstFreeSwatch(
          customs
            .filter(t => t.contextType === ctx.type && t.contextId === ctx.id)
            .map(t => t.color)
        )
  )
  const [colourSheet, setColourSheet] = useState(false)
  const [saving, setSaving] = useState(false)

  // Esc closes (the colour sheet handles its own).
  useEffect(() => {
    if (colourSheet) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [colourSheet, onClose])

  const candidates: Candidate[] = useMemo(
    () => [
      ...BUILTIN_TUNINGS.map(t => ({
        key: t.slug,
        name: t.name,
        instrument: t.instrument,
        pitches: t.pitches,
      })),
      ...ctxCustoms
        .filter(t => t.id !== editing?.id)
        .map(t => ({
          key: t.id,
          name: t.name,
          instrument: t.instrument,
          pitches: t.pitches,
        })),
    ],
    [ctxCustoms, editing?.id]
  )
  const duplicate = matchTuning(pitches, instrument, candidates)
  const unchanged =
    !!editing &&
    editing.name === name.trim() &&
    (editing.color ?? null) === color &&
    editing.pitches.every((p, i) => p === pitches[i])
  const canSave = !!name.trim() && !duplicate && !saving && !unchanged
  // Why Save is grey: shown when it's tapped (or the alert icon is), so the
  // editor never grows a warning that pushes the steppers around.
  const blocked = duplicate
    ? `That's ${duplicate.name}. It's already in your tunings. Change a string to make a new one.`
    : !name.trim()
      ? 'Give the tuning a name first.'
      : unchanged
        ? 'No changes to save yet.'
        : null

  const auto = autoColour(pitches, std)
  const shown = color ? themedSwatch(color, theme) : auto[theme]

  const reset = (inst: TuningInstrument, n: number) => {
    setInstrument(inst)
    setCount(n)
    setPitches(standardFor(inst, n) ?? [])
  }

  const save = async () => {
    if (saving) return
    if (!canSave) {
      if (blocked) showToast(blocked, 'info')
      return
    }
    if (!ctx.id) {
      showToast('Sign in to save a tuning', 'error')
      return
    }
    setSaving(true)
    try {
      const saved = editing
        ? await updateTuning(editing.id, {
            name: name.trim(),
            pitches: [...pitches],
            color,
          })
        : await createTuning({
            name: name.trim(),
            instrument,
            stringCount: count,
            pitches: [...pitches],
            contextType: ctx.type,
            contextId: ctx.id,
            color,
          })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tunings.all(currentUser?.id ?? ''),
      })
      showToast(editing ? 'Tuning saved' : 'Tuning created', 'success')
      onSaved(saved)
    } catch (err) {
      log.error('Saving the tuning failed', err)
      showToast(errorText(err), 'error')
      setSaving(false)
    }
  }

  const widths = stringWidths(instrument, count)
  const tight = count >= 7
  const crowded = count >= 8 && !desktop
  const stringNo = (i: number) => pitches.length - i
  const noteText = (m: number) => `${noteLetter(m)}${noteOctave(m)}`

  const nameField = (
    <div className="rounded-[18px] bg-bg-2 shadow-group">
      <label
        htmlFor="tuning-name"
        className="flex items-center gap-3 min-h-[60px] px-4 py-2 rounded-[18px] cursor-text focus-within:shadow-[inset_0_0_0_2px_var(--accent)]"
      >
        <span className="flex-1 min-w-0">
          <span className="block font-mono text-[10px] tracking-[.08em] uppercase text-ink-3 mb-0.5">
            Name
            <em className="not-italic text-accent-ink ml-1.5 text-[9.5px]">
              Required
            </em>
          </span>
          <input
            id="tuning-name"
            name="tuningName"
            data-testid="tuning-name-input"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="off"
            placeholder="Open C, DADGAD…"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void save()}
            className="w-full bg-transparent text-[17px] font-semibold text-ink-1 placeholder-ink-4 focus:outline-none"
          />
        </span>
        <button
          type="button"
          onClick={e => {
            e.preventDefault()
            setColourSheet(true)
          }}
          aria-label="Tuning colour"
          className="w-8 h-8 rounded-full shrink-0 shadow-[0_0_0_3px_var(--bg-2),0_0_0_4.5px_rgb(var(--border-1-rgb))]"
          style={{ background: shown }}
          data-testid="tuning-colour"
          data-colour={color ?? 'auto'}
        />
      </label>
    </div>
  )

  const neck = (
    <div className="relative mx-1">
      {/* The goal-post frame: down both sides and along the bottom. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[34px] bottom-[26px] rounded-b-[22px] border-2 border-t-0 border-border-1"
      />
      <div
        className="relative mx-2.5 rounded-[24px] bg-bg-2 shadow-group overflow-hidden grid px-1.5 pb-3.5"
        style={{
          gridTemplateColumns: `repeat(${pitches.length}, minmax(0, 1fr))`,
        }}
        data-testid="tuning-neck"
      >
        <span
          aria-hidden
          className="col-span-full h-3 -mx-1.5 mb-2 rounded-b bg-accent"
        />
        {pitches.map((m, i) => (
          <div
            key={i}
            className={`relative flex flex-col items-center py-2.5 ${tight ? 'gap-3' : 'gap-4'}`}
          >
            <span
              aria-hidden
              className="absolute -top-2 -bottom-3.5 left-1/2 -translate-x-1/2 bg-ink-4 opacity-45"
              style={{ width: widths[i] }}
            />
            <Stepper
              dir="up"
              disabled={!canStep(pitches, std, i, 1)}
              onStep={() => setPitches(p => stepString(p, std, i, 1))}
              small={crowded}
              label={`String ${stringNo(i)} up a half step`}
              data-testid={`tuning-string-${stringNo(i)}-up`}
            />
            <button
              type="button"
              onClick={() => pluck(m)}
              aria-label={`String ${stringNo(i)}, ${noteText(m)}. Play`}
              className={`relative z-[1] w-[calc(100%-8px)] max-w-[52px] rounded-2xl bg-bg-3 flex flex-col items-center justify-center shadow-[0_0_0_3px_var(--bg-2)] active:scale-[.94] ${tight ? 'h-[84px]' : 'h-24'}`}
              data-testid={`tuning-string-${stringNo(i)}-note`}
              data-note={noteText(m)}
            >
              <b
                className={`font-display font-extrabold leading-none text-ink-1 ${crowded ? 'text-[23px]' : tight ? 'text-[28px]' : 'text-[34px]'}`}
              >
                {noteLetter(m)[0]}
                {noteLetter(m).length > 1 && (
                  <span className="text-[.6em] align-top">
                    {showKey(noteLetter(m)).slice(1)}
                  </span>
                )}
              </b>
              <small className="font-mono text-[10px] text-ink-3">
                {noteOctave(m)}
              </small>
            </button>
            <Stepper
              dir="down"
              disabled={!canStep(pitches, std, i, -1)}
              onStep={() => setPitches(p => stepString(p, std, i, -1))}
              small={crowded}
              label={`String ${stringNo(i)} down a half step`}
              data-testid={`tuning-string-${stringNo(i)}-down`}
            />
            <span className="relative z-[1] font-mono text-[10px] text-ink-3 bg-bg-2 px-1 rounded">
              {stringNo(i)}
            </span>
          </div>
        ))}
      </div>
      <div className="relative flex items-center justify-center gap-2.5 mt-3.5">
        <Stepper
          dir="down"
          wide
          disabled={!canStepAll(pitches, std, -1)}
          onStep={() => setPitches(p => stepAll(p, std, -1))}
          label="All strings down a half step"
          data-testid="tuning-all-down"
        />
        <b className="relative z-[1] px-2.5 bg-bg-1 text-[18px] font-bold text-ink-1">
          ½ step
        </b>
        <Stepper
          dir="up"
          wide
          disabled={!canStepAll(pitches, std, 1)}
          onStep={() => setPitches(p => stepAll(p, std, 1))}
          label="All strings up a half step"
          data-testid="tuning-all-up"
        />
      </div>
    </div>
  )

  const body = (
    <div className="flex flex-col gap-3.5 py-2">
      <div className="flex flex-col gap-1.5">
        {nameField}
        <p
          className={`flex items-center justify-center gap-1.5 font-mono text-[11px] tracking-[.06em] uppercase ${duplicate ? 'text-warn' : 'text-ink-3'}`}
          data-testid="tuning-strings-line"
        >
          {duplicate && (
            <button
              type="button"
              onClick={() => blocked && showToast(blocked, 'info')}
              aria-label={`Same as ${duplicate.name}, already in your tunings`}
              className="-my-1 p-1 rounded-full"
              data-testid="tuning-duplicate"
              data-match={duplicate.name}
            >
              <AlertTriangle size={14} />
            </button>
          )}
          {pitches.map(m => showKey(noteLetter(m))).join(' ')} · low to high
        </p>
        <p className="text-center text-[12.5px] text-ink-3">
          Tap a note to hear it
        </p>
      </div>

      {editing ? (
        <p
          className="text-center font-mono text-[11px] tracking-[.06em] uppercase text-ink-3"
          data-testid="tuning-instrument"
        >
          {instrument === 'bass' ? 'Bass' : 'Guitar'} · {count} strings
        </p>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1">
            <Segmented
              label="Instrument"
              options={[
                { value: 'guitar', label: 'Guitar' },
                { value: 'bass', label: 'Bass' },
              ]}
              value={instrument}
              onChange={v => v !== instrument && reset(v, STRING_COUNTS[v][0])}
              data-testid="tuning-instrument"
            />
          </div>
          <div className="w-[150px]">
            <Segmented
              label="Strings"
              options={STRING_COUNTS[instrument].map(n => ({
                value: String(n),
                label: String(n),
              }))}
              value={String(count)}
              onChange={v =>
                Number(v) !== count && reset(instrument, Number(v))
              }
              data-testid="tuning-count"
            />
          </div>
        </div>
      )}

      {neck}
    </div>
  )

  const bar = (
    <div className="flex items-center justify-between gap-2 px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2.5 shrink-0">
      <Button
        variant="text"
        onClick={onClose}
        data-testid="tuning-cancel"
        className="min-w-[64px] justify-start"
      >
        Cancel
      </Button>
      <h2 className="text-[17px] font-bold text-ink-1 truncate">
        {editing ? 'Edit tuning' : 'New tuning'}
      </h2>
      <Button
        variant={canSave ? 'primary' : 'secondary'}
        aria-disabled={!canSave}
        onClick={() => void save()}
        data-testid="tuning-save"
        className="min-w-[64px] aria-disabled:opacity-40"
      >
        Save
      </Button>
    </div>
  )

  const sheet = colourSheet && (
    <Sheet
      onClose={() => setColourSheet(false)}
      title="Tuning colour"
      sub="Shows on this tuning's pill everywhere"
      data-testid="tuning-colour-sheet"
    >
      <button
        type="button"
        onClick={() => setColor(null)}
        className="w-full flex items-center gap-3 min-h-[60px] px-1 mb-3 border-b border-divider text-left"
        aria-pressed={color === null}
        data-testid="tuning-colour-auto"
      >
        <span
          className={`w-[22px] h-[22px] rounded-full shrink-0 grid place-items-center shadow-[inset_0_0_0_2px_rgb(var(--border-1-rgb))] ${color === null ? 'shadow-[inset_0_0_0_7px_var(--accent)]' : ''}`}
        />
        <span className="flex-1 min-w-0">
          <b className="block text-[15px] text-ink-1">Automatic</b>
          <small className="text-[12.5px] text-ink-3">
            From pitch: lower tunings warmer
          </small>
        </span>
        <i
          className="w-8 h-8 rounded-full block"
          style={{ background: auto[theme] }}
        />
      </button>
      <p className="font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 mx-1 mb-2">
        Or pick one
      </p>
      <div className="grid grid-cols-6 gap-2.5 mb-4">
        {TUNING_SWATCHES.map((s, i) => {
          const on = color === s.dark
          return (
            <button
              key={s.dark}
              type="button"
              onClick={() => setColor(s.dark)}
              aria-label={`Colour ${i + 1}`}
              aria-pressed={on}
              className={`aspect-square rounded-full grid place-items-center ${on ? 'shadow-[0_0_0_2px_var(--bg-2),0_0_0_4px_rgb(var(--ink-1-rgb))]' : ''}`}
              style={{ background: s[theme] }}
              data-testid={`tuning-swatch-${i}`}
            >
              {on && (
                <Check
                  size={20}
                  strokeWidth={3}
                  className={theme === 'light' ? 'text-white' : 'text-[#111]'}
                />
              )}
            </button>
          )
        })}
      </div>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => setColourSheet(false)}
        data-testid="tuning-colour-done"
      >
        Done
      </Button>
    </Sheet>
  )

  if (desktop)
    return (
      <div
        className="fixed inset-0 z-[59] bg-black/60 grid place-items-center p-6"
        onMouseDown={e => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing ? 'Edit tuning' : 'New tuning'}
          className="w-full max-w-[520px] max-h-[calc(100vh-48px)] flex flex-col rounded-[28px] bg-bg-1 shadow-float ring-1 ring-border-1"
          data-testid="tuning-editor"
        >
          {bar}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 pb-6">
            {body}
          </div>
        </div>
        {sheet}
      </div>
    )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editing ? 'Edit tuning' : 'New tuning'}
      className="fixed inset-0 z-[59] bg-bg-1 flex flex-col"
      data-testid="tuning-editor"
    >
      {bar}
      {/* Shorter than the screen → centred (DECISIONS · layout rule). */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="my-auto">{body}</div>
      </div>
      {sheet}
    </div>
  )
}
