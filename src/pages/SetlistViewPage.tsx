import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ModernLayout } from '../components/layout/ModernLayout'
import { EntityHeader } from '../components/common/EntityHeader'
import { InlineEditableField } from '../components/common/InlineEditableField'
import { SETLIST_STATUS_OPTIONS } from '../components/common/InlineStatusBadge'
import {
  SortableSongListItem,
  UISong,
  UISetlistItem,
  generateAvatarColor,
  generateInitials,
} from '../components/common/SongListItem'
import { BrowseSongsDrawer } from '../components/common/BrowseSongsDrawer'
import { EditSongModal } from '../components/songs/EditSongModal'
import { AddItemDropdown } from '../components/common/AddItemDropdown'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useConfirm } from '../hooks/useConfirm'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../services/database'
import { secondsToDuration } from '../utils/formatters'
import { formatShowDate } from '../utils/dateHelpers'
import type { Setlist as DBSetlist } from '../models/Setlist'
import type { Song as DBSong } from '../models/Song'
import { Clock, Music2, Calendar, ListMusic, FileText } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

// Convert database song to UI song
const dbSongToUISong = (dbSong: DBSong): UISong => {
  return {
    id: dbSong.id!,
    title: dbSong.title,
    artist: dbSong.artist || '',
    duration: secondsToDuration(dbSong.duration || 0),
    durationSeconds: dbSong.duration || 0,
    key: dbSong.key,
    tuning: dbSong.guitarTuning,
    initials: generateInitials(dbSong.title),
    avatarColor: generateAvatarColor(dbSong.title),
  }
}

// Helper to format total duration
const formatTotalDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes} min`
}

// Helper to calculate setlist duration
const calculateSetlistDuration = (items: UISetlistItem[]): number => {
  return items.reduce((total, item) => {
    if (item.type === 'song' && item.song) {
      return total + item.song.durationSeconds
    } else if (item.type === 'break' && item.breakDuration) {
      return total + item.breakDuration * 60
    }
    return total
  }, 0)
}

// Main SetlistViewPage Component
export const SetlistViewPage: React.FC = () => {
  const navigate = useNavigate()
  const { setlistId } = useParams<{ setlistId: string }>()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const { currentUser, currentBand, signOut } = useAuth()

  // Detect "new" mode
  const isNewMode = !setlistId || setlistId === 'new'

  // Core state
  const [loading, setLoading] = useState(!isNewMode)
  const [setlist, setSetlist] = useState<DBSetlist | null>(null)
  const [items, setItems] = useState<UISetlistItem[]>([])
  const [associatedShow, setAssociatedShow] = useState<{
    id: string
    name: string
    date: string
  } | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add section/break dialogs
  const [showSectionInput, setShowSectionInput] = useState(false)
  const [sectionTitle, setSectionTitle] = useState('')

  // Form state for new mode (inline editing saves directly for existing setlists)
  const [formName, setFormName] = useState('New Setlist')
  const [formStatus, setFormStatus] = useState('draft')
  const [formNotes, setFormNotes] = useState('')

  // Available data for song picker
  const [dbSongs, setDbSongs] = useState<DBSong[]>([])
  const [dbSetlists, setDbSetlists] = useState<DBSetlist[]>([])

  // Expandable notes state
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null)

  // Edit song modal state
  const [editingSong, setEditingSong] = useState<DBSong | null>(null)

  const currentBandId = localStorage.getItem('currentBandId') || ''
  const currentUserId = localStorage.getItem('currentUserId') || ''

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load setlist data
  useEffect(() => {
    const loadSetlist = async () => {
      // Load available songs and setlists for picker
      if (currentBandId) {
        const loadedDbSongs = await db.songs
          .where('contextType')
          .equals('band')
          .and(s => s.contextId === currentBandId)
          .toArray()

        const loadedDbSetlists = await db.setlists
          .where('bandId')
          .equals(currentBandId)
          .toArray()

        setDbSongs(loadedDbSongs)
        setDbSetlists(loadedDbSetlists.filter(s => s.id !== setlistId))
      }

      // For new mode, we're done
      if (isNewMode) {
        return
      }

      try {
        setLoading(true)

        // Load setlist
        const dbSetlist = await db.setlists.get(setlistId)
        if (!dbSetlist) {
          navigate('/setlists')
          return
        }

        setSetlist(dbSetlist)
        setFormName(dbSetlist.name)
        setFormStatus(dbSetlist.status)
        setFormNotes(dbSetlist.notes || '')

        // Load associated show - check if any show references this setlist
        const showsWithThisSetlist = await db.shows
          .where('setlistId')
          .equals(setlistId!)
          .first()

        if (showsWithThisSetlist) {
          setAssociatedShow({
            id: showsWithThisSetlist.id!,
            name: showsWithThisSetlist.name || 'Unnamed Show',
            date: formatShowDate(showsWithThisSetlist.scheduledDate),
          })
        } else if (dbSetlist.showId) {
          // Fallback to legacy showId on setlist
          const show = await db.shows.get(dbSetlist.showId)
          if (show) {
            setAssociatedShow({
              id: show.id!,
              name: show.name || 'Unnamed Show',
              date: formatShowDate(show.scheduledDate),
            })
          }
        }

        // Populate songs in items
        const populatedItems: UISetlistItem[] = await Promise.all(
          (dbSetlist.items || []).map(async item => {
            if (item.type === 'song' && item.songId) {
              const song = await db.songs.get(item.songId)
              if (song) {
                return {
                  ...item,
                  id: item.id || crypto.randomUUID(),
                  song: dbSongToUISong(song),
                }
              }
            }
            return {
              ...item,
              id: item.id || crypto.randomUUID(),
            } as UISetlistItem
          })
        )

        setItems(populatedItems)
      } catch (err) {
        console.error('Error loading setlist:', err)
        navigate('/setlists')
      } finally {
        setLoading(false)
      }
    }

    loadSetlist()
  }, [setlistId, navigate, currentBandId, isNewMode])

  // Save a single field (for inline editing of existing setlists)
  const saveField = useCallback(
    async (field: keyof DBSetlist, value: string | number | undefined) => {
      if (!setlistId || isNewMode) {
        // In new mode, just update local state
        if (field === 'name') setFormName(String(value || ''))
        if (field === 'status') setFormStatus(String(value || 'draft'))
        if (field === 'notes') setFormNotes(String(value || ''))
        return
      }

      try {
        await db.setlists.update(setlistId, {
          [field]: value,
          lastModified: new Date(),
        })

        // Refresh setlist data
        const updatedSetlist = await db.setlists.get(setlistId)
        if (updatedSetlist) {
          setSetlist(updatedSetlist)
        }
      } catch (err) {
        console.error(`Error saving ${field}:`, err)
        showToast(`Failed to save ${field}`, 'error')
      }
    },
    [setlistId, isNewMode, showToast]
  )

  // Create new setlist (for new mode)
  const createSetlist = async () => {
    try {
      setSaving(true)

      // Build items for save
      const dbItems = items.map((item, index) => ({
        id: item.id,
        type: item.type,
        position: index + 1,
        songId: item.songId,
        breakDuration: item.breakDuration,
        breakNotes: item.breakNotes,
        sectionTitle: item.sectionTitle,
        notes: item.notes,
      }))

      const newId = crypto.randomUUID()
      await db.setlists.add({
        id: newId,
        bandId: currentBandId,
        name: formName,
        status: formStatus as 'draft' | 'active' | 'archived',
        notes: formNotes,
        items: dbItems,
        totalDuration: calculateSetlistDuration(items),
        createdDate: new Date(),
        lastModified: new Date(),
      })

      showToast('Setlist created', 'success')
      navigate(`/setlists/${newId}`, { replace: true })
    } catch (err) {
      console.error('Error creating setlist:', err)
      showToast('Failed to create setlist', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle drag end for reordering (always active)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setItems(prev => {
        const oldIndex = prev.findIndex(item => item.id === active.id)
        const newIndex = prev.findIndex(item => item.id === over.id)

        const reordered = arrayMove(prev, oldIndex, newIndex).map(
          (item, index) => ({
            ...item,
            position: index + 1,
          })
        )

        // Auto-save if we have an existing setlist
        if (setlistId && !isNewMode) {
          saveItems(reordered)
        }

        return reordered
      })
    }
  }

  // Save items to database
  const saveItems = async (orderedItems: UISetlistItem[]) => {
    if (!setlistId || isNewMode) return

    try {
      const dbItems = orderedItems.map((item, index) => ({
        id: item.id,
        type: item.type,
        position: index + 1,
        songId: item.songId,
        breakDuration: item.breakDuration,
        breakNotes: item.breakNotes,
        sectionTitle: item.sectionTitle,
        notes: item.notes,
      }))

      await db.setlists.update(setlistId, {
        items: dbItems,
        lastModified: new Date(),
      })
    } catch (err) {
      console.error('Error saving items:', err)
    }
  }

  // Add song to setlist (always available)
  const addSongToSetlist = (song: DBSong) => {
    const newPosition = items.length + 1
    const uiSong = dbSongToUISong(song)
    const newItem: UISetlistItem = {
      id: crypto.randomUUID(),
      type: 'song',
      position: newPosition,
      song: uiSong,
      songId: song.id!,
    }

    const newItems = [...items, newItem]
    setItems(newItems)

    // Auto-save if we have an existing setlist
    if (setlistId && !isNewMode) {
      saveItems(newItems)
    }

    showToast(`Added "${song.title}"`, 'success')
  }

  // Add all songs from another setlist
  const addAllSongsFromSetlist = (songs: DBSong[]) => {
    const startPosition = items.length + 1
    const newItemsList: UISetlistItem[] = songs.map((song, index) => ({
      id: crypto.randomUUID(),
      type: 'song' as const,
      position: startPosition + index,
      song: dbSongToUISong(song),
      songId: song.id!,
    }))

    const newItems = [...items, ...newItemsList]
    setItems(newItems)

    // Auto-save if we have an existing setlist
    if (setlistId && !isNewMode) {
      saveItems(newItems)
    }

    showToast(`Added ${songs.length} songs`, 'success')
  }

  // Remove item with confirmation
  const removeItem = async (itemId: string, itemTitle: string) => {
    const confirmed = await confirm({
      title: 'Remove Item',
      message: `Remove "${itemTitle}" from this setlist?`,
      variant: 'warning',
      confirmLabel: 'Remove',
    })

    if (confirmed) {
      const newItems = items
        .filter(item => item.id !== itemId)
        .map((item, index) => ({ ...item, position: index + 1 }))

      setItems(newItems)

      // Auto-save if we have an existing setlist
      if (setlistId && !isNewMode) {
        saveItems(newItems)
      }

      showToast('Item removed', 'success')
    }
  }

  // Add a break to the setlist
  const addBreak = async () => {
    const newPosition = items.length + 1
    const newItem: UISetlistItem = {
      id: crypto.randomUUID(),
      type: 'break',
      position: newPosition,
      breakDuration: 15, // Default 15 minutes
      breakNotes: '',
    }

    const newItems = [...items, newItem]
    setItems(newItems)

    // Auto-save for existing setlists
    if (setlistId && !isNewMode) {
      try {
        const dbItems = newItems.map(item => ({
          id: item.id,
          type: item.type,
          position: item.position,
          songId: item.songId,
          notes: item.notes,
          breakDuration: item.breakDuration,
          breakNotes: item.breakNotes,
          sectionTitle: item.sectionTitle,
        }))
        await db.setlists.update(setlistId, {
          items: dbItems,
          totalDuration: calculateSetlistDuration(newItems),
        })
        showToast('Break added', 'success')
      } catch (error) {
        console.error('Failed to save break:', error)
        showToast('Failed to add break', 'error')
      }
    }
  }

  // Add a section to the setlist
  const addSection = async (title: string) => {
    if (!title.trim()) return

    const newPosition = items.length + 1
    const newItem: UISetlistItem = {
      id: crypto.randomUUID(),
      type: 'section',
      position: newPosition,
      sectionTitle: title.trim(),
    }

    const newItems = [...items, newItem]
    setItems(newItems)
    setShowSectionInput(false)
    setSectionTitle('')

    // Auto-save for existing setlists
    if (setlistId && !isNewMode) {
      try {
        const dbItems = newItems.map(item => ({
          id: item.id,
          type: item.type,
          position: item.position,
          songId: item.songId,
          notes: item.notes,
          breakDuration: item.breakDuration,
          breakNotes: item.breakNotes,
          sectionTitle: item.sectionTitle,
        }))
        await db.setlists.update(setlistId, {
          items: dbItems,
          totalDuration: calculateSetlistDuration(newItems),
        })
        showToast('Section added', 'success')
      } catch (error) {
        console.error('Failed to save section:', error)
        showToast('Failed to add section', 'error')
      }
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f]">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f17827ff] mx-auto mb-4"></div>
            <p className="text-[#a0a0a0] text-sm">Loading setlist...</p>
          </div>
        </div>
      </div>
    )
  }

  // Display data - use form state in new mode, setlist data in existing mode
  const displayName = isNewMode ? formName : setlist?.name || 'Untitled Setlist'
  const displayStatus = isNewMode ? formStatus : setlist?.status || 'draft'
  const displayNotes = isNewMode ? formNotes : setlist?.notes || ''

  const songCount = items.filter(i => i.type === 'song').length
  const totalDuration = calculateSetlistDuration(items)
  const songsInSetlist = items
    .filter(i => i.type === 'song')
    .map(i => i.songId!)

  return (
    <ModernLayout
      bandName={currentBand?.name}
      userEmail={currentUser?.email}
      onSignOut={signOut}
    >
      {/* Header with inline editing */}
      <EntityHeader
        backPath="/setlists"
        title={displayName}
        titleEditable={true}
        onTitleSave={val => saveField('name', String(val))}
        titlePlaceholder="Enter setlist name"
        entityType="setlist"
        status={{
          value: displayStatus,
          onSave: val => saveField('status', val),
          options: SETLIST_STATUS_OPTIONS,
        }}
        isNew={isNewMode}
        data-testid="setlist-header"
      />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* New mode - Create button */}
        {isNewMode && (
          <div className="bg-[#121212] border border-[#f17827ff] rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Creating new setlist</p>
              <p className="text-sm text-[#707070]">
                Click any field above to edit, then save when ready
              </p>
            </div>
            <button
              onClick={createSetlist}
              disabled={saving}
              className="px-4 py-2 bg-[#f17827ff] hover:bg-[#d66920] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              data-testid="create-setlist-button"
            >
              {saving ? 'Creating...' : 'Create Setlist'}
            </button>
          </div>
        )}

        {/* Details Section */}
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Associated Show (read-only, clickable link) */}
            {associatedShow && (
              <div
                className="flex items-center gap-2"
                data-testid="setlist-show"
              >
                <Calendar size={16} className="text-[#f17827ff]" />
                <div>
                  <label className="block text-sm text-[#707070] mb-0.5">
                    Show
                  </label>
                  <button
                    onClick={() => navigate(`/shows/${associatedShow.id}`)}
                    className="text-[#f17827ff] text-sm hover:underline text-left"
                    data-testid="setlist-show-link"
                  >
                    {associatedShow.name} - {associatedShow.date}
                  </button>
                </div>
              </div>
            )}

            {/* Stats (read-only) */}
            <div
              className="flex items-center gap-2"
              data-testid="setlist-song-count"
            >
              <Music2 size={16} className="text-[#f17827ff]" />
              <div>
                <label className="block text-sm text-[#707070] mb-0.5">
                  Songs
                </label>
                <span className="text-white text-sm">{songCount} songs</span>
              </div>
            </div>

            <div
              className="flex items-center gap-2"
              data-testid="setlist-duration"
            >
              <Clock size={16} className="text-[#f17827ff]" />
              <div>
                <label className="block text-sm text-[#707070] mb-0.5">
                  Duration
                </label>
                <span className="text-white text-sm">
                  {formatTotalDuration(totalDuration)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes - editable inline */}
          <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
            <div className="flex items-start gap-2">
              <FileText size={16} className="text-[#f17827ff] mt-1" />
              <div className="flex-1">
                <label className="block text-sm text-[#707070] mb-1">
                  Notes
                </label>
                <InlineEditableField
                  value={displayNotes}
                  onSave={val => saveField('notes', String(val))}
                  type="textarea"
                  placeholder="Add notes about this setlist..."
                  data-testid="setlist-notes"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Items Section - ALWAYS editable */}
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Setlist Items ({items.length})
            </h2>
            <AddItemDropdown
              onAddSong={() => setIsDrawerOpen(true)}
              onAddBreak={addBreak}
              onAddSection={() => setShowSectionInput(true)}
              data-testid="add-item-dropdown"
            />
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-[#2a2a2a] rounded-lg">
              <ListMusic size={48} className="text-[#2a2a2a] mb-3" />
              <p className="text-[#707070] text-sm mb-1">
                No items in this setlist
              </p>
              <p className="text-[#505050] text-xs mb-4">
                Add songs, breaks, or sections
              </p>
              <AddItemDropdown
                onAddSong={() => setIsDrawerOpen(true)}
                onAddBreak={addBreak}
                onAddSection={() => setShowSectionInput(true)}
              />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div data-testid="setlist-items-list" className="space-y-2">
                  {items.map(item => (
                    <SortableSongListItem
                      key={item.id}
                      item={item}
                      isEditing={true}
                      onRemove={() =>
                        removeItem(
                          item.id,
                          item.song?.title || item.sectionTitle || 'this item'
                        )
                      }
                      onEdit={
                        item.type === 'song' && item.song
                          ? () => {
                              const songToEdit = dbSongs.find(
                                s => s.id === item.song?.id
                              )
                              if (songToEdit) {
                                setEditingSong(songToEdit)
                              }
                            }
                          : undefined
                      }
                      userId={currentUserId}
                      bandId={currentBandId}
                      isNotesExpanded={item.song?.id === expandedSongId}
                      onToggleNotes={() =>
                        setExpandedSongId(
                          item.song?.id === expandedSongId
                            ? null
                            : item.song?.id || null
                        )
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Browse Songs Drawer */}
      <BrowseSongsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        songs={dbSongs}
        selectedSongIds={songsInSetlist}
        onAddSong={addSongToSetlist}
        setlists={dbSetlists}
        onAddAllFromSetlist={addAllSongsFromSetlist}
      />

      {/* Section Title Input Modal */}
      {showSectionInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Add Section
            </h3>
            <input
              type="text"
              value={sectionTitle}
              onChange={e => setSectionTitle(e.target.value)}
              placeholder="Enter section title..."
              className="w-full px-4 py-3 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none mb-4"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && sectionTitle.trim()) {
                  addSection(sectionTitle)
                } else if (e.key === 'Escape') {
                  setShowSectionInput(false)
                  setSectionTitle('')
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSectionInput(false)
                  setSectionTitle('')
                }}
                className="px-4 py-2 text-[#a0a0a0] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => addSection(sectionTitle)}
                disabled={!sectionTitle.trim()}
                className="px-4 py-2 bg-[#f17827ff] text-white rounded-lg hover:bg-[#d66920] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />

      {/* Edit Song Modal */}
      {editingSong && (
        <EditSongModal
          song={editingSong}
          onClose={() => setEditingSong(null)}
          onSave={async updatedSong => {
            try {
              await db.songs.update(updatedSong.id!, updatedSong)
              // Update the song in our local state
              setDbSongs(prev =>
                prev.map(s => (s.id === updatedSong.id ? updatedSong : s))
              )
              // Also update the displayed items
              setItems(prev =>
                prev.map(item => {
                  if (
                    item.type === 'song' &&
                    item.song?.id === updatedSong.id
                  ) {
                    return {
                      ...item,
                      song: dbSongToUISong(updatedSong),
                    }
                  }
                  return item
                })
              )
              setEditingSong(null)
              showToast('Song updated', 'success')
            } catch (error) {
              console.error('Error updating song:', error)
              showToast('Failed to update song', 'error')
            }
          }}
        />
      )}
    </ModernLayout>
  )
}
