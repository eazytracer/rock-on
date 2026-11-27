/**
 * Band mark picker (Band Identity 2; decision 9): Initials | Symbol, then a
 * colour, previewed at the sizes the mark appears. Upload waits. `MarkEditor`
 * is the body (desktop create shows it in its side pane); `BandMarkPicker`
 * puts it in a sheet with Cancel / Use this.
 */
import React, { useEffect, useState } from 'react'
import { Segmented } from '../ui/Segmented'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { BandMark } from '../ui/BandMark'
import {
  MARK_COLORS,
  MARK_LETTERINGS,
  MARK_SYMBOLS,
  loadLetteringFonts,
  markColor,
  type BandMarkValue,
} from '../ui/bandMarkPalette'
import { markInitials } from '../../domain/marks'

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 mx-0.5 mt-1 mb-2">
    {children}
  </div>
)

export const MarkEditor: React.FC<{
  name: string
  value: BandMarkValue
  onChange: (mark: BandMarkValue) => void
}> = ({ name, value, onChange }) => {
  useEffect(() => loadLetteringFonts(MARK_LETTERINGS.map(l => l.key)), [])
  const set = (patch: Partial<BandMarkValue>) =>
    onChange({ ...value, ...patch })
  const initials = value.initials ?? markInitials(name).toUpperCase()

  return (
    <div data-testid="band-mark-editor">
      <div className="flex flex-col items-center gap-3.5 pt-1 pb-4">
        <BandMark
          name={name}
          mark={value}
          size={120}
          data-testid="band-mark-preview"
        />
        <div className="flex items-center gap-[18px] font-mono text-[10px] tracking-[.06em] text-ink-3">
          {[
            [40, 'SWITCHER'],
            [32, 'NOTIFICATION'],
            [22, 'NAV'],
          ].map(([size, label]) => (
            <span key={label} className="flex flex-col items-center gap-1.5">
              <BandMark name={name} mark={value} size={size as number} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="pb-3.5">
        <Segmented
          label="Mark type"
          options={[
            { value: 'initials', label: 'Initials' },
            { value: 'symbol', label: 'Symbol' },
          ]}
          value={value.kind}
          onChange={kind =>
            set({
              kind,
              symbol:
                kind === 'symbol' ? (value.symbol ?? 'guitar') : value.symbol,
            })
          }
          data-testid="band-mark-kind"
        />
      </div>

      {value.kind === 'initials' ? (
        <div className="pb-3.5">
          <label
            htmlFor="band-mark-initials"
            className="flex items-center gap-2.5 h-12 rounded-[14px] bg-bg-3 px-3.5 mb-2.5"
          >
            <span className="font-mono text-[10px] tracking-[.08em] text-ink-3">
              INITIALS
            </span>
            <input
              id="band-mark-initials"
              name="markInitials"
              data-testid="band-mark-initials-input"
              value={initials}
              maxLength={3}
              onChange={e =>
                set({
                  initials: e.target.value.replace(/\s/g, '').toUpperCase(),
                })
              }
              className="flex-1 min-w-0 bg-transparent text-[17px] font-bold text-ink-1 outline-none"
            />
            <span className="text-[12px] text-ink-3">1–3 characters</span>
          </label>
          <Label>Lettering</Label>
          <div className="grid grid-cols-4 gap-2">
            {MARK_LETTERINGS.map(l => {
              const on = (value.lettering ?? 'poster') === l.key
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => set({ lettering: l.key })}
                  aria-pressed={on}
                  data-testid={`band-mark-lettering-${l.key}`}
                  className={`h-[68px] rounded-[14px] bg-bg-3 flex flex-col items-center justify-center gap-1 ${
                    on ? 'shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]' : ''
                  }`}
                >
                  <span
                    className="leading-none text-ink-1"
                    style={{
                      fontFamily: l.family,
                      fontWeight: l.weight,
                      fontSize: Math.round(26 * l.scale),
                      textTransform: l.upper ? 'uppercase' : undefined,
                    }}
                  >
                    {initials || 'Aa'}
                  </span>
                  <small className="text-[10.5px] font-semibold text-ink-3">
                    {l.label}
                  </small>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="pb-3.5">
          <Label>Symbol</Label>
          <div className="grid grid-cols-6 gap-2">
            {MARK_SYMBOLS.map(s => {
              const on = value.symbol === s.key
              const Icon = s.icon
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => set({ symbol: s.key })}
                  aria-pressed={on}
                  aria-label={s.label}
                  title={s.label}
                  data-testid={`band-mark-symbol-${s.key}`}
                  className={`aspect-square rounded-[14px] bg-bg-3 grid place-items-center text-ink-1 ${
                    on ? 'shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]' : ''
                  }`}
                >
                  <Icon size={22} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Label>Colour</Label>
      <div className="grid grid-cols-8 gap-2 pb-2">
        {MARK_COLORS.map(c => {
          const on = markColor(value.color).key === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => set({ color: c.key })}
              aria-pressed={on}
              aria-label={c.label}
              title={c.label}
              data-testid={`band-mark-color-${c.key}`}
              className="aspect-square rounded-xl"
              style={{
                background: c.bg,
                boxShadow: on
                  ? '0 0 0 2px var(--bg-2), 0 0 0 4px var(--ink-1)'
                  : 'inset 0 0 0 1px rgba(128,128,128,.25)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export const BandMarkPicker: React.FC<{
  name: string
  value: BandMarkValue
  onClose: () => void
  onSave: (mark: BandMarkValue) => void
  saving?: boolean
}> = ({ name, value, onClose, onSave, saving }) => {
  const [draft, setDraft] = useState(value)
  return (
    <Sheet onClose={onClose} title="Band mark" data-testid="band-mark-picker">
      <MarkEditor name={name} value={draft} onChange={setDraft} />
      <div className="flex gap-2 pt-3 pb-1 md:pb-5">
        <Button
          size="lg"
          className="flex-1"
          onClick={onClose}
          data-testid="band-mark-cancel"
        >
          Cancel
        </Button>
        <Button
          size="lg"
          variant="primary"
          className="flex-1"
          disabled={saving}
          onClick={() => onSave(draft)}
          data-testid="band-mark-save"
        >
          Use this
        </Button>
      </div>
    </Sheet>
  )
}
