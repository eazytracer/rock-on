import React, { useState, useEffect } from 'react'
import { X, Loader2, Users, User, HelpCircle } from 'lucide-react'
import { useBandNotes, usePersonalNote } from '../../hooks/useNotes'
import { useToast } from '../../contexts/ToastContext'

interface SongNotesModalProps {
  isOpen: boolean
  onClose: () => void
  songId: string
  songTitle: string
  userId: string
  bandId: string
}

export const SongNotesModal: React.FC<SongNotesModalProps> = ({
  isOpen,
  onClose,
  songId,
  songTitle,
  userId,
  bandId,
}) => {
  const { showToast } = useToast()

  // Hooks for fetching and updating notes
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

  // Local state for editing
  const [localBandNotes, setLocalBandNotes] = useState('')
  const [localPersonalNotes, setLocalPersonalNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false)

  // Initialize local state when data loads
  useEffect(() => {
    if (!bandLoading) {
      setLocalBandNotes(bandNotes || '')
    }
  }, [bandNotes, bandLoading])

  useEffect(() => {
    if (!personalLoading) {
      setLocalPersonalNotes(personalNote?.content || '')
    }
  }, [personalNote, personalLoading])

  if (!isOpen) return null

  const loading = bandLoading || personalLoading

  const handleSave = async () => {
    try {
      setSaving(true)

      // Save both notes
      const promises: Promise<unknown>[] = []

      // Save band notes if changed
      if (localBandNotes !== bandNotes) {
        promises.push(updateBandNotes(localBandNotes))
      }

      // Save personal notes if changed
      if (localPersonalNotes !== (personalNote?.content || '')) {
        promises.push(upsertPersonalNote(localPersonalNotes))
      }

      if (promises.length > 0) {
        await Promise.all(promises)
        showToast('Notes saved', 'success')
      }

      onClose()
    } catch (error) {
      console.error('Error saving notes:', error)
      showToast('Failed to save notes', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !saving) {
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
          <div>
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
              >
                <HelpCircle size={20} />
              </button>
              {showMarkdownHelp && (
                <div className="absolute right-0 top-10 z-10 w-64 p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg shadow-xl text-xs">
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
              disabled={saving}
              className="p-2 text-[#707070] hover:text-white rounded-lg transition-colors disabled:opacity-50"
              data-testid="song-notes-modal-close"
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
              {/* Song Notes (Band-shared) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-[#a0a0a0] mb-2">
                  <Users size={16} className="text-[#f17827ff]" />
                  Song Notes
                  <span className="text-xs text-[#505050]">
                    (shared with band)
                  </span>
                </label>
                <textarea
                  value={localBandNotes}
                  onChange={e => setLocalBandNotes(e.target.value)}
                  placeholder="Add notes about this song that the band can see..."
                  className="w-full h-64 px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm font-mono placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 resize-y custom-scrollbar"
                  data-testid="song-notes-band-textarea"
                />
              </div>

              {/* My Notes (Personal) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-[#a0a0a0] mb-2">
                  <User size={16} className="text-[#f17827ff]" />
                  My Notes
                  <span className="text-xs text-[#505050]">(private)</span>
                </label>
                <textarea
                  value={localPersonalNotes}
                  onChange={e => setLocalPersonalNotes(e.target.value)}
                  placeholder="Add your personal notes about this song..."
                  className="w-full h-64 px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm font-mono placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 resize-y custom-scrollbar"
                  data-testid="song-notes-personal-textarea"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#2a2a2a]">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors disabled:opacity-50"
            data-testid="song-notes-modal-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#f17827ff] hover:bg-[#d66920] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            data-testid="song-notes-modal-save"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
