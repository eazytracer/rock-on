/**
 * MarkdownField — render-first notes editing surface.
 *
 * Idle state: rendered markdown with a pencil icon overlay (top-right).
 * Click pencil → edit mode with Edit / Preview toggle + Save / Cancel.
 * Click-outside the field while editing saves changes with a brief "Notes
 * saved" flash. Cancel while dirty opens a discard-confirmation.
 *
 * Adopted for all markdown-typed notes fields: EditSongModal band notes,
 * PracticeView pre-notes + wrap-up, SetlistView notes, ShowView notes.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Pencil, Check, X, Eye, Edit3 } from 'lucide-react'
import { MarkdownRenderer } from './MarkdownRenderer'

export interface MarkdownFieldProps {
  value: string
  onSave: (value: string) => void | Promise<void>
  placeholder?: string
  /** Optional field label shown above the content. */
  label?: string
  /** Maximum characters; mirrors the former MarkdownEditor behavior. */
  maxLength?: number
  /** Idle-state container extra classes. */
  className?: string
  /** data-testid passthrough. */
  'data-testid'?: string
}

const DEFAULT_MAX = 10240 // 10 KB

export const MarkdownField: React.FC<MarkdownFieldProps> = ({
  value,
  onSave,
  placeholder = 'Click the pencil icon to add notes...',
  label,
  maxLength = DEFAULT_MAX,
  className = '',
  'data-testid': testId,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const savedTimerRef = useRef<number | null>(null)

  const isDirty = draft !== value
  const charCount = draft.length
  const isAtLimit = charCount >= maxLength

  // Keep draft in sync with incoming value when not editing
  useEffect(() => {
    if (!isEditing) setDraft(value)
  }, [value, isEditing])

  const flashSaved = () => {
    setJustSaved(true)
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 1800)
  }

  useEffect(
    () => () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    },
    []
  )

  // Click outside the field saves automatically.
  useEffect(() => {
    if (!isEditing) return
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (isDirty) {
          void Promise.resolve(onSave(draft)).then(flashSaved)
        }
        setIsEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isEditing, isDirty, draft, onSave])

  const handleStartEdit = () => {
    setDraft(value)
    setMode('edit')
    setIsEditing(true)
  }

  const handleSave = async () => {
    await Promise.resolve(onSave(draft))
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
      className={`relative bg-[#0f0f0f] border rounded-lg transition-colors ${
        justSaved ? 'border-green-500/50' : 'border-[#2a2a2a]'
      } ${className}`}
      data-testid={testId ?? 'markdown-field'}
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
        <div className="px-4 pt-3 text-xs text-[#707070] uppercase tracking-wider">
          {label}
        </div>
      )}

      {!isEditing ? (
        <div className="group relative">
          <div className="p-4 min-h-[80px]">
            {value ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="text-[#505050] text-sm italic">{placeholder}</p>
            )}
          </div>
          <button
            onClick={handleStartEdit}
            className="absolute top-2 right-2 p-2 text-[#707070] hover:text-[#f17827ff] bg-[#1a1a1a] border border-[#2a2a2a] rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            title="Edit notes"
            data-testid="markdown-field-edit-button"
            aria-label="Edit notes"
          >
            <Pencil size={14} />
          </button>
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                mode === 'edit'
                  ? 'bg-[#f17827ff] text-white'
                  : 'text-[#a0a0a0] hover:text-white'
              }`}
              data-testid="markdown-mode-edit"
            >
              <Edit3 size={12} />
              Edit
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                mode === 'preview'
                  ? 'bg-[#f17827ff] text-white'
                  : 'text-[#a0a0a0] hover:text-white'
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
              className="w-8 h-8 flex items-center justify-center rounded text-[#a0a0a0] hover:text-red-400 hover:bg-red-400/10 transition-colors"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
            <button
              onClick={handleSave}
              title="Save"
              data-testid="markdown-save"
              className="w-8 h-8 flex items-center justify-center rounded text-green-400 hover:bg-green-400/10 transition-colors"
              aria-label="Save"
            >
              <Check size={14} />
            </button>
          </div>

          {mode === 'edit' ? (
            <textarea
              value={draft}
              onChange={e => {
                const v = e.target.value
                if (v.length <= maxLength) setDraft(v)
              }}
              autoFocus
              rows={10}
              placeholder="Markdown supported — ##, **, lists, > blockquote..."
              data-testid="markdown-textarea"
              className="w-full p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white text-sm font-mono resize-y focus:border-[#f17827ff] focus:outline-none"
            />
          ) : (
            <div className="min-h-[120px] p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded">
              {draft ? (
                <MarkdownRenderer content={draft} />
              ) : (
                <p className="text-[#505050] text-sm italic">
                  Nothing to preview yet...
                </p>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-xs">
            {isDirty ? (
              <span className="text-amber-400">
                Unsaved changes — click out to save, × to discard
              </span>
            ) : (
              <span />
            )}
            <span
              className={
                isAtLimit
                  ? 'text-red-400 font-semibold'
                  : charCount >= maxLength * 0.8
                    ? 'text-amber-300'
                    : 'text-[#707070]'
              }
              data-testid="markdown-char-count"
            >
              {charCount.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Discard confirm */}
      {confirmDiscard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-sm p-5">
            <h3 className="text-white font-semibold mb-2">Discard changes?</h3>
            <p className="text-[#a0a0a0] text-sm mb-4">
              Your edits will be lost.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="px-3 py-2 text-[#a0a0a0] hover:text-white text-sm"
                data-testid="markdown-keep-editing"
              >
                Keep editing
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-sm"
                data-testid="markdown-confirm-discard"
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

export default MarkdownField
