/**
 * MarkdownFieldPreview — demo of the proposed <MarkdownField> UX.
 *
 * Idle state: rendered markdown with a pencil icon overlay.
 * Active state: textarea + Edit/Preview toggle + check (save) / X (cancel).
 * Save happens on click-out of the field OR on check click.
 * Unsaved changes on cancel trigger the blocking confirm dialog.
 */

import React, { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X, Eye, Edit3 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ---- Inline MarkdownRenderer (modernized palette — no legacy tokens) ----

const PreviewRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) {
    return (
      <p className="text-ink-5 text-sm italic">Nothing to preview yet...</p>
    )
  }
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mb-3 mt-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-white mb-2 mt-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-white mb-2 mt-3">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-ink-2 mb-3 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-ink-2 mb-3 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-ink-2 mb-3 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-ink-2">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline hover:text-accent-hot"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isInline = !className
            if (isInline) {
              return (
                <code className="bg-bg-3 text-[#fbbf24] px-1.5 py-0.5 rounded text-sm">
                  {children}
                </code>
              )
            }
            return (
              <code className="block bg-bg-3 text-ink-2 p-3 rounded-lg text-sm overflow-x-auto mb-3">
                {children}
              </code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-accent pl-4 italic text-ink-3 my-3">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-ink-2">{children}</em>
          ),
          hr: () => <hr className="border-t border-border-1 my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ---- MarkdownField — the proposed component ----

interface MarkdownFieldProps {
  value: string
  onSave: (newValue: string) => void
  placeholder?: string
  label?: string
}

const MarkdownField: React.FC<MarkdownFieldProps> = ({
  value,
  onSave,
  placeholder = 'Click the pencil icon to add notes...',
  label,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const savedTimerRef = useRef<number | null>(null)

  const isDirty = draft !== value

  const flashSaved = () => {
    setJustSaved(true)
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 1800)
  }

  // Clean up timer on unmount
  useEffect(
    () => () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    },
    []
  )

  // Click-outside to save (with visible confirmation flash)
  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (isDirty) {
          onSave(draft)
          flashSaved()
        }
        setIsEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEditing, isDirty, draft, onSave])

  const handleStartEdit = () => {
    setDraft(value)
    setEditorMode('edit')
    setIsEditing(true)
  }

  const handleSave = () => {
    onSave(draft)
    flashSaved()
    setIsEditing(false)
  }

  const handleCancel = () => {
    if (isDirty) {
      setConfirmDiscard(true)
    } else {
      setIsEditing(false)
    }
  }

  const handleConfirmDiscard = () => {
    setDraft(value)
    setConfirmDiscard(false)
    setIsEditing(false)
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-bg-1 border rounded-lg transition-colors ${
        justSaved ? 'border-green-500/50' : 'border-border-1'
      }`}
      data-testid="markdown-field"
    >
      {/* Save confirmation toast */}
      <div
        className={`absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-green-500/15 border border-green-500/40 text-green-300 text-xs font-medium transition-opacity pointer-events-none ${
          justSaved ? 'opacity-100' : 'opacity-0'
        }`}
        data-testid="markdown-saved-toast"
        aria-live="polite"
      >
        <Check size={12} />
        <span>Notes saved</span>
      </div>

      {label && (
        <div className="px-4 pt-3 text-xs text-ink-4 uppercase tracking-wider">
          {label}
        </div>
      )}

      {!isEditing ? (
        <div className="group relative">
          <div className="p-4 min-h-[80px]">
            {value ? (
              <PreviewRenderer content={value} />
            ) : (
              <p className="text-ink-5 text-sm italic">{placeholder}</p>
            )}
          </div>
          <button
            onClick={handleStartEdit}
            className="absolute top-2 right-2 p-2 text-ink-4 hover:text-accent bg-bg-2 border border-border-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit notes"
            data-testid="markdown-field-edit-button"
          >
            <Pencil size={14} />
          </button>
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setEditorMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                editorMode === 'edit'
                  ? 'bg-accent text-white'
                  : 'text-ink-3 hover:text-white'
              }`}
              data-testid="markdown-mode-edit"
            >
              <Edit3 size={12} />
              Edit
            </button>
            <button
              onClick={() => setEditorMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                editorMode === 'preview'
                  ? 'bg-accent text-white'
                  : 'text-ink-3 hover:text-white'
              }`}
              data-testid="markdown-mode-preview"
            >
              <Eye size={12} />
              Preview
            </button>
            <div className="flex-1" />
            <button
              onClick={handleCancel}
              title="Cancel"
              data-testid="markdown-cancel"
              className="w-8 h-8 flex items-center justify-center rounded text-ink-3 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <X size={14} />
            </button>
            <button
              onClick={handleSave}
              title="Save"
              data-testid="markdown-save"
              className="w-8 h-8 flex items-center justify-center rounded text-green-400 hover:bg-green-400/10 transition-colors"
            >
              <Check size={14} />
            </button>
          </div>

          {editorMode === 'edit' ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
              rows={10}
              placeholder="Markdown supported — ##, **, lists, > blockquote..."
              data-testid="markdown-textarea"
              className="w-full p-3 bg-bg-0 border border-border-1 rounded text-white text-sm font-mono resize-y focus:border-accent focus:outline-none"
            />
          ) : (
            <div className="min-h-[120px] p-3 bg-bg-0 border border-border-1 rounded">
              <PreviewRenderer content={draft} />
            </div>
          )}

          {isDirty && (
            <div className="mt-2 text-xs text-amber-400">
              Unsaved changes — click-out to save, X to discard
            </div>
          )}
        </div>
      )}

      {/* Discard confirm */}
      {confirmDiscard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-2 rounded-xl border border-border-1 w-full max-w-sm p-5">
            <h3 className="text-white font-semibold mb-2">Discard changes?</h3>
            <p className="text-ink-3 text-sm mb-4">Your edits will be lost.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="px-3 py-2 text-ink-3 hover:text-white text-sm"
              >
                Keep editing
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-sm"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Preview harness ----

const INITIAL_NOTES = `## Intro
4 bars of **Em / G / D / A7sus4**

## Verse 1
*Today is gonna be the day...*

## Chorus
- Watch the dynamics on the lift
- Harmonies come in second time through

> Key: Em. If vocalist is tired, capo 2 (drop to Dm).`

export const MarkdownFieldPreview: React.FC = () => {
  const [bandNotes, setBandNotes] = useState(INITIAL_NOTES)
  const [practiceNotes, setPracticeNotes] = useState('')

  return (
    <div className="space-y-8">
      <section className="bg-bg-1 border border-border-1 rounded-lg p-4 sm:p-6">
        <h3 className="text-white font-semibold mb-3">Pattern</h3>
        <ul className="text-sm text-ink-3 space-y-1.5 list-disc list-inside">
          <li>
            Idle = <span className="text-white">rendered markdown</span>, pencil
            icon appears on hover (top-right)
          </li>
          <li>
            Click pencil → edit mode with <code>Edit</code> /
            <code>Preview</code> toggle + Save / Cancel
          </li>
          <li>
            <span className="text-white">Click-out saves</span>; explicit Cancel
            triggers discard-confirm if dirty
          </li>
          <li>
            Reusable in EditSongModal band notes, practice pre-notes, wrap-up
            notes, show/setlist notes
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-white font-semibold mb-3">
          Example: Song &quot;Band Notes&quot; (pre-filled)
        </h3>
        <MarkdownField
          label="Band Notes"
          value={bandNotes}
          onSave={setBandNotes}
        />
      </section>

      <section>
        <h3 className="text-white font-semibold mb-3">
          Example: Practice Notes (empty)
        </h3>
        <MarkdownField
          label="Notes"
          value={practiceNotes}
          onSave={setPracticeNotes}
          placeholder="What to focus on, parts to work on, objectives..."
        />
      </section>
    </div>
  )
}
