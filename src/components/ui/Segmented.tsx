/**
 * Kit segmented control (`r-seg`).
 */

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  'data-testid'?: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  'data-testid': testId,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="flex h-11 p-[3px] rounded-full bg-bg-3"
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          data-testid={testId ? `${testId}-${opt.value}` : undefined}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-full px-3 text-sm font-bold whitespace-nowrap ${
            opt.value === value ? 'bg-ink-1 text-bg-1' : 'text-ink-3'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
