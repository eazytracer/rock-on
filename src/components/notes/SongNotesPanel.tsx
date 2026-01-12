import React, { useState, useEffect } from 'react'
import { Music, User, FileText, Plus, Save } from 'lucide-react'
import { TouchButton } from '../common/TouchButton'
import { MarkdownRenderer } from './MarkdownRenderer'
import { MarkdownEditor } from './MarkdownEditor'
import { NoteEntryCard } from './NoteEntryCard'
import { NoteEntryForm } from './NoteEntryForm'
import {
  useBandNotes,
  usePersonalNote,
  useNoteEntries,
  useCreateNoteEntry,
  useDeleteNoteEntry,
} from '../../hooks/useNotes'
import { db } from '../../services/database'
import type { SongNoteEntryInput } from '../../models/SongNoteEntry'

interface SongNotesPanelProps {
  songId: string
  bandId: string
  userId: string
  isAdmin: boolean
}

type TabType = 'band' | 'personal' | 'log'

/**
 * Tabbed interface for song notes
 * - Band Notes: Shared markdown notes (song.notes field)
 * - My Notes: Personal markdown notes (private to user)
 * - Practice Log: Jira-style note entries with session context
 */
export const SongNotesPanel: React.FC<SongNotesPanelProps> = ({
  songId,
  bandId,
  userId,
  isAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('band')
  const [isEditingBandNotes, setIsEditingBandNotes] = useState(false)
  const [bandNotesContent, setBandNotesContent] = useState('')
  const [isAddingEntry, setIsAddingEntry] = useState(false)
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  // Hooks for data management
  const {
    notes: bandNotes,
    updateNotes: updateBandNotes,
    loading: bandNotesLoading,
  } = useBandNotes(songId)
  const {
    personalNote,
    upsertNote: upsertPersonalNote,
    loading: personalNoteLoading,
  } = usePersonalNote(songId, userId, bandId)
  const {
    entries,
    refetch: refetchEntries,
    loading: entriesLoading,
  } = useNoteEntries(songId, bandId, userId)
  const { createEntry } = useCreateNoteEntry()
  const { deleteEntry } = useDeleteNoteEntry()

  // Initialize band notes content when loaded
  useEffect(() => {
    setBandNotesContent(bandNotes || '')
  }, [bandNotes])

  // Load user names for note entries
  useEffect(() => {
    const loadUserNames = async () => {
      const uniqueUserIds = [...new Set(entries.map(e => e.userId))]
      const names: Record<string, string> = {}

      for (const uid of uniqueUserIds) {
        try {
          const user = await db.users.get(uid)
          if (user) {
            names[uid] = user.name || user.email || 'Unknown'
          }
        } catch (error) {
          console.error('[SongNotesPanel] Error loading user:', uid, error)
        }
      }

      setUserNames(names)
    }

    if (entries.length > 0) {
      loadUserNames()
    }
  }, [entries])

  // Auto-save personal notes (debounced in production, immediate for demo)
  const [personalContent, setPersonalContent] = useState(
    personalNote?.content || ''
  )

  useEffect(() => {
    setPersonalContent(personalNote?.content || '')
  }, [personalNote])

  const handleSavePersonalNote = async () => {
    try {
      await upsertPersonalNote(personalContent)
    } catch (error) {
      console.error('[SongNotesPanel] Error saving personal note:', error)
    }
  }

  const handleSaveBandNotes = async () => {
    try {
      await updateBandNotes(bandNotesContent)
      setIsEditingBandNotes(false)
    } catch (error) {
      console.error('[SongNotesPanel] Error saving band notes:', error)
    }
  }

  const handleAddNoteEntry = async (
    content: string,
    visibility: 'personal' | 'band'
  ) => {
    try {
      const input: SongNoteEntryInput = {
        songId,
        userId,
        bandId,
        content,
        visibility,
        sessionType: null,
        sessionId: null,
      }

      await createEntry(input)
      await refetchEntries()
      setIsAddingEntry(false)
    } catch (error) {
      console.error('[SongNotesPanel] Error creating note entry:', error)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this note entry?')) return

    try {
      await deleteEntry(entryId)
      await refetchEntries()
    } catch (error) {
      console.error('[SongNotesPanel] Error deleting note entry:', error)
    }
  }

  const tabs = [
    { id: 'band' as const, label: 'Band Notes', icon: Music },
    { id: 'personal' as const, label: 'My Notes', icon: User },
    { id: 'log' as const, label: 'Practice Log', icon: FileText },
  ]

  return (
    <div className="space-y-4" data-testid="song-notes-panel">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-steel-gray/30">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 font-medium transition-colors
                border-b-2 -mb-px
                ${
                  activeTab === tab.id
                    ? 'border-energy-orange text-energy-orange'
                    : 'border-transparent text-smoke-white/60 hover:text-smoke-white'
                }
              `}
              data-testid={`song-notes-tab-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Band Notes Tab */}
        {activeTab === 'band' && (
          <div className="space-y-4" data-testid="song-notes-band-tab">
            {bandNotesLoading ? (
              <div className="text-smoke-white/60">Loading...</div>
            ) : isEditingBandNotes ? (
              <div className="space-y-4">
                <MarkdownEditor
                  value={bandNotesContent}
                  onChange={setBandNotesContent}
                  placeholder="Add band-level notes about this song..."
                  minHeight="min-h-[300px]"
                />
                <div className="flex gap-3 justify-end">
                  <TouchButton
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setBandNotesContent(bandNotes || '')
                      setIsEditingBandNotes(false)
                    }}
                    data-testid="song-notes-band-cancel"
                  >
                    Cancel
                  </TouchButton>
                  <TouchButton
                    variant="primary"
                    size="md"
                    onClick={handleSaveBandNotes}
                    data-testid="song-notes-band-save"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Notes
                  </TouchButton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {bandNotes ? (
                  <div className="p-4 rounded-lg bg-steel-gray border border-steel-gray/30">
                    <MarkdownRenderer content={bandNotes} />
                  </div>
                ) : (
                  <div className="p-8 text-center text-smoke-white/40 italic">
                    No band notes yet. Click Edit to add notes that all band
                    members can see.
                  </div>
                )}
                {isAdmin && (
                  <div className="flex justify-end">
                    <TouchButton
                      variant="primary"
                      size="md"
                      onClick={() => setIsEditingBandNotes(true)}
                      data-testid="song-notes-band-edit"
                    >
                      Edit Notes
                    </TouchButton>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Personal Notes Tab */}
        {activeTab === 'personal' && (
          <div className="space-y-4" data-testid="song-notes-personal-tab">
            {personalNoteLoading ? (
              <div className="text-smoke-white/60">Loading...</div>
            ) : (
              <div className="space-y-4">
                <MarkdownEditor
                  value={personalContent}
                  onChange={setPersonalContent}
                  placeholder="Add your personal notes about this song... (private to you)"
                  minHeight="min-h-[300px]"
                />
                <div className="flex justify-end">
                  <TouchButton
                    variant="primary"
                    size="md"
                    onClick={handleSavePersonalNote}
                    data-testid="song-notes-personal-save"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save My Notes
                  </TouchButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Practice Log Tab */}
        {activeTab === 'log' && (
          <div className="space-y-4" data-testid="song-notes-log-tab">
            {entriesLoading ? (
              <div className="text-smoke-white/60">Loading...</div>
            ) : (
              <>
                {/* Add Entry Button */}
                {!isAddingEntry && (
                  <div className="flex justify-end">
                    <TouchButton
                      variant="primary"
                      size="md"
                      onClick={() => setIsAddingEntry(true)}
                      data-testid="song-notes-log-add-button"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Note
                    </TouchButton>
                  </div>
                )}

                {/* Add Entry Form */}
                {isAddingEntry && (
                  <NoteEntryForm
                    onSubmit={handleAddNoteEntry}
                    onCancel={() => setIsAddingEntry(false)}
                  />
                )}

                {/* Note Entries List */}
                {entries.length > 0 ? (
                  <div className="space-y-3">
                    {entries.map(entry => (
                      <NoteEntryCard
                        key={entry.id}
                        entry={entry}
                        currentUserId={userId}
                        authorName={userNames[entry.userId] || 'Unknown'}
                        onDelete={handleDeleteEntry}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-smoke-white/40 italic">
                    No practice notes yet. Click "Add Note" to start logging
                    your practice insights.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
