/**
 * The Markdown editor body: formatting bar (H, B, I, list), Write / Preview,
 * and a tall monospace textarea. ⌘↵ / Ctrl↵ = done, Esc = cancel. Used by
 * MarkdownField and the song page's notes (docs/redesign/10 · 1.4).
 */
import React, { useRef } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'

export interface MarkdownWriterProps {
  value: string
  onChange: (value: string) => void
  mode: 'write' | 'preview'
  onModeChange: (mode: 'write' | 'preview') => void
  onDone?: () => void
  onCancel?: () => void
  maxLength?: number
  rows?: number
  placeholder?: string
  /** Extra controls at the right end of the toolbar (MarkdownField's ✕ / ✓). */
  actions?: React.ReactNode
  tone?: 'accent' | 'info'
}

type Format = 'h' | 'b' | 'i' | 'list'

/** Applies a format to the selection; returns the new text and selection. */
function applyFormat(
  text: string,
  start: number,
  end: number,
  f: Format
): { text: string; start: number; end: number } {
  if (f === 'b' || f === 'i') {
    const mark = f === 'b' ? '**' : '*'
    const sel = text.slice(start, end) || (f === 'b' ? 'bold' : 'italic')
    const next = text.slice(0, start) + mark + sel + mark + text.slice(end)
    return {
      text: next,
      start: start + mark.length,
      end: start + mark.length + sel.length,
    }
  }
  // Line formats: prefix every selected line.
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const prefix = f === 'h' ? '## ' : '- '
  const block = text.slice(lineStart, end)
  const lines = block
    .split('\n')
    .map(l => (l.startsWith(prefix) ? l : prefix + l))
  const replaced = lines.join('\n')
  return {
    text: text.slice(0, lineStart) + replaced + text.slice(end),
    start: start + prefix.length,
    end: end + (replaced.length - block.length),
  }
}

const FORMATS: { f: Format; label: string; title: string; cls: string }[] = [
  { f: 'h', label: 'H', title: 'Heading', cls: 'font-bold' },
  { f: 'b', label: 'B', title: 'Bold', cls: 'font-bold' },
  { f: 'i', label: 'I', title: 'Italic', cls: 'italic font-serif' },
  { f: 'list', label: '•', title: 'List', cls: 'font-bold' },
]

export const MarkdownWriter: React.FC<MarkdownWriterProps> = ({
  value,
  onChange,
  mode,
  onModeChange,
  onDone,
  onCancel,
  maxLength = 10240,
  rows = 10,
  placeholder = 'Markdown supported: ##, **, lists, > quotes…',
  actions,
  tone = 'accent',
}) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  const ring = tone === 'info' ? 'focus:ring-info' : 'focus:ring-accent'

  const format = (f: Format) => {
    const el = ref.current
    if (!el) return
    const r = applyFormat(value, el.selectionStart, el.selectionEnd, f)
    if (r.text.length > maxLength) return
    onChange(r.text)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(r.start, r.end)
    })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onDone) {
      e.preventDefault()
      onDone()
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  }

  const tab = (m: 'write' | 'preview', label: string, testId: string) => (
    <button
      type="button"
      onClick={() => onModeChange(m)}
      aria-pressed={mode === m}
      className={`h-8 px-3 rounded-lg font-mono text-[12.5px] font-bold ${
        mode === m ? 'bg-bg-3 text-ink-1' : 'text-ink-3 hover:text-ink-1'
      }`}
      data-testid={testId}
    >
      {label}
    </button>
  )

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-1 mb-2 px-1 py-1 rounded-xl bg-bg-1">
        {mode === 'write' &&
          FORMATS.map(({ f, label, title, cls }, i) => (
            <React.Fragment key={f}>
              {i === 3 && <span className="w-px h-4 mx-1 bg-divider" />}
              <button
                type="button"
                title={title}
                aria-label={title}
                onMouseDown={e => e.preventDefault()}
                onClick={() => format(f)}
                className={`w-8 h-8 rounded-lg text-[13px] text-ink-2 hover:bg-bg-3 hover:text-ink-1 ${cls}`}
                data-testid={`markdown-format-${f}`}
              >
                {label}
              </button>
            </React.Fragment>
          ))}
        <span className="flex-1" />
        {tab('write', 'Write', 'markdown-mode-edit')}
        {tab('preview', 'Preview', 'markdown-mode-preview')}
        {actions}
      </div>

      {mode === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={e => {
            const v = e.target.value
            if (v.length <= maxLength) onChange(v)
          }}
          autoFocus
          rows={rows}
          placeholder={placeholder}
          data-testid="markdown-textarea"
          className={`w-full p-3.5 bg-bg-0 rounded-xl ring-2 ring-transparent text-ink-1 text-[14.5px] leading-relaxed font-mono resize-y focus:outline-none ${ring} custom-scrollbar-thin`}
        />
      ) : (
        <div className="min-h-[120px] p-3.5 bg-bg-0 rounded-xl">
          {value ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-ink-4 text-sm italic">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
