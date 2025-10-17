import React, { useState, useRef } from 'react'
import { Song } from '../../models/Song'
import { ReferenceLink } from '../../types'
import { TouchButton } from '../common/TouchButton'

interface AddSongFormProps {
  onSubmit: (songData: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel'>) => void
  onCancel: () => void
  initialData?: Partial<Song>
  loading?: boolean
}

interface FormErrors {
  title?: string
  artist?: string
  duration?: string
  key?: string
  bpm?: string
  difficulty?: string
}

const MUSICAL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'
]

const COMMON_TAGS = [
  'Rock', 'Pop', 'Jazz', 'Blues', 'Country', 'Folk', 'Metal', 'Punk', 'Alternative',
  'Acoustic', 'Electric', 'Ballad', 'Fast', 'Slow', 'Cover', 'Original'
]

export const AddSongForm: React.FC<AddSongFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    artist: initialData?.artist || '',
    album: initialData?.album || '',
    duration: initialData?.duration ? Math.floor(initialData.duration / 60) : 0,
    durationSeconds: initialData?.duration ? initialData.duration % 60 : 0,
    key: initialData?.key || '',
    bpm: initialData?.bpm || 120,
    difficulty: initialData?.difficulty || 3,
    lyrics: initialData?.lyrics || '',
    notes: initialData?.notes || '',
    tags: initialData?.tags?.join(', ') || '',
    chords: initialData?.chords?.join(', ') || '',
    structure: initialData?.structure || [],
    referenceLinks: initialData?.referenceLinks || []
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Song title is required'
    }

    if (!formData.artist.trim()) {
      newErrors.artist = 'Artist name is required'
    }

    const totalSeconds = (formData.duration * 60) + formData.durationSeconds
    if (totalSeconds <= 0) {
      newErrors.duration = 'Duration must be greater than 0'
    }

    if (!formData.key) {
      newErrors.key = 'Musical key is required'
    }

    if (formData.bpm < 40 || formData.bpm > 300) {
      newErrors.bpm = 'BPM must be between 40 and 300'
    }

    if (formData.difficulty < 1 || formData.difficulty > 5) {
      newErrors.difficulty = 'Difficulty must be between 1 and 5'
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

    const songData = {
      title: formData.title.trim(),
      artist: formData.artist.trim(),
      album: formData.album.trim() || undefined,
      duration: (formData.duration * 60) + formData.durationSeconds,
      key: formData.key,
      bpm: formData.bpm,
      difficulty: formData.difficulty as 1 | 2 | 3 | 4 | 5,
      structure: formData.structure,
      lyrics: formData.lyrics.trim() || undefined,
      chords: formData.chords ? formData.chords.split(',').map(c => c.trim()).filter(Boolean) : [],
      notes: formData.notes.trim() || undefined,
      referenceLinks: formData.referenceLinks,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    }

    onSubmit(songData)
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const addReferenceLink = () => {
    setFormData(prev => ({
      ...prev,
      referenceLinks: [...prev.referenceLinks, { type: 'other', url: '', description: '' } as ReferenceLink]
    }))
  }

  const removeReferenceLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      referenceLinks: prev.referenceLinks.filter((_, i) => i !== index)
    }))
  }

  const updateReferenceLink = (index: number, field: keyof ReferenceLink, value: string) => {
    setFormData(prev => ({
      ...prev,
      referenceLinks: prev.referenceLinks.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      )
    }))
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Edit Song' : 'Add New Song'}
          </h2>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Song Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter song title"
                data-error={!!errors.title}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Artist *
              </label>
              <input
                type="text"
                value={formData.artist}
                onChange={(e) => handleInputChange('artist', e.target.value)}
                className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.artist ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter artist name"
                data-error={!!errors.artist}
              />
              {errors.artist && (
                <p className="mt-1 text-sm text-red-600">{errors.artist}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Album
              </label>
              <input
                type="text"
                value={formData.album}
                onChange={(e) => handleInputChange('album', e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter album name (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration *
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
                    className={`flex-1 min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.duration ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Min"
                  />
                  <span className="flex items-center text-gray-500">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.durationSeconds}
                    onChange={(e) => handleInputChange('durationSeconds', parseInt(e.target.value) || 0)}
                    className={`flex-1 min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.duration ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Sec"
                  />
                </div>
                {errors.duration && (
                  <p className="mt-1 text-sm text-red-600">{errors.duration}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key *
                </label>
                <select
                  value={formData.key}
                  onChange={(e) => handleInputChange('key', e.target.value)}
                  className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.key ? 'border-red-500' : 'border-gray-300'
                  }`}
                  data-error={!!errors.key}
                >
                  <option value="">Select key</option>
                  {MUSICAL_KEYS.map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
                {errors.key && (
                  <p className="mt-1 text-sm text-red-600">{errors.key}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  BPM *
                </label>
                <input
                  type="number"
                  min="40"
                  max="300"
                  value={formData.bpm}
                  onChange={(e) => handleInputChange('bpm', parseInt(e.target.value) || 120)}
                  className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.bpm ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="120"
                  data-error={!!errors.bpm}
                />
                {errors.bpm && (
                  <p className="mt-1 text-sm text-red-600">{errors.bpm}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty *
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => handleInputChange('difficulty', parseInt(e.target.value))}
                  className={`w-full min-h-[48px] px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.difficulty ? 'border-red-500' : 'border-gray-300'
                  }`}
                  data-error={!!errors.difficulty}
                >
                  <option value={1}>1 - Beginner</option>
                  <option value={2}>2 - Easy</option>
                  <option value={3}>3 - Intermediate</option>
                  <option value={4}>4 - Advanced</option>
                  <option value={5}>5 - Expert</option>
                </select>
                {errors.difficulty && (
                  <p className="mt-1 text-sm text-red-600">{errors.difficulty}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => handleInputChange('tags', e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="rock, acoustic, cover (comma separated)"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {COMMON_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
                      if (!currentTags.includes(tag)) {
                        handleInputChange('tags', [...currentTags, tag].join(', '))
                      }
                    }}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors touch-manipulation"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Band-specific notes about this song..."
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>

            {showAdvanced && (
              <div className="space-y-6 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chords
                  </label>
                  <input
                    type="text"
                    value={formData.chords}
                    onChange={(e) => handleInputChange('chords', e.target.value)}
                    className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="C, F, G, Am (comma separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lyrics
                  </label>
                  <textarea
                    value={formData.lyrics}
                    onChange={(e) => handleInputChange('lyrics', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Enter song lyrics..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Reference Links
                    </label>
                    <TouchButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addReferenceLink}
                    >
                      Add Link
                    </TouchButton>
                  </div>
                  {formData.referenceLinks.map((link, index) => (
                    <div key={index} className="flex space-x-2 mb-2">
                      <select
                        value={link.type}
                        onChange={(e) => updateReferenceLink(index, 'type', e.target.value)}
                        className="min-h-[44px] px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="spotify">Spotify</option>
                        <option value="youtube">YouTube</option>
                        <option value="tabs">Tabs</option>
                        <option value="lyrics">Lyrics</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateReferenceLink(index, 'url', e.target.value)}
                        className="flex-1 min-h-[44px] px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="URL"
                      />
                      <button
                        type="button"
                        onClick={() => removeReferenceLink(index)}
                        className="px-2 py-1 text-red-600 hover:text-red-800 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              {initialData ? 'Update Song' : 'Add Song'}
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