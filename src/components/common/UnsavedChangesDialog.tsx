/**
 * UnsavedChangesDialog — blocking confirm dialog for unsaved-changes guards.
 *
 * Consumed by the `useUnsavedChanges` hook. See:
 *   src/hooks/useUnsavedChanges.ts
 */

import React, { useEffect, useRef } from 'react'
import { AlertCircle, Save, Trash2 } from 'lucide-react'

export interface UnsavedChangesDialogProps {
  isOpen: boolean
  title?: string
  message?: string
  keepLabel?: string
  discardLabel?: string
  saveLabel?: string
  onKeepEditing: () => void
  onDiscard: () => void
  /**
   * Optional save-and-close handler. When provided, a "Save" button renders.
   * Omit for surfaces where in-place save isn't possible from the dialog
   * (user must keep editing or discard).
   */
  onSaveAndClose?: () => void | Promise<void>
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  title = 'Unsaved changes',
  message = 'You have unsaved changes. What would you like to do?',
  keepLabel = 'Keep editing',
  discardLabel = 'Discard',
  saveLabel = 'Save',
  onKeepEditing,
  onDiscard,
  onSaveAndClose,
}) => {
  const keepRef = useRef<HTMLButtonElement>(null)

  // Focus "Keep editing" by default when the dialog opens.
  useEffect(() => {
    if (isOpen && keepRef.current) {
      keepRef.current.focus()
    }
  }, [isOpen])

  // Escape → keep editing (non-destructive default)
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onKeepEditing()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onKeepEditing])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      data-testid="unsaved-changes-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
    >
      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="text-amber-400" size={20} />
            </div>
            <div className="min-w-0">
              <h2
                id="unsaved-changes-title"
                className="text-white font-semibold text-lg mb-1"
              >
                {title}
              </h2>
              <p className="text-[#a0a0a0] text-sm">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 p-4 bg-[#0f0f0f] border-t border-[#2a2a2a]">
          <button
            ref={keepRef}
            onClick={onKeepEditing}
            data-testid="unsaved-keep-editing"
            className="flex-1 px-4 py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#252525] border border-[#2a2a2a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/40"
          >
            {keepLabel}
          </button>
          <button
            onClick={onDiscard}
            data-testid="unsaved-discard"
            className="flex-1 px-4 py-2.5 bg-[#2a1515] text-red-300 text-sm font-medium rounded-lg hover:bg-[#3a1f1f] border border-red-500/30 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <Trash2 size={14} />
            {discardLabel}
          </button>
          {onSaveAndClose && (
            <button
              onClick={onSaveAndClose}
              data-testid="unsaved-save-and-close"
              className="flex-1 px-4 py-2.5 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66920] transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/60"
            >
              <Save size={14} />
              {saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default UnsavedChangesDialog
