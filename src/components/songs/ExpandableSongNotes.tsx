import React, { useState } from 'react'
import { ChevronDown, Music, User, Save, Loader2 } from 'lucide-react'
import { usePersonalNote, useBandNotes } from '../../hooks/useNotes'
import { MarkdownRenderer } from '../notes/MarkdownRenderer'

interface ExpandableSongNotesProps {
  songId: string
  bandNotes?: string // If not provided, will be fetched from database
  userId: string
  bandId: string
  isExpanded: boolean
  onToggle: () => void
}

/**
 * Expandable section showing band notes and personal notes for a song
 * Used in SongRow (desktop) and SongCard (mobile) on the Songs page
 */
export const ExpandableSongNotes: React.FC<ExpandableSongNotesProps> = ({
  songId,
  bandNotes: bandNotesProp,
  userId,
  bandId,
  isExpanded,
  onToggle,
}) => {
  // Fetch band notes from database if not provided via props
  const { notes: fetchedBandNotes } = useBandNotes(songId)
  const bandNotes =
    bandNotesProp !== undefined ? bandNotesProp : fetchedBandNotes

  const {
    personalNote,
    loading: personalLoading,
    upsertNote,
  } = usePersonalNote(songId, userId, bandId)
  const [isEditingPersonal, setIsEditingPersonal] = useState(false)
  const [personalContent, setPersonalContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Initialize personal content when editing starts
  const handleStartEditing = () => {
    setPersonalContent(personalNote?.content || '')
    setIsEditingPersonal(true)
  }

  const handleSavePersonal = async () => {
    try {
      setIsSaving(true)
      await upsertNote(personalContent)
      setIsEditingPersonal(false)
    } catch (error) {
      console.error('Failed to save personal note:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingPersonal(false)
    setPersonalContent('')
  }

  const hasBandNotes = bandNotes && bandNotes.trim().length > 0
  const hasPersonalNotes =
    personalNote?.content && personalNote.content.trim().length > 0
  const hasAnyNotes = hasBandNotes || hasPersonalNotes

  return (
    <div className="w-full">
      {/* Expand/Collapse Toggle */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-[#707070] hover:text-[#a0a0a0] transition-colors"
        data-testid={`song-notes-toggle-${songId}`}
      >
        <ChevronDown
          size={14}
          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
        <span>{hasAnyNotes ? 'Notes' : 'Add notes'}</span>
      </button>

      {/* Expanded Notes Section */}
      {isExpanded && (
        <div
          className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-4"
          data-testid={`song-notes-expanded-${songId}`}
        >
          {/* Band Notes */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Music size={14} className="text-[#f17827ff]" />
              <span className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wider">
                Band Notes
              </span>
            </div>
            {hasBandNotes ? (
              <div className="pl-5 text-sm text-[#c0c0c0]">
                <MarkdownRenderer content={bandNotes} className="prose-sm" />
              </div>
            ) : (
              <p className="pl-5 text-sm text-[#505050] italic">
                No band notes yet
              </p>
            )}
          </div>

          {/* Personal Notes */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User size={14} className="text-[#3b82f6]" />
              <span className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wider">
                My Notes
              </span>
              <span className="text-xs text-[#505050]">(private)</span>
            </div>

            {personalLoading ? (
              <div className="pl-5 text-sm text-[#505050]">Loading...</div>
            ) : isEditingPersonal ? (
              <div className="pl-5 space-y-2">
                <textarea
                  value={personalContent}
                  onChange={e => setPersonalContent(e.target.value)}
                  placeholder="Add your personal notes about this song..."
                  className="w-full h-24 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]/20 resize-none"
                  data-testid={`song-personal-notes-input-${songId}`}
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-xs text-[#a0a0a0] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePersonal}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6] text-white text-xs font-medium rounded-lg hover:bg-[#2563eb] transition-colors disabled:opacity-50"
                    data-testid={`song-personal-notes-save-${songId}`}
                  >
                    {isSaving ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}
                    Save
                  </button>
                </div>
              </div>
            ) : hasPersonalNotes && personalNote?.content ? (
              <div className="pl-5">
                <div className="text-sm text-[#c0c0c0] mb-2">
                  <MarkdownRenderer
                    content={personalNote.content}
                    className="prose-sm"
                  />
                </div>
                <button
                  onClick={handleStartEditing}
                  className="text-xs text-[#3b82f6] hover:underline"
                >
                  Edit
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartEditing}
                className="pl-5 text-sm text-[#3b82f6] hover:underline"
                data-testid={`song-personal-notes-add-${songId}`}
              >
                + Add personal notes
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
