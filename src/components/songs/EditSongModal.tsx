/**
 * Shared Edit Song Modal Component
 *
 * Extracted from SongsPage to enable reuse in SetlistViewPage and PracticeViewPage.
 * Provides full song editing capabilities including:
 * - Title, artist, album
 * - Duration, BPM, key (with Circle of Fifths)
 * - Guitar tuning
 * - Tags and notes
 * - Reference links (YouTube, Spotify, Ultimate-Guitar)
 */

import React, { useState } from 'react'
import {
  X,
  Music,
  Plus,
  Edit,
  Music2,
  Play,
  Guitar,
  ExternalLink,
} from 'lucide-react'
import CircleOfFifths from './CircleOfFifths'
import type { Song } from '../../models/Song'
import type { ReferenceLink } from '../../types'

// Extended link type for UI that includes id and name
interface UILink extends ReferenceLink {
  id: string
  name: string
}

export interface EditSongModalProps {
  song: Song
  onClose: () => void
  onSave: (song: Song) => void | Promise<void>
}

// Helper to convert seconds to mm:ss
const secondsToMinSec = (seconds: number): { min: string; sec: string } => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return { min: String(mins), sec: String(secs).padStart(2, '0') }
}

// Helper to convert mm:ss to seconds
const minSecToSeconds = (min: string, sec: string): number => {
  return (parseInt(min) || 0) * 60 + (parseInt(sec) || 0)
}

// Convert ReferenceLinks to UILinks
const referenceLinkToUILink = (link: ReferenceLink, index: number): UILink => ({
  ...link,
  id: `link-${index}`,
  name: link.description || getLinkPresetName(link.type),
})

// Preset link names based on type
const getLinkPresetName = (type: string): string => {
  switch (type) {
    case 'spotify':
      return 'Spotify Track'
    case 'youtube':
      return 'YouTube Video'
    case 'tabs':
      return 'Tabs'
    case 'lyrics':
      return 'Lyrics'
    case 'other':
      return 'Link'
    default:
      return ''
  }
}

export const EditSongModal: React.FC<EditSongModalProps> = ({
  song,
  onClose,
  onSave,
}) => {
  const { min, sec } = secondsToMinSec(song.duration || 0)

  const [formData, setFormData] = useState({
    title: song.title || '',
    artist: song.artist || '',
    album: song.album || '',
    durationMin: min,
    durationSec: sec,
    key: song.key || '',
    tuning: song.guitarTuning || 'Standard',
    bpm: song.bpm ? String(song.bpm) : '',
    tags: song.tags?.join(', ') || '',
    notes: song.notes || '',
  })

  // Circle of Fifths visibility state
  const [showCircleOfFifths, setShowCircleOfFifths] = useState(false)

  // Link management state
  const [links, setLinks] = useState<UILink[]>(
    song.referenceLinks?.map(referenceLinkToUILink) || []
  )
  const [linkType, setLinkType] = useState<ReferenceLink['type']>('youtube')
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)

  // Update link name when type changes
  const handleLinkTypeChange = (newType: ReferenceLink['type']) => {
    setLinkType(newType)
    if (!editingLinkId) {
      setLinkName(getLinkPresetName(newType))
    }
  }

  // Add or update link
  const handleAddLink = () => {
    if (!linkUrl.trim()) {
      return
    }

    const finalName = linkName.trim() || getLinkPresetName(linkType)

    if (editingLinkId) {
      // Update existing link
      setLinks(
        links.map(link =>
          link.id === editingLinkId
            ? {
                ...link,
                type: linkType,
                name: finalName,
                url: linkUrl.trim(),
                description: finalName,
              }
            : link
        )
      )
      setEditingLinkId(null)
    } else {
      // Add new link
      const newLink: UILink = {
        id: `link-${Date.now()}`,
        type: linkType,
        name: finalName,
        url: linkUrl.trim(),
        description: finalName,
      }
      setLinks([...links, newLink])
    }

    // Reset form
    setLinkType('youtube')
    setLinkName('')
    setLinkUrl('')
  }

  // Edit link
  const handleEditLink = (link: UILink) => {
    setEditingLinkId(link.id)
    setLinkType(link.type)
    setLinkName(link.name)
    setLinkUrl(link.url)
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingLinkId(null)
    setLinkType('youtube')
    setLinkName('')
    setLinkUrl('')
  }

  // Delete link
  const handleDeleteLink = (linkId: string) => {
    setLinks(links.filter(link => link.id !== linkId))
  }

  // Get icon for link type
  const getLinkIcon = (type: string) => {
    switch (type) {
      case 'spotify':
        return <Music2 size={16} className="text-[#1DB954]" />
      case 'youtube':
        return <Play size={16} className="text-[#FF0000]" />
      case 'tabs':
        return <Guitar size={16} className="text-[#FFC600]" />
      default:
        return <ExternalLink size={16} className="text-[#a0a0a0]" />
    }
  }

  // Async submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.title || !formData.artist || !formData.key) {
      return
    }

    const duration = minSecToSeconds(formData.durationMin, formData.durationSec)
    const tags = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    // Convert UILinks back to ReferenceLinks
    const referenceLinks: ReferenceLink[] = links.map(link => ({
      type: link.type,
      url: link.url,
      description: link.name,
    }))

    const savedSong: Song = {
      ...song, // Preserve existing fields
      title: formData.title,
      artist: formData.artist,
      album: formData.album || undefined,
      duration,
      key: formData.key,
      guitarTuning: formData.tuning,
      bpm: parseInt(formData.bpm) || 0,
      tags,
      notes: formData.notes || undefined,
      referenceLinks,
    }

    // Call async onSave
    await onSave(savedSong)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar-thin"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white font-medium">Songs</span>
            <span className="text-[#707070]">&gt;</span>
            <span className="text-[#a0a0a0]">Edit Song</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label
                  htmlFor="song-title"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Title <span className="text-[#D7263D]">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  id="song-title"
                  data-testid="song-title-input"
                  value={formData.title}
                  onChange={e =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter song title"
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  required
                />
              </div>

              {/* Artist */}
              <div>
                <label
                  htmlFor="song-artist"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Artist <span className="text-[#D7263D]">*</span>
                </label>
                <input
                  type="text"
                  name="artist"
                  id="song-artist"
                  data-testid="song-artist-input"
                  value={formData.artist}
                  onChange={e =>
                    setFormData({ ...formData, artist: e.target.value })
                  }
                  placeholder="Enter artist name"
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  required
                />
              </div>

              {/* Album */}
              <div>
                <label
                  htmlFor="song-album"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Album
                </label>
                <input
                  type="text"
                  name="album"
                  id="song-album"
                  data-testid="song-album-input"
                  value={formData.album}
                  onChange={e =>
                    setFormData({ ...formData, album: e.target.value })
                  }
                  placeholder="Enter album name"
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>

              {/* Duration, BPM, Key Row */}
              <div className="grid grid-cols-3 gap-3">
                {/* Duration */}
                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-2">
                    Duration
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      name="durationMinutes"
                      id="song-duration-minutes"
                      data-testid="song-duration-minutes-input"
                      value={formData.durationMin}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          durationMin: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      placeholder="0"
                      maxLength={2}
                      className="w-full h-11 px-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                    />
                    <span className="flex items-center text-[#505050]">:</span>
                    <input
                      type="text"
                      name="durationSeconds"
                      id="song-duration-seconds"
                      data-testid="song-duration-seconds-input"
                      value={formData.durationSec}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          durationSec: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      placeholder="00"
                      maxLength={2}
                      className="w-full h-11 px-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                    />
                  </div>
                </div>

                {/* BPM */}
                <div>
                  <label
                    htmlFor="song-bpm"
                    className="block text-sm text-[#a0a0a0] mb-2"
                  >
                    BPM
                  </label>
                  <input
                    type="text"
                    name="bpm"
                    id="song-bpm"
                    data-testid="song-bpm-input"
                    value={formData.bpm}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        bpm: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    placeholder="120"
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm text-center placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  />
                </div>

                {/* Key */}
                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-2">
                    Key <span className="text-[#D7263D]">*</span>
                  </label>
                  <button
                    type="button"
                    id="song-key"
                    data-testid="song-key-button"
                    onClick={() => setShowCircleOfFifths(true)}
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm flex items-center justify-between hover:border-[#f17827ff] transition-colors group"
                  >
                    <span
                      className={
                        formData.key
                          ? 'text-white font-medium'
                          : 'text-[#505050]'
                      }
                    >
                      {formData.key || 'Select key'}
                    </span>
                    <Music
                      size={18}
                      className="text-[#707070] group-hover:text-[#f17827ff] transition-colors"
                    />
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label
                  htmlFor="song-tags"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  id="song-tags"
                  data-testid="song-tags-input"
                  value={formData.tags}
                  onChange={e =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                  placeholder="Rock, Cover, 90s"
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Guitar Tuning */}
              <div>
                <label
                  htmlFor="song-tuning"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Guitar Tuning
                </label>
                <select
                  name="tuning"
                  id="song-tuning"
                  data-testid="song-tuning-select"
                  value={formData.tuning}
                  onChange={e =>
                    setFormData({ ...formData, tuning: e.target.value })
                  }
                  className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                >
                  <option value="Standard">Standard</option>
                  <option value="Drop D">Drop D</option>
                  <option value="Drop C">Drop C</option>
                  <option value="Drop B">Drop B</option>
                  <option value="Half-step down">Half-step down</option>
                  <option value="Whole-step down">Whole-step down</option>
                  <option value="Open G">Open G</option>
                  <option value="Open D">Open D</option>
                  <option value="DADGAD">DADGAD</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="song-notes"
                  className="block text-sm text-[#a0a0a0] mb-2"
                >
                  Band Notes
                </label>
                <textarea
                  name="notes"
                  id="song-notes"
                  data-testid="song-notes-textarea"
                  value={formData.notes}
                  onChange={e =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Add notes about the song..."
                  rows={5}
                  className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 resize-none"
                />
              </div>

              {/* Reference Links */}
              <div>
                <label className="block text-sm text-[#a0a0a0] mb-2">
                  Reference Links
                </label>

                {/* Link Input Form */}
                <div className="space-y-3 mb-4">
                  {/* Link Type Dropdown */}
                  <select
                    value={linkType}
                    onChange={e =>
                      handleLinkTypeChange(
                        e.target.value as ReferenceLink['type']
                      )
                    }
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="spotify">Spotify</option>
                    <option value="tabs">Tabs</option>
                    <option value="lyrics">Lyrics</option>
                    <option value="other">Other</option>
                  </select>

                  {/* Link Name Input */}
                  <input
                    type="text"
                    value={linkName}
                    onChange={e => setLinkName(e.target.value)}
                    placeholder={getLinkPresetName(linkType) || 'Link name'}
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  />

                  {/* URL Input */}
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
                  />

                  {/* Add/Update Button */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66620] transition-colors"
                    >
                      <Plus size={16} />
                      <span>{editingLinkId ? 'Update Link' : 'Add Link'}</span>
                    </button>
                    {editingLinkId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Links List */}
                {links.length > 0 && (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar-thin">
                    {links.map(link => (
                      <div
                        key={link.id}
                        className="flex items-center gap-2 p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg group hover:border-[#3a3a3a] transition-colors"
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          {getLinkIcon(link.type)}
                        </div>

                        {/* Link Info */}
                        <div className="flex-1 min-w-0">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white text-sm hover:text-[#f17827ff] transition-colors truncate block"
                          >
                            {link.name}
                          </a>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditLink(link)}
                            className="p-1.5 text-[#707070] hover:text-white hover:bg-[#2a2a2a] rounded transition-colors"
                            title="Edit link"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLink(link.id)}
                            className="p-1.5 text-[#707070] hover:text-[#D7263D] hover:bg-[#2a2a2a] rounded transition-colors"
                            title="Delete link"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {links.length === 0 && (
                  <p className="text-xs text-[#505050] text-center py-4">
                    No links added yet
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-[#2a2a2a]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="song-submit-button"
              className="px-6 py-2.5 bg-[#f17827ff] text-white text-sm font-medium rounded-lg hover:bg-[#d66620] transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Circle of Fifths Modal */}
      {showCircleOfFifths && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowCircleOfFifths(false)}
        >
          <div
            className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-4 sm:p-6 w-full max-w-[min(90vw,500px)] max-h-[90vh] overflow-y-auto custom-scrollbar-thin"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                Select Key
              </h3>
              <button
                onClick={() => setShowCircleOfFifths(false)}
                className="p-1 text-[#707070] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Circle of Fifths */}
            <CircleOfFifths
              selectedKey={formData.key}
              onKeySelect={key => {
                setFormData({ ...formData, key })
                setShowCircleOfFifths(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default EditSongModal
