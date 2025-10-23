import React, { useState } from 'react'
import { ModernLayout } from '../../components/layout/ModernLayout'
import { TimePicker } from '../../components/common/TimePicker'
import { DurationPicker } from '../../components/common/DurationPicker'
import {
  ChevronDown,
  Plus,
  Clock,
  MapPin,
  Music,
  Calendar,
  MoreVertical,
  X,
  Check,
  AlertCircle,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Search
} from 'lucide-react'

// ===== INTERFACES =====

interface PracticeSong {
  songId: string
  position: number
}

interface Practice {
  id: string
  bandId: string
  scheduledDate: Date
  duration: number // minutes
  location?: string
  type: 'rehearsal'
  status: 'scheduled' | 'completed' | 'cancelled'
  songs: PracticeSong[]
  notes?: string
  createdDate: Date
  lastModified: Date
}

interface Song {
  id: string
  title: string
  artist: string
  duration: string
  key: string
  tuning: string
  bpm: string
}

interface Show {
  id: string
  name: string
  date: Date
  songs: string[]
}

// ===== MOCK DATA =====

const mockSongs: Song[] = [
  {
    id: 's1',
    title: 'All Star',
    artist: 'Smash Mouth',
    duration: '3:14',
    key: 'F#',
    tuning: 'Standard',
    bpm: '104'
  },
  {
    id: 's2',
    title: 'Man in the Box',
    artist: 'Alice In Chains',
    duration: '4:47',
    key: 'Ebm',
    tuning: 'Half-step down',
    bpm: '108'
  },
  {
    id: 's3',
    title: 'No Rain',
    artist: 'Blind Melon',
    duration: '3:33',
    key: 'E',
    tuning: 'Standard',
    bpm: '150'
  },
  {
    id: 's4',
    title: 'Monkey Wrench',
    artist: 'Foo Fighters',
    duration: '3:51',
    key: 'B',
    tuning: 'Dropped D',
    bpm: '175'
  },
  {
    id: 's5',
    title: 'Everlong',
    artist: 'Foo Fighters',
    duration: '4:10',
    key: 'D',
    tuning: 'Dropped D',
    bpm: '158'
  },
  {
    id: 's6',
    title: 'Plush',
    artist: 'Stone Temple Pilots',
    duration: '5:13',
    key: 'G',
    tuning: 'Half-step down',
    bpm: '78'
  }
]

const mockShows: Show[] = [
  {
    id: 'sh1',
    name: 'Toys 4 Tots',
    date: new Date('2025-12-08'),
    songs: ['s1', 's2', 's3', 's4']
  },
  {
    id: 'sh2',
    name: 'New Years Eve Bash',
    date: new Date('2025-12-31'),
    songs: ['s5', 's6', 's1']
  }
]

const mockPractices: Practice[] = [
  {
    id: 'p1',
    bandId: 'band1',
    scheduledDate: new Date('2025-10-25T19:00:00'),
    duration: 120,
    location: 'Dave\'s Garage',
    type: 'rehearsal',
    status: 'scheduled',
    songs: [
      { songId: 's1', position: 0 },
      { songId: 's2', position: 1 },
      { songId: 's3', position: 2 },
      { songId: 's4', position: 3 }
    ],
    notes: 'Focus on transitions between songs. Toys 4 Tots show prep!',
    createdDate: new Date('2025-10-20'),
    lastModified: new Date('2025-10-20')
  },
  {
    id: 'p2',
    bandId: 'band1',
    scheduledDate: new Date('2025-10-28T18:30:00'),
    duration: 150,
    location: 'Studio B',
    type: 'rehearsal',
    status: 'scheduled',
    songs: [
      { songId: 's1', position: 0 },
      { songId: 's2', position: 1 },
      { songId: 's3', position: 2 },
      { songId: 's4', position: 3 }
    ],
    notes: 'Full setlist run-through for Toys 4 Tots',
    createdDate: new Date('2025-10-21'),
    lastModified: new Date('2025-10-21')
  },
  {
    id: 'p3',
    bandId: 'band1',
    scheduledDate: new Date('2025-11-02T19:00:00'),
    duration: 120,
    location: 'Dave\'s Garage',
    type: 'rehearsal',
    status: 'scheduled',
    songs: [
      { songId: 's5', position: 0 },
      { songId: 's6', position: 1 }
    ],
    notes: 'Working on new material',
    createdDate: new Date('2025-10-22'),
    lastModified: new Date('2025-10-22')
  },
  {
    id: 'p4',
    bandId: 'band1',
    scheduledDate: new Date('2025-10-18T19:00:00'),
    duration: 120,
    location: 'Studio B',
    type: 'rehearsal',
    status: 'completed',
    songs: [
      { songId: 's1', position: 0 },
      { songId: 's4', position: 1 }
    ],
    notes: 'Worked on timing',
    createdDate: new Date('2025-10-15'),
    lastModified: new Date('2025-10-18')
  },
  {
    id: 'p5',
    bandId: 'band1',
    scheduledDate: new Date('2025-10-15T18:00:00'),
    duration: 90,
    location: 'Dave\'s Garage',
    type: 'rehearsal',
    status: 'completed',
    songs: [
      { songId: 's2', position: 0 },
      { songId: 's3', position: 1 },
      { songId: 's5', position: 2 }
    ],
    notes: 'Great energy today!',
    createdDate: new Date('2025-10-12'),
    lastModified: new Date('2025-10-15')
  },
  {
    id: 'p6',
    bandId: 'band1',
    scheduledDate: new Date('2025-10-12T19:30:00'),
    duration: 120,
    location: 'Studio B',
    type: 'rehearsal',
    status: 'cancelled',
    songs: [
      { songId: 's1', position: 0 }
    ],
    notes: 'Drummer was sick',
    createdDate: new Date('2025-10-10'),
    lastModified: new Date('2025-10-12')
  }
]

// ===== MODAL COMPONENTS =====

interface SchedulePracticeModalProps {
  isOpen: boolean
  onClose: () => void
  practice?: Practice
  onSave: (practice: Omit<Practice, 'id' | 'bandId' | 'createdDate' | 'lastModified'>) => void
}

const SchedulePracticeModal: React.FC<SchedulePracticeModalProps> = ({
  isOpen,
  onClose,
  practice,
  onSave
}) => {
  const [formData, setFormData] = useState({
    date: practice?.scheduledDate.toISOString().split('T')[0] || '',
    time: practice?.scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) || '',
    duration: practice?.duration || 120,
    location: practice?.location || '',
    notes: practice?.notes || '',
    selectedSongs: practice?.songs.map(s => s.songId) || []
  })

  const [songSearchQuery, setShowSongSearch] = useState(false)
  const [songFilter, setSongFilter] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Parse time from 12-hour format to create proper Date
    const timeMatch = formData.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    let datetime: Date

    if (timeMatch) {
      let hours = parseInt(timeMatch[1])
      const minutes = parseInt(timeMatch[2])
      const period = timeMatch[3].toUpperCase()

      if (period === 'PM' && hours !== 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0

      datetime = new Date(formData.date)
      datetime.setHours(hours, minutes, 0, 0)
    } else {
      // Fallback for 24-hour format or invalid input
      datetime = new Date(`${formData.date}T${formData.time}`)
    }

    onSave({
      scheduledDate: datetime,
      duration: formData.duration,
      location: formData.location,
      type: 'rehearsal',
      status: 'scheduled',
      songs: formData.selectedSongs.map((songId, index) => ({
        songId,
        position: index
      })),
      notes: formData.notes
    })
    onClose()
  }

  const handleAddFromShow = (show: Show) => {
    setFormData(prev => ({
      ...prev,
      selectedSongs: [...new Set([...prev.selectedSongs, ...show.songs])]
    }))
  }

  const toggleSong = (songId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSongs: prev.selectedSongs.includes(songId)
        ? prev.selectedSongs.filter(id => id !== songId)
        : [...prev.selectedSongs, songId]
    }))
  }

  const removeSong = (songId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSongs: prev.selectedSongs.filter(id => id !== songId)
    }))
  }

  const selectedSongObjects = formData.selectedSongs
    .map(id => mockSongs.find(s => s.id === id))
    .filter(Boolean) as Song[]

  const nextShow = mockShows
    .filter(show => show.date > new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0]

  const filteredSongs = mockSongs.filter(song =>
    song.title.toLowerCase().includes(songFilter.toLowerCase()) ||
    song.artist.toLowerCase().includes(songFilter.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white font-medium">Practices</span>
            <span className="text-[#707070]">&gt;</span>
            <span className="text-[#a0a0a0]">{practice ? 'Edit Practice' : 'Schedule Practice'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#707070] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Info Section */}
          <div className="mb-6">
            <h3 className="text-white font-semibold text-sm mb-4">Basic Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Date <span className="text-[#f17827ff]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Time <span className="text-[#f17827ff]">*</span>
                </label>
                <TimePicker
                  value={formData.time}
                  onChange={(time) => setFormData(prev => ({ ...prev, time }))}
                  placeholder="Select time"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">Duration</label>
                <DurationPicker
                  value={formData.duration}
                  onChange={(minutes) => setFormData(prev => ({ ...prev, duration: minutes }))}
                  placeholder="Select duration"
                  mode="duration"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Dave's Garage"
                  className="w-full h-10 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm text-[#a0a0a0] mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any notes about this practice..."
                rows={3}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 resize-none"
              />
            </div>
          </div>

          {/* Songs Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Songs to Practice</h3>
              {nextShow && (
                <button
                  type="button"
                  onClick={() => handleAddFromShow(nextShow)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-[#f17827ff] text-xs font-medium hover:bg-[#252525] transition-colors"
                >
                  <Calendar size={14} />
                  Add from {nextShow.name}
                </button>
              )}
            </div>

            {/* Selected Songs */}
            {selectedSongObjects.length > 0 && (
              <div className="mb-3 space-y-2">
                {selectedSongObjects.map((song, index) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2a2a2a] text-[#a0a0a0] text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">{song.title}</div>
                      <div className="text-[#707070] text-xs">{song.artist} • {song.duration}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSong(song.id)}
                      className="p-1 text-[#707070] hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Songs Button */}
            <button
              type="button"
              onClick={() => setShowSongSearch(!songSearchQuery)}
              className="w-full h-10 flex items-center justify-center gap-2 border border-dashed border-[#2a2a2a] rounded-lg text-[#a0a0a0] text-sm hover:border-[#f17827ff] hover:text-[#f17827ff] transition-colors"
            >
              <Plus size={16} />
              Add Songs
            </button>

            {/* Song Selector */}
            {songSearchQuery && (
              <div className="mt-3 p-4 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg">
                <div className="mb-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
                    <input
                      type="text"
                      placeholder="Search songs..."
                      value={songFilter}
                      onChange={(e) => setSongFilter(e.target.value)}
                      className="w-full h-9 pl-10 pr-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredSongs.map(song => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => toggleSong(song.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-left"
                    >
                      <div className={`flex items-center justify-center w-5 h-5 rounded border ${
                        formData.selectedSongs.includes(song.id)
                          ? 'bg-[#f17827ff] border-[#f17827ff]'
                          : 'border-[#2a2a2a]'
                      }`}>
                        {formData.selectedSongs.includes(song.id) && (
                          <Check size={12} className="text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-sm">{song.title}</div>
                        <div className="text-[#707070] text-xs">{song.artist}</div>
                      </div>
                      <div className="text-[#707070] text-xs">{song.duration}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSongObjects.length > 0 && (
              <div className="mt-3 text-xs text-[#707070]">
                {selectedSongObjects.length} song{selectedSongObjects.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#2a2a2a]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66920] transition-colors"
            >
              {practice ? 'Save Changes' : 'Schedule Practice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  practiceName: string
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  practiceName
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <h3 className="text-white font-semibold text-lg">Delete Practice</h3>
          </div>
          <p className="text-[#a0a0a0] text-sm mb-6">
            Are you sure you want to delete the practice on <span className="text-white font-medium">{practiceName}</span>? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== MAIN COMPONENT =====

export const PracticesPage: React.FC = () => {
  const [practices, setPractices] = useState<Practice[]>(mockPractices)
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null)
  const [deleteConfirmPractice, setDeleteConfirmPractice] = useState<Practice | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const now = new Date()

  // Filter practices
  const filteredPractices = practices
    .filter(practice => {
      if (filter === 'upcoming') return practice.scheduledDate > now && practice.status === 'scheduled'
      if (filter === 'past') return practice.scheduledDate <= now || practice.status === 'completed'
      return true
    })
    .sort((a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime())

  const upcomingPractices = practices.filter(
    p => p.scheduledDate > now && p.status === 'scheduled'
  ).sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())

  const nextPractice = upcomingPractices[0]

  const handleSavePractice = (practiceData: Omit<Practice, 'id' | 'bandId' | 'createdDate' | 'lastModified'>) => {
    if (editingPractice) {
      // Update existing
      setPractices(prev =>
        prev.map(p =>
          p.id === editingPractice.id
            ? {
                ...p,
                ...practiceData,
                lastModified: new Date()
              }
            : p
        )
      )
      setEditingPractice(null)
    } else {
      // Create new
      const newPractice: Practice = {
        ...practiceData,
        id: `p${Date.now()}`,
        bandId: 'band1',
        createdDate: new Date(),
        lastModified: new Date()
      }
      setPractices(prev => [...prev, newPractice])
    }
    setIsScheduleModalOpen(false)
  }

  const handleDeletePractice = (id: string) => {
    setPractices(prev => prev.filter(p => p.id !== id))
  }

  const handleMarkComplete = (id: string) => {
    setPractices(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, status: 'completed' as const, lastModified: new Date() }
          : p
      )
    )
    setOpenMenuId(null)
  }

  const handleCancelPractice = (id: string) => {
    setPractices(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, status: 'cancelled' as const, lastModified: new Date() }
          : p
      )
    )
    setOpenMenuId(null)
  }

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
    return date.toLocaleDateString('en-US', options)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const getSongsForPractice = (practice: Practice) => {
    return practice.songs
      .sort((a, b) => a.position - b.position)
      .map(ps => mockSongs.find(s => s.id === ps.songId))
      .filter(Boolean) as Song[]
  }

  const getStatusBadge = (status: Practice['status']) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="px-2 py-1 bg-[#f17827ff]/10 text-[#f17827ff] text-xs font-medium rounded-md">
            Scheduled
          </span>
        )
      case 'completed':
        return (
          <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded-md">
            Completed
          </span>
        )
      case 'cancelled':
        return (
          <span className="px-2 py-1 bg-red-500/10 text-red-500 text-xs font-medium rounded-md">
            Cancelled
          </span>
        )
    }
  }

  return (
    <ModernLayout bandName="iPod Shuffle" userEmail="eric@example.com">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold text-white">Practices</h1>
          <ChevronDown size={20} className="text-[#a0a0a0]" />
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Filter Dropdown */}
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'upcoming' | 'past' | 'all')}
              className="h-10 pl-4 pr-10 bg-transparent border border-[#2a2a2a] rounded-lg text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors appearance-none cursor-pointer"
            >
              <option value="upcoming" className="bg-[#1a1a1a]">Upcoming</option>
              <option value="past" className="bg-[#1a1a1a]">Past</option>
              <option value="all" className="bg-[#1a1a1a]">All</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707070] pointer-events-none" />
          </div>

          {/* Schedule Practice Button */}
          <button
            onClick={() => {
              setEditingPractice(null)
              setIsScheduleModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors ml-auto"
          >
            <Plus size={20} />
            <span>Schedule Practice</span>
          </button>
        </div>
      </div>

      {/* Next Practice Highlight */}
      {nextPractice && filter === 'upcoming' && (
        <div className="mb-6 p-5 bg-gradient-to-r from-[#f17827ff]/10 to-transparent border border-[#f17827ff]/20 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-[#f17827ff]" />
                <span className="text-[#f17827ff] text-xs font-semibold uppercase tracking-wider">
                  Next Practice
                </span>
              </div>
              <div className="text-white font-semibold text-lg mb-1">
                {formatDate(nextPractice.scheduledDate)} at {formatTime(nextPractice.scheduledDate)}
              </div>
              <div className="flex items-center gap-4 text-sm text-[#a0a0a0]">
                {nextPractice.location && (
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    {nextPractice.location}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  {nextPractice.duration} min
                </div>
                <div className="flex items-center gap-1">
                  <Music size={14} />
                  {nextPractice.songs.length} songs
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Practices List */}
      {filteredPractices.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#1a1a1a] mb-4">
            <Calendar size={32} className="text-[#707070]" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">No practices scheduled</h3>
          <p className="text-[#a0a0a0] text-sm mb-6">Schedule your first practice to get started</p>
          <button
            onClick={() => {
              setEditingPractice(null)
              setIsScheduleModalOpen(true)
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f17827ff] text-white text-sm font-medium hover:bg-[#d66920] transition-colors"
          >
            <Plus size={20} />
            Schedule Practice
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPractices.map((practice) => {
            const songs = getSongsForPractice(practice)
            const isNextPractice = practice.id === nextPractice?.id

            return (
              <div
                key={practice.id}
                className={`p-5 bg-[#1a1a1a] rounded-xl border transition-all ${
                  isNextPractice
                    ? 'border-[#f17827ff]/30'
                    : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  {/* Left: Date Badge */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] rounded-lg ${
                        practice.status === 'scheduled'
                          ? 'bg-[#f17827ff]/10 border border-[#f17827ff]/20'
                          : practice.status === 'completed'
                          ? 'bg-green-500/10 border border-green-500/20'
                          : 'bg-[#2a2a2a] border border-[#3a3a3a]'
                      }`}
                    >
                      <div
                        className={`text-xs font-semibold uppercase ${
                          practice.status === 'scheduled'
                            ? 'text-[#f17827ff]'
                            : practice.status === 'completed'
                            ? 'text-green-500'
                            : 'text-[#707070]'
                        }`}
                      >
                        {practice.scheduledDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div
                        className={`text-2xl font-bold ${
                          practice.status === 'scheduled'
                            ? 'text-[#f17827ff]'
                            : practice.status === 'completed'
                            ? 'text-green-500'
                            : 'text-[#707070]'
                        }`}
                      >
                        {practice.scheduledDate.getDate()}
                      </div>
                    </div>

                    {/* Practice Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-white font-semibold text-base">
                          {formatDate(practice.scheduledDate)}
                        </h3>
                        {getStatusBadge(practice.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#a0a0a0] mb-3">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          {formatTime(practice.scheduledDate)} • {practice.duration} min
                        </div>
                        {practice.location && (
                          <div className="flex items-center gap-1">
                            <MapPin size={14} />
                            {practice.location}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Music size={14} />
                          {songs.length} song{songs.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {practice.notes && (
                        <p className="text-sm text-[#a0a0a0] mb-3">{practice.notes}</p>
                      )}

                      {/* Song List */}
                      {songs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {songs.map((song, index) => (
                            <div
                              key={`${practice.id}-${song.id}`}
                              className="flex items-center gap-2 px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-xs"
                            >
                              <span className="text-[#707070] font-semibold">{index + 1}.</span>
                              <span className="text-white">{song.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === practice.id ? null : practice.id)}
                      className="p-2 text-[#707070] hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
                    >
                      <MoreVertical size={20} />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === practice.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-10">
                        <button
                          onClick={() => {
                            setEditingPractice(practice)
                            setIsScheduleModalOpen(true)
                            setOpenMenuId(null)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-white text-sm hover:bg-[#252525] transition-colors"
                        >
                          <Edit2 size={16} />
                          Edit
                        </button>
                        {practice.status === 'scheduled' && (
                          <button
                            onClick={() => handleMarkComplete(practice.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-white text-sm hover:bg-[#252525] transition-colors"
                          >
                            <CheckCircle size={16} />
                            Mark as Completed
                          </button>
                        )}
                        {practice.status === 'scheduled' && (
                          <button
                            onClick={() => handleCancelPractice(practice.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-white text-sm hover:bg-[#252525] transition-colors border-t border-[#2a2a2a]"
                          >
                            <XCircle size={16} />
                            Cancel Practice
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDeleteConfirmPractice(practice)
                            setOpenMenuId(null)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-500 text-sm hover:bg-[#252525] transition-colors border-t border-[#2a2a2a]"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Schedule Practice Modal */}
      <SchedulePracticeModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false)
          setEditingPractice(null)
        }}
        practice={editingPractice || undefined}
        onSave={handleSavePractice}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirmPractice !== null}
        onClose={() => setDeleteConfirmPractice(null)}
        onConfirm={() => {
          if (deleteConfirmPractice) {
            handleDeletePractice(deleteConfirmPractice.id)
            setDeleteConfirmPractice(null)
          }
        }}
        practiceName={
          deleteConfirmPractice
            ? formatDate(deleteConfirmPractice.scheduledDate)
            : ''
        }
      />
    </ModernLayout>
  )
}
