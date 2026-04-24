/**
 * UnsavedChangesPreview — demo of the blocking confirm dialog pattern.
 *
 * The real implementation will be a pair:
 * - useUnsavedChanges(isDirty) hook — blocks close / route-change attempts
 *   while the form is dirty.
 * - <UnsavedChangesDialog /> — the modal the hook renders.
 *
 * Surfaces that will adopt it: EditSongModal (add/edit), Setlist edit flows,
 * MarkdownField (when in edit state with unsaved changes).
 */

import React, { useState, useEffect } from 'react'
import { AlertCircle, X, Save, Trash2 } from 'lucide-react'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  title?: string
  message?: string
  onKeepEditing: () => void
  onDiscard: () => void
  onSaveAndClose?: () => void
}

const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  title = 'Unsaved changes',
  message = 'You have unsaved changes. What would you like to do?',
  onKeepEditing,
  onDiscard,
  onSaveAndClose,
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      data-testid="unsaved-changes-dialog"
    >
      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="text-amber-400" size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-lg mb-1">{title}</h2>
              <p className="text-[#a0a0a0] text-sm">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 p-4 bg-[#0f0f0f] border-t border-[#2a2a2a]">
          <button
            onClick={onKeepEditing}
            data-testid="unsaved-keep-editing"
            className="flex-1 px-4 py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#252525] border border-[#2a2a2a] transition-colors"
          >
            Keep editing
          </button>
          <button
            onClick={onDiscard}
            data-testid="unsaved-discard"
            className="flex-1 px-4 py-2.5 bg-[#2a1515] text-red-300 text-sm font-medium rounded-lg hover:bg-[#3a1f1f] border border-red-500/30 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={14} />
            Discard
          </button>
          {onSaveAndClose && (
            <button
              onClick={onSaveAndClose}
              data-testid="unsaved-save-and-close"
              className="flex-1 px-4 py-2.5 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66920] transition-colors flex items-center justify-center gap-2"
            >
              <Save size={14} />
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export const UnsavedChangesPreview: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('Wonderwall')
  const [artist, setArtist] = useState('Oasis')
  const [savedSnapshot, setSavedSnapshot] = useState({
    title: 'Wonderwall',
    artist: 'Oasis',
  })
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isDirty =
    title !== savedSnapshot.title || artist !== savedSnapshot.artist

  // Demo: prevent page unload / tab close while dirty
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleAttemptClose = () => {
    if (isDirty) {
      setConfirmOpen(true)
    } else {
      setModalOpen(false)
    }
  }

  const handleDiscard = () => {
    setTitle(savedSnapshot.title)
    setArtist(savedSnapshot.artist)
    setConfirmOpen(false)
    setModalOpen(false)
  }

  const handleSaveAndClose = () => {
    setSavedSnapshot({ title, artist })
    setConfirmOpen(false)
    setModalOpen(false)
  }

  return (
    <div className="space-y-8">
      {/* Behavior overview */}
      <section className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
        <h3 className="text-white font-semibold mb-3">
          Pattern: blocking confirm
        </h3>
        <ul className="text-sm text-[#a0a0a0] space-y-2 list-disc list-inside">
          <li>
            Triggered by: <code>X</code> button, backdrop click, Escape key,
            route-change, tab close/refresh
          </li>
          <li>
            <span className="text-white">Only fires when dirty</span> — clean
            closes go through immediately, zero friction
          </li>
          <li>
            Three explicit actions: Keep editing (default focus), Discard, Save
            &amp; close
          </li>
          <li>
            Shared <code>useUnsavedChanges(isDirty)</code> hook so every modal /
            edit surface adopts it with one line
          </li>
        </ul>
      </section>

      {/* Demo modal trigger */}
      <section className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Try it</h3>
          <span
            className={`text-xs px-2 py-1 rounded ${
              isDirty
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-green-500/10 text-green-400 border border-green-500/30'
            }`}
          >
            {isDirty ? 'Dirty' : 'Clean'}
          </span>
        </div>
        <p className="text-sm text-[#a0a0a0] mb-4">
          Edit a field below, then try to close the &quot;modal&quot; with the X
          button — you&apos;ll be prompted. Also try refreshing the page while
          dirty.
        </p>

        <button
          onClick={() => setModalOpen(true)}
          data-testid="open-edit-modal"
          className="px-4 py-2 bg-[#f17827ff] text-white rounded-lg hover:bg-[#d66920] text-sm font-medium"
        >
          Open mock Edit Song modal
        </button>
      </section>

      {/* Mock Edit Song Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleAttemptClose}
        >
          <div
            className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <h2 className="text-white font-semibold">Edit Song (mock)</h2>
              <button
                onClick={handleAttemptClose}
                data-testid="mock-modal-close"
                className="p-1 text-[#707070] hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Title" value={title} onChange={setTitle} />
              <Field label="Artist" value={artist} onChange={setArtist} />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[#2a2a2a]">
              <button
                onClick={handleAttemptClose}
                className="px-4 py-2 text-[#a0a0a0] hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndClose}
                className="px-4 py-2 bg-[#f17827ff] text-white rounded-lg text-sm hover:bg-[#d66920]"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      <UnsavedChangesDialog
        isOpen={confirmOpen}
        onKeepEditing={() => setConfirmOpen(false)}
        onDiscard={handleDiscard}
        onSaveAndClose={handleSaveAndClose}
      />
    </div>
  )
}

// ---- Local helpers (preview only) ----

const Field: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
}> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-sm text-[#a0a0a0] mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none"
    />
  </div>
)
