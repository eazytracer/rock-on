/**
 * Kit switch (`r-sw`): 50 × 30.
 */
import React from 'react'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  'data-testid'?: string
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled,
  'data-testid': testId,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    data-testid={testId}
    onClick={() => onChange(!checked)}
    className={`relative w-[50px] h-[30px] rounded-full shrink-0 transition-colors duration-200 ease-rock disabled:opacity-40 ${
      checked ? 'bg-accent' : 'bg-border-1'
    }`}
  >
    <span
      className={`absolute left-[3px] top-[3px] w-6 h-6 rounded-full transition-transform duration-200 ease-rock ${
        checked ? 'translate-x-5 bg-on-accent' : 'bg-ink-1'
      }`}
    />
  </button>
)
