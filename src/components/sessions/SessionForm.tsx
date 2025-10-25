import React, { useState, useRef } from 'react'
import { PracticeSession } from '../../models/PracticeSession'
import { Song } from '../../models/Song'
import { Member } from '../../models/Member'
import { SessionType } from '../../types'
import { TouchButton } from '../common/TouchButton'
import { SearchBar } from '../common/SearchBar'

interface SessionFormProps {
  onSubmit: (sessionData: Omit<PracticeSession, 'id' | 'status' | 'startTime' | 'endTime' | 'songs' | 'attendees' | 'completedObjectives' | 'sessionRating' | 'createdDate' | 'lastModified'> & {
    songIds: string[]
    inviteeIds: string[]
  }) => void
  onCancel: () => void
  songs: Song[]
  members: Member[]
  initialData?: Partial<PracticeSession>
  loading?: boolean
}

interface FormErrors {
  scheduledDate?: string
  duration?: string
  type?: string
  location?: string
}

const SESSION_TYPES: { value: SessionType; label: string; description: string }[] = [
  { value: 'rehearsal', label: 'Rehearsal', description: 'Practice songs for upcoming show' },
  { value: 'writing', label: 'Writing', description: 'Create new songs and arrangements' },
  { value: 'recording', label: 'Recording', description: 'Record songs for album or demo' },
  { value: 'audition', label: 'Audition', description: 'Try out new members or songs' },
  { value: 'lesson', label: 'Lesson', description: 'Learn techniques or theory' }
]

export const SessionForm: React.FC<SessionFormProps> = ({
  onSubmit,
  onCancel,
  songs,
  members,
  initialData,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    bandId: initialData?.bandId || '',
    scheduledDate: initialData?.scheduledDate ? new Date(initialData.scheduledDate).toISOString().slice(0, 16) : '',
    duration: initialData?.duration || 120,
    location: initialData?.location || '',
    type: initialData?.type || 'rehearsal' as SessionType,
    notes: initialData?.notes || '',
    objectives: initialData?.objectives || []
  })

  const [selectedSongs, setSelectedSongs] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    members.map(m => m.id)
  )
  const [songSearch, setSongSearch] = useState('')
  const [newObjective, setNewObjective] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const formRef = useRef<HTMLFormElement>(null)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.scheduledDate) {
      newErrors.scheduledDate = 'Session date and time is required'
    } else {
      const sessionDate = new Date(formData.scheduledDate)
      if (sessionDate < new Date()) {
        newErrors.scheduledDate = 'Session must be scheduled for a future date'
      }
    }

    if (formData.duration < 15) {
      newErrors.duration = 'Duration must be at least 15 minutes'
    } else if (formData.duration > 480) {
      newErrors.duration = 'Duration cannot exceed 8 hours'
    }

    if (!formData.type) {
      newErrors.type = 'Session type is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      const firstErrorField = formRef.current?.querySelector('[data-error="true"]') as HTMLElement
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      firstErrorField?.focus()
      return
    }

    const sessionData = {
      bandId: formData.bandId,
      scheduledDate: new Date(formData.scheduledDate),
      duration: formData.duration,
      location: formData.location.trim() || undefined,
      type: formData.type,
      notes: formData.notes.trim() || undefined,
      objectives: formData.objectives,
      songIds: selectedSongs,
      inviteeIds: selectedMembers
    }

    onSubmit(sessionData)
  }

  const handleInputChange = (field: string, value: string | number | SessionType | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const toggleSong = (songId: string) => {
    setSelectedSongs(prev =>
      prev.includes(songId)
        ? prev.filter(id => id !== songId)
        : [...prev, songId]
    )
  }

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  const addObjective = () => {
    if (newObjective.trim()) {
      setFormData(prev => ({
        ...prev,
        objectives: [...prev.objectives, newObjective.trim()]
      }))
      setNewObjective('')
    }
  }

  const removeObjective = (index: number) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives.filter((_, i) => i !== index)
    }))
  }

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(songSearch.toLowerCase()) ||
    song.artist.toLowerCase().includes(songSearch.toLowerCase())
  )

  const getMinDateTime = () => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Edit Practice Session' : 'Schedule Practice Session'}
          </h2>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledDate}
                onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                min={getMinDateTime()}
                className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.scheduledDate ? 'border-red-500' : 'border-gray-300'
                }`}
                data-error={!!errors.scheduledDate}
              />
              {errors.scheduledDate && (
                <p className="mt-1 text-sm text-red-600">{errors.scheduledDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 120)}
                  className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.duration ? 'border-red-500' : 'border-gray-300'
                  }`}
                  data-error={!!errors.duration}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 text-sm">
                  {Math.floor(formData.duration / 60)}h {formData.duration % 60}m
                </div>
              </div>
              {errors.duration && (
                <p className="mt-1 text-sm text-red-600">{errors.duration}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.type ? 'border-red-500' : 'border-gray-300'
                }`}
                data-error={!!errors.type}
              >
                {SESSION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-600">{errors.type}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.location ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Practice space, studio, etc."
                data-error={!!errors.location}
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">{errors.location}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Any additional notes for this session..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Objectives
            </label>
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addObjective()
                  }
                }}
                className="flex-1 min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add practice objective..."
              />
              <TouchButton
                type="button"
                variant="secondary"
                size="md"
                onClick={addObjective}
                disabled={!newObjective.trim()}
              >
                Add
              </TouchButton>
            </div>
            {formData.objectives.length > 0 && (
              <div className="space-y-2">
                {formData.objectives.map((objective, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-900">{objective}</span>
                    <button
                      type="button"
                      onClick={() => removeObjective(index)}
                      className="text-red-600 hover:text-red-800 transition-colors p-1"
                      aria-label="Remove objective"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Songs to Practice ({selectedSongs.length} selected)
            </label>
            <SearchBar
              value={songSearch}
              onChange={setSongSearch}
              placeholder="Search songs..."
              className="mb-3"
            />
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredSongs.map(song => (
                <div
                  key={song.id}
                  className="flex items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    id={`song-${song.id}`}
                    checked={selectedSongs.includes(song.id)}
                    onChange={() => toggleSong(song.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded touch-manipulation"
                  />
                  <label
                    htmlFor={`song-${song.id}`}
                    className="ml-3 flex-1 cursor-pointer"
                  >
                    <div className="font-medium text-gray-900">{song.title}</div>
                    <div className="text-sm text-gray-500">{song.artist} • {song.key} • {song.bpm} BPM</div>
                  </label>
                </div>
              ))}
              {filteredSongs.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  {songSearch ? `No songs found matching "${songSearch}"` : 'No songs available'}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Members ({selectedMembers.length} invited)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    id={`member-${member.id}`}
                    checked={selectedMembers.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded touch-manipulation"
                  />
                  <label
                    htmlFor={`member-${member.id}`}
                    className="ml-3 flex-1 cursor-pointer"
                  >
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-500">{member.primaryInstrument}</div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
            <TouchButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              className="sm:flex-1"
            >
              {initialData ? 'Update Session' : 'Schedule Session'}
            </TouchButton>
            <TouchButton
              type="button"
              variant="ghost"
              size="lg"
              fullWidth
              onClick={onCancel}
              disabled={loading}
              className="sm:flex-1"
            >
              Cancel
            </TouchButton>
          </div>
        </form>
      </div>
    </div>
  )
}