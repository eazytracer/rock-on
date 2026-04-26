import React, { useState } from 'react'
import { X, Loader2, Users, User, HelpCircle } from 'lucide-react'
import { useBandNotes, usePersonalNote } from '../../hooks/useNotes'
import { useToast } from '../../contexts/ToastContext'
import { MarkdownField } from '../notes/MarkdownField'

interface SongNotesModalProps {
  isOpen: boolean
  onClose: () => void
  songId: string
  songTitle: string
  userId: string
  bandId: string
}

/**
 * Per-song notes modal opened from the FileText icon on song rows.
 *
 * Holds two `MarkdownField` instances (band-shared + personal-private), each
 * autosaving on click-out via the field's own pencil-to-edit affordance.
 * The modal-level helper popover stays as a markdown cheat-sheet (the
 * field's Preview shows rendered output, not how to write it).
 */
export const SongNotesModal: React.FC<SongNotesModalProps> = ({
  isOpen,
  onClose,
  songId,
  songTitle,
  userId,
  bandId,
}) => {
  const { showToast } = useToast()

  const {
    notes: bandNotes,
    loading: bandLoading,
    updateNotes: updateBandNotes,
  } = useBandNotes(songId)

  const {
    personalNote,
    loading: personalLoading,
    upsertNote: upsertPersonalNote,
  } = usePersonalNote(songId, userId, bandId)

  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false)

  if (!isOpen) return null

  const loading = bandLoading || personalLoading

  // Each field's onSave is called when the user clicks the green check or
  // clicks outside the field while editing. We surface failures via toast
  // (success is signalled by the MarkdownField's inline "Notes saved"
  // affordance — no need to double up).
  const handleSaveBandNotes = async (next: string) => {
    try {
      await updateBandNotes(next)
    } catch (err) {
      console.error('Error saving band notes:', err)
      showToast('Failed to save band notes', 'error')
      throw err
    }
  }

  const handleSavePersonalNotes = async (next: string) => {
    try {
      await upsertPersonalNote(next)
    } catch (err) {
      console.error('Error saving personal notes:', err)
      showToast('Failed to save personal notes', 'error')
      throw err
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="song-notes-modal-backdrop"
    >
      <div
        className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-3xl shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        data-testid="song-notes-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Song Notes</h2>
            <p className="text-sm text-[#707070] truncate">{songTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowMarkdownHelp(!showMarkdownHelp)}
                className="p-2 text-[#707070] hover:text-[#f17827ff] rounded-lg transition-colors"
                title="Markdown formatting help"
                data-testid="song-notes-modal-help"
                aria-label="Markdown formatting help"
                aria-expanded={showMarkdownHelp}
              >
                <HelpCircle size={20} />
              </button>
              {showMarkdownHelp && (
                <div
                  className="absolute right-0 top-10 z-10 w-64 p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg shadow-xl text-xs"
                  data-testid="song-notes-modal-help-popover"
                >
                  <p className="text-[#a0a0a0] font-medium mb-2">
                    Markdown Formatting
                  </p>
                  <div className="space-y-1 text-[#707070]">
                    <p>
                      <code className="text-[#f17827ff]"># Heading</code> -
                      Header
                    </p>
                    <p>
                      <code className="text-[#f17827ff]">**bold**</code> -{' '}
                      <strong className="text-white">bold</strong>
                    </p>
                    <p>
                      <code className="text-[#f17827ff]">*italic*</code> -{' '}
                      <em className="text-white">italic</em>
                    </p>
                    <p>
                      <code className="text-[#f17827ff]">- item</code> - Bullet
                      list
                    </p>
                    <p>
                      <code className="text-[#f17827ff]">1. item</code> -
                      Numbered list
                    </p>
                    <p>
                      <code className="text-[#f17827ff]">`code`</code> -{' '}
                      <code className="text-white bg-[#1a1a1a] px-1 rounded">
                        code
                      </code>
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#707070] hover:text-white rounded-lg transition-colors"
              data-testid="song-notes-modal-close"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-[#f17827ff] animate-spin" />
            </div>
          ) : (
            <>
              {/* Band Notes (shared) */}
              <div>
                <label
                  className="flex items-center gap-2 text-sm font-medium text-[#a0a0a0] mb-2"
                  htmlFor="song-notes-band-field"
                >
                  <Users size={16} className="text-[#f17827ff]" />
                  Band Notes
                  <span className="text-xs text-[#505050]">
                    (shared with band)
                  </span>
                </label>
                <div id="song-notes-band-field">
                  <MarkdownField
                    value={bandNotes || ''}
                    onSave={handleSaveBandNotes}
                    placeholder="Add notes about this song that the band can see..."
                    data-testid="song-notes-band-field"
                  />
                </div>
              </div>

              {/* Personal Notes (private) */}
              <div>
                <label
                  className="flex items-center gap-2 text-sm font-medium text-[#a0a0a0] mb-2"
                  htmlFor="song-notes-personal-field"
                >
                  <User size={16} className="text-[#f17827ff]" />
                  My Notes
                  <span className="text-xs text-[#505050]">(private)</span>
                </label>
                <div id="song-notes-personal-field">
                  <MarkdownField
                    value={personalNote?.content || ''}
                    onSave={handleSavePersonalNotes}
                    placeholder="Add your personal notes about this song..."
                    data-testid="song-notes-personal-field"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer — fields autosave on click-out, so the modal-level button
            is just a "done viewing" gesture. */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#2a2a2a]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#f17827ff] hover:bg-[#d66920] text-white text-sm font-medium rounded-lg transition-colors"
            data-testid="song-notes-modal-done"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
