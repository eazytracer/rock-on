import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { EntityHeader } from '../components/common/EntityHeader'
import { InlineEditableField } from '../components/common/InlineEditableField'
import { SHOW_STATUS_OPTIONS } from '../components/common/InlineStatusBadge'
import {
  SortableSongListItem,
  UISong,
  UISetlistItem,
  generateAvatarColor,
  generateInitials,
} from '../components/common/SongListItem'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useConfirm } from '../hooks/useConfirm'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { useToast } from '../contexts/ToastContext'
import { db } from '../services/database'
import { getSyncRepository } from '../services/data/SyncRepository'
import { secondsToDuration } from '../utils/formatters'
import {
  formatShowDate,
  formatTime12Hour,
  formatDateForInput,
  parseDateInputAsLocal,
  parseTime12Hour,
} from '../utils/dateHelpers'
import {
  Music,
  Phone,
  User,
  FileText,
  Mail,
  DollarSign,
  Clock,
  Plus,
  Trash2,
  MapPin,
} from 'lucide-react'
import type { Show, ShowContact } from '../models/Show'
import { DEFAULT_SHOW_DURATION } from '../models/Show'
import type { Setlist } from '../models/Setlist'
import type { Song } from '../models/Song'

// Convert database song to UI song
const dbSongToUISong = (dbSong: Song): UISong => {
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

// Contact Card Component for view mode
const ContactCard: React.FC<{
  contact: ShowContact
  index: number
  onRemove: () => void
}> = ({ contact, index, onRemove }) => {
  return (
    <div
      className="flex items-start gap-3 p-4 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a] group"
      data-testid={`contact-${index}`}
    >
      <div className="w-10 h-10 rounded-full bg-[#f17827ff]/10 border border-[#f17827ff]/30 flex items-center justify-center flex-shrink-0">
        <User size={20} className="text-[#f17827ff]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-white font-medium">{contact.name}</div>
          {contact.role && (
            <>
              <span className="text-[#505050]">•</span>
              <div className="text-sm text-[#a0a0a0]">{contact.role}</div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1.5 text-[#f17827ff] hover:underline"
            >
              <Phone size={14} />
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1.5 text-[#f17827ff] hover:underline"
            >
              <Mail size={14} />
              {contact.email}
            </a>
          )}
        </div>
      </div>
      {/* Hover actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button
          onClick={onRemove}
          className="p-1.5 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
          title="Remove contact"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// Editable Contact Card for inline editing
const EditableContactCard: React.FC<{
  contact: ShowContact
  index: number
  onChange: (contact: ShowContact) => void
  onRemove: () => void
  onBlur: () => void
}> = ({ contact, index, onChange, onRemove, onBlur }) => {
  return (
    <div
      className="p-4 bg-[#0f0f0f] rounded-lg border border-[#f17827ff]"
      data-testid={`edit-contact-${index}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={contact.name}
          onChange={e => onChange({ ...contact, name: e.target.value })}
          onBlur={onBlur}
          placeholder="Name *"
          className="px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
          autoFocus
        />
        <input
          type="text"
          value={contact.role || ''}
          onChange={e => onChange({ ...contact, role: e.target.value })}
          onBlur={onBlur}
          placeholder="Role (e.g., Venue Manager)"
          className="px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
        />
        <input
          type="tel"
          value={contact.phone || ''}
          onChange={e => onChange({ ...contact, phone: e.target.value })}
          onBlur={onBlur}
          placeholder="Phone"
          className="px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
        />
        <input
          type="email"
          value={contact.email || ''}
          onChange={e => onChange({ ...contact, email: e.target.value })}
          onBlur={onBlur}
          placeholder="Email"
          className="px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
        />
      </div>
      <div className="flex justify-end mt-2">
        <button
          onClick={onRemove}
          className="flex items-center gap-1 px-2 py-1 text-red-500 hover:text-red-400 text-xs"
        >
          <Trash2 size={14} />
          Remove
        </button>
      </div>
    </div>
  )
}

// Main ShowViewPage Component
export const ShowViewPage: React.FC = () => {
  const navigate = useNavigate()
  const { showId } = useParams<{ showId: string }>()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()

  // Detect "new" mode
  const isNewMode = !showId || showId === 'new'

  // Get IDs early for initialization
  const currentBandId = localStorage.getItem('currentBandId') || ''

  // Core state
  const [loading, setLoading] = useState(!isNewMode)
  const [show, setShow] = useState<Show | null>(() => {
    if (isNewMode) {
      const now = new Date()
      return {
        name: 'New Show',
        scheduledDate: now,
        status: 'scheduled' as const,
        duration: DEFAULT_SHOW_DURATION,
        bandId: currentBandId,
      } as Show
    }
    return null
  })
  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [setlistItems, setSetlistItems] = useState<UISetlistItem[]>([])
  const [availableSetlists, setAvailableSetlists] = useState<Setlist[]>([])

  // Contact editing state
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(
    null
  )
  const [contacts, setContacts] = useState<ShowContact[]>([])

  // Load show data
  const loadShow = useCallback(async () => {
    // Load available setlists for picker
    const allSetlists = await db.setlists
      .where('bandId')
      .equals(currentBandId)
      .toArray()
    setAvailableSetlists(allSetlists)

    // For new mode, show is already initialized
    if (isNewMode) {
      return
    }

    try {
      setLoading(true)
      const showData = await db.shows.get(showId)

      if (!showData) {
        navigate('/shows')
        return
      }

      setShow(showData)
      setContacts(showData.contacts || [])

      // Load setlist if linked
      if (showData.setlistId) {
        const setlistData = await db.setlists.get(showData.setlistId)
        if (setlistData) {
          setSetlist(setlistData)

          // Load songs from setlist
          const items: UISetlistItem[] = []
          for (const item of setlistData.items || []) {
            if (item.type === 'song' && item.songId) {
              const song = await db.songs.get(item.songId)
              if (song) {
                items.push({
                  id: item.id || crypto.randomUUID(),
                  type: 'song',
                  position: item.position,
                  song: dbSongToUISong(song),
                  songId: song.id!,
                  notes: item.notes,
                })
              }
            } else if (item.type === 'break') {
              items.push({
                id: item.id || crypto.randomUUID(),
                type: 'break',
                position: item.position,
                breakDuration: item.breakDuration,
                breakNotes: item.breakNotes,
              })
            } else if (item.type === 'section') {
              items.push({
                id: item.id || crypto.randomUUID(),
                type: 'section',
                position: item.position,
                sectionTitle: item.sectionTitle,
              })
            }
          }
          setSetlistItems(items)
        }
      }
    } catch (error) {
      console.error('Error loading show:', error)
      navigate('/shows')
    } finally {
      setLoading(false)
    }
  }, [showId, navigate, currentBandId, isNewMode])

  useEffect(() => {
    loadShow()
  }, [loadShow])

  // Subscribe to real-time sync events
  useRealtimeSync({
    events: ['shows:changed', 'setlists:changed', 'songs:changed'],
    bandId: currentBandId,
    onSync: loadShow,
  })

  // Save a single field
  const saveField = useCallback(
    async (field: keyof Show, value: unknown) => {
      if (isNewMode) {
        // For new mode, just update local state
        setShow(prev => (prev ? { ...prev, [field]: value } : prev))
        return
      }

      if (!showId) return

      try {
        const repo = getSyncRepository()
        await repo.updateShow(showId, {
          [field]: value,
          updatedDate: new Date(),
        })

        // Update local state
        setShow(prev => (prev ? { ...prev, [field]: value } : prev))
        showToast('Saved', 'success')
      } catch (error) {
        console.error('Error saving field:', error)
        showToast('Failed to save', 'error')
        throw error
      }
    },
    [showId, isNewMode, showToast]
  )

  // Save date and time combined
  const saveDateTime = useCallback(
    async (date: string, time: string) => {
      const baseDate = parseDateInputAsLocal(date)
      const scheduledDateTime = parseTime12Hour(time, baseDate)

      if (isNewMode) {
        setShow(prev =>
          prev ? { ...prev, scheduledDate: scheduledDateTime } : prev
        )
        return
      }

      if (!showId) return

      try {
        const repo = getSyncRepository()
        await repo.updateShow(showId, {
          scheduledDate: scheduledDateTime,
          updatedDate: new Date(),
        })
        setShow(prev =>
          prev ? { ...prev, scheduledDate: scheduledDateTime } : prev
        )
        showToast('Saved', 'success')
      } catch (error) {
        console.error('Error saving date/time:', error)
        showToast('Failed to save', 'error')
        throw error
      }
    },
    [showId, isNewMode, showToast]
  )

  // Save contacts
  const saveContacts = useCallback(
    async (newContacts: ShowContact[]) => {
      const filteredContacts = newContacts.filter(c => c.name.trim())

      if (isNewMode) {
        setContacts(filteredContacts)
        setShow(prev => (prev ? { ...prev, contacts: filteredContacts } : prev))
        return
      }

      if (!showId) return

      try {
        const repo = getSyncRepository()
        await repo.updateShow(showId, {
          contacts: filteredContacts,
          updatedDate: new Date(),
        })
        setContacts(filteredContacts)
        setShow(prev => (prev ? { ...prev, contacts: filteredContacts } : prev))
      } catch (error) {
        console.error('Error saving contacts:', error)
        showToast('Failed to save contacts', 'error')
      }
    },
    [showId, isNewMode, showToast]
  )

  // Handle setlist selection
  const handleSetlistChange = useCallback(
    async (setlistId: string) => {
      if (!setlistId) {
        // Clear setlist
        await saveField('setlistId', undefined)
        setSetlist(null)
        setSetlistItems([])
        return
      }

      // Fork the setlist if it's different from the current one
      const needsFork = isNewMode || setlistId !== show?.setlistId
      if (needsFork) {
        const originalSetlist = await db.setlists.get(setlistId)
        if (originalSetlist) {
          const forkedId = crypto.randomUUID()
          const forkedSetlist = {
            ...originalSetlist,
            id: forkedId,
            name: `${originalSetlist.name} (${show?.name || 'Show'})`,
            sourceSetlistId: setlistId,
            showId: undefined,
            createdDate: new Date(),
            lastModified: new Date(),
          }
          const repo = getSyncRepository()
          await repo.addSetlist(forkedSetlist)
          await saveField('setlistId', forkedId)
          setSetlist(forkedSetlist)

          // Load songs
          const items: UISetlistItem[] = []
          for (const item of originalSetlist.items || []) {
            if (item.type === 'song' && item.songId) {
              const song = await db.songs.get(item.songId)
              if (song) {
                items.push({
                  id: item.id || crypto.randomUUID(),
                  type: 'song',
                  position: item.position,
                  song: dbSongToUISong(song),
                  songId: song.id!,
                  notes: item.notes,
                })
              }
            }
          }
          setSetlistItems(items)
        }
      }
    },
    [isNewMode, show, saveField]
  )

  // Create a new empty setlist for this show
  const handleCreateNewSetlist = useCallback(async () => {
    try {
      const newSetlistId = crypto.randomUUID()
      const newSetlist: Setlist = {
        id: newSetlistId,
        name: `${show?.name || 'Show'} Setlist`,
        bandId: currentBandId,
        status: 'draft',
        items: [],
        totalDuration: 0,
        createdDate: new Date(),
        lastModified: new Date(),
      }

      const repo = getSyncRepository()
      await repo.addSetlist(newSetlist)
      await saveField('setlistId', newSetlistId)
      setSetlist(newSetlist)
      setSetlistItems([])

      showToast('Setlist created. Add songs to build your setlist.', 'success')
    } catch (error) {
      console.error('Error creating setlist:', error)
      showToast('Failed to create setlist', 'error')
    }
  }, [show?.name, currentBandId, saveField, showToast])

  // Create new show (for new mode)
  const createShow = useCallback(async () => {
    if (!show) return

    try {
      const newId = crypto.randomUUID()
      const repo = getSyncRepository()
      await repo.addShow({
        ...show,
        id: newId,
        bandId: currentBandId,
        contacts: contacts,
        createdDate: new Date(),
        updatedDate: new Date(),
      })

      showToast('Show created', 'success')
      navigate(`/shows/${newId}`, { replace: true })
    } catch (error) {
      console.error('Error creating show:', error)
      showToast('Failed to create show', 'error')
    }
  }, [show, contacts, currentBandId, showToast, navigate])

  // Contact management
  const addContact = () => {
    const newContact: ShowContact = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      phone: '',
      email: '',
    }
    const newContacts = [...contacts, newContact]
    setContacts(newContacts)
    setEditingContactIndex(newContacts.length - 1)
  }

  const updateContact = (index: number, contact: ShowContact) => {
    const newContacts = [...contacts]
    newContacts[index] = contact
    setContacts(newContacts)
  }

  const finishEditingContact = () => {
    setEditingContactIndex(null)
    saveContacts(contacts)
  }

  const removeContact = async (index: number) => {
    const contact = contacts[index]
    if (contact.name) {
      const confirmed = await confirm({
        title: 'Remove Contact',
        message: `Remove "${contact.name}" from this show?`,
        variant: 'warning',
        confirmLabel: 'Remove',
      })
      if (!confirmed) return
    }
    const newContacts = contacts.filter((_, i) => i !== index)
    setContacts(newContacts)
    saveContacts(newContacts)
    if (editingContactIndex === index) {
      setEditingContactIndex(null)
    }
  }

  if (!show) return null

  // Display values
  const showDate = new Date(show.scheduledDate)
  const formattedDate = formatDateForInput(showDate)
  const formattedTime = formatTime12Hour(showDate)
  const dateLabel = formatShowDate(showDate)

  // Calculate total setlist duration
  const totalDuration = setlistItems.reduce((sum, item) => {
    if (item.type === 'song' && item.song) {
      return sum + item.song.durationSeconds
    }
    return sum
  }, 0)

  return (
    <ContentLoadingSpinner isLoading={loading}>
      <div data-testid="show-view-page">
        {/* Header with inline editing */}
        <EntityHeader
          backPath="/shows"
          title={show.name}
          onTitleSave={val => saveField('name', String(val))}
          titlePlaceholder="Show name"
          entityType="show"
          date={formattedDate}
          time={formattedTime}
          dateLabel={dateLabel}
          timeLabel={formattedTime}
          onDateSave={val => saveDateTime(String(val), formattedTime)}
          onTimeSave={val => saveDateTime(formattedDate, String(val))}
          venue={show.venue}
          location={show.location}
          onVenueSave={val => saveField('venue', String(val) || undefined)}
          status={{
            value: show.status,
            onSave: val => saveField('status', val as Show['status']),
            options: SHOW_STATUS_OPTIONS,
          }}
          isNew={isNewMode}
          data-testid="show"
        />

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* New mode save button */}
          {isNewMode && (
            <div className="bg-[#121212] border border-[#f17827ff] rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Creating new show</p>
                <p className="text-sm text-[#707070]">
                  Click any field above to edit, then save when ready
                </p>
              </div>
              <button
                onClick={createShow}
                className="px-4 py-2 bg-[#f17827ff] hover:bg-[#d66920] text-white font-medium rounded-lg transition-colors"
                data-testid="create-show-button"
              >
                Create Show
              </button>
            </div>
          )}

          {/* Additional Details Section */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Address */}
              <InlineEditableField
                label="Address"
                value={show.location || ''}
                displayValue={show.location || undefined}
                onSave={val => saveField('location', String(val) || undefined)}
                placeholder="Add address"
                icon={<MapPin size={16} />}
                autoEdit={isNewMode}
                name="location"
                data-testid="show-location"
              />

              {/* Load-in Time */}
              <InlineEditableField
                label="Load-in Time"
                value={show.loadInTime || ''}
                onSave={val =>
                  saveField('loadInTime', String(val) || undefined)
                }
                type="time"
                placeholder="Add load-in time"
                icon={<Clock size={16} />}
                data-testid="show-load-in"
              />

              {/* Soundcheck Time */}
              <InlineEditableField
                label="Soundcheck"
                value={show.soundcheckTime || ''}
                onSave={val =>
                  saveField('soundcheckTime', String(val) || undefined)
                }
                type="time"
                placeholder="Add soundcheck time"
                icon={<Clock size={16} />}
                data-testid="show-soundcheck"
              />

              {/* Set Duration */}
              <InlineEditableField
                label="Set Duration"
                value={show.duration || DEFAULT_SHOW_DURATION}
                displayValue={
                  show.duration ? `${show.duration} minutes` : undefined
                }
                onSave={val =>
                  saveField(
                    'duration',
                    parseInt(String(val)) || DEFAULT_SHOW_DURATION
                  )
                }
                placeholder="Duration in minutes"
                data-testid="show-duration"
              />

              {/* Payment */}
              <InlineEditableField
                label="Payment"
                value={show.payment ? String(show.payment / 100) : ''}
                displayValue={
                  show.payment
                    ? `$${(show.payment / 100).toFixed(2)}`
                    : undefined
                }
                onSave={val =>
                  saveField(
                    'payment',
                    val ? Math.round(parseFloat(String(val)) * 100) : undefined
                  )
                }
                placeholder="Amount in dollars"
                icon={<DollarSign size={16} />}
                data-testid="show-payment"
              />
            </div>

            {/* Notes - Full Width */}
            <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
              <InlineEditableField
                label="Notes"
                value={show.notes || ''}
                onSave={val => saveField('notes', String(val) || undefined)}
                type="textarea"
                placeholder="Add notes, special instructions..."
                icon={<FileText size={16} />}
                data-testid="show-notes"
              />
            </div>
          </div>

          {/* Contacts Section */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Contacts</h2>
              <button
                onClick={addContact}
                className="flex items-center gap-1 px-3 py-1.5 text-[#f17827ff] hover:bg-[#f17827ff]/10 rounded-lg transition-colors text-sm"
                data-testid="add-contact-button"
              >
                <Plus size={16} />
                Add Contact
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-8 text-[#707070]">
                <User size={32} className="mx-auto mb-2 text-[#505050]" />
                <p className="text-sm">No contacts added</p>
                <button
                  onClick={addContact}
                  className="mt-2 text-[#f17827ff] hover:underline text-sm"
                >
                  Add a contact
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, index) =>
                  editingContactIndex === index ? (
                    <EditableContactCard
                      key={contact.id}
                      contact={contact}
                      index={index}
                      onChange={c => updateContact(index, c)}
                      onRemove={() => removeContact(index)}
                      onBlur={finishEditingContact}
                    />
                  ) : (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      index={index}
                      onRemove={() => removeContact(index)}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* Setlist Section - Always visible */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Setlist</h2>
              {setlist && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#a0a0a0]">
                    {setlistItems.filter(i => i.type === 'song').length} songs
                  </span>
                  <span className="text-sm text-[#a0a0a0]">
                    {secondsToDuration(totalDuration)}
                  </span>
                  <button
                    onClick={() => navigate(`/setlists/${setlist.id}`)}
                    data-testid="edit-setlist-button"
                    className="px-3 py-1.5 text-sm bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg hover:bg-[#252525] hover:border-[#3a3a3a] transition-colors"
                  >
                    Edit Setlist
                  </button>
                </div>
              )}
            </div>

            {/* Setlist Selector - shown when no setlist attached */}
            {!setlist ? (
              <div className="flex flex-col items-center py-8">
                <Music size={48} className="text-[#2a2a2a] mb-3" />
                <p className="text-[#707070] mb-4">No setlist attached</p>
                <div className="w-full max-w-md">
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value === '__create_new__') {
                        handleCreateNewSetlist()
                      } else if (e.target.value) {
                        handleSetlistChange(e.target.value)
                      }
                    }}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:border-[#f17827ff] focus:outline-none"
                    data-testid="show-setlist-select"
                  >
                    <option value="">Select a setlist...</option>
                    <option value="__create_new__">+ Create new setlist</option>
                    {availableSetlists.length > 0 && (
                      <option disabled>───────────</option>
                    )}
                    {availableSetlists.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                {/* Setlist Info */}
                <div className="flex items-center gap-3 mb-4 p-4 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
                  <Music size={20} className="text-[#f17827ff]" />
                  <div className="flex-1">
                    <div className="text-white font-medium">{setlist.name}</div>
                    {setlist.notes && (
                      <div className="text-xs text-[#a0a0a0] mt-1">
                        {setlist.notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleSetlistChange('')}
                    className="text-xs text-[#707070] hover:text-white transition-colors"
                    data-testid="remove-setlist-button"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs text-[#505050] mb-4">
                  This is a copy for this show. Changes won't affect the
                  original setlist.
                </p>

                {/* Songs List */}
                <div className="space-y-2" data-testid="setlist-songs">
                  {setlistItems.length > 0 ? (
                    setlistItems.map((item, index) => {
                      // Calculate song number (only count songs, not breaks/sections)
                      const songNumber =
                        item.type === 'song'
                          ? setlistItems
                              .slice(0, index + 1)
                              .filter(i => i.type === 'song').length
                          : undefined

                      return (
                        <SortableSongListItem
                          key={item.id}
                          item={item}
                          isEditing={false}
                          songNumber={songNumber}
                        />
                      )
                    })
                  ) : (
                    <div className="text-center py-8 text-[#707070]">
                      No songs in this setlist
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog {...dialogProps} />
      </div>
    </ContentLoadingSpinner>
  )
}
