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
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  HardDrive,
  Cloud,
  CloudRain,
  Check,
} from 'lucide-react'
import CircleOfFifths from './CircleOfFifths'
import { SpotifySearch } from './SpotifySearch'
import type { Song } from '../../models/Song'
import type { ReferenceLink } from '../../types'
import type { SpotifyTrack } from '../../services/spotify/SpotifyService'
import { SpotifyService } from '../../services/spotify/SpotifyService'
import { detectLinkType } from '../../utils/linkDetection'

// Extended link type for UI that includes id and name
interface UILink extends ReferenceLink {
  id: string
  name: string
}

export interface EditSongModalProps {
  song?: Song // Optional - if not provided, it's "add" mode
  mode?: 'add' | 'edit' // Defaults to 'edit' if song provided, 'add' if not
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
  name: link.description || getLinkPresetName(link.icon),
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
  mode: explicitMode,
  onClose,
  onSave,
}) => {
  // Determine mode: explicit mode takes precedence, otherwise infer from song
  const mode = explicitMode ?? (song ? 'edit' : 'add')
  const isAddMode = mode === 'add'

  const { min, sec } = secondsToMinSec(song?.duration || 0)

  const [formData, setFormData] = useState({
    title: song?.title || '',
    artist: song?.artist || '',
    album: song?.album || '',
    durationMin: min,
    durationSec: sec,
    key: song?.key || '',
    tuning: song?.guitarTuning || 'Standard',
    bpm: song?.bpm ? String(song.bpm) : '',
    tags: song?.tags?.join(', ') || '',
    notes: song?.notes || '',
  })

  // Circle of Fifths visibility state
  const [showCircleOfFifths, setShowCircleOfFifths] = useState(false)

  // Spotify search visibility state
  const [showSpotifySearch, setShowSpotifySearch] = useState(false)

  // Handle Spotify track selection - auto-fill form fields
  const handleSpotifySelect = (track: SpotifyTrack) => {
    const durationSeconds = SpotifyService.durationToSeconds(track.durationMs)
    const { min, sec } = secondsToMinSec(durationSeconds)

    // Update form data with track info
    setFormData(prev => ({
      ...prev,
      title: track.name,
      artist: track.artist,
      album: track.album,
      durationMin: min,
      durationSec: sec,
    }))

    // Add Spotify link to reference links
    const spotifyLink: UILink = {
      id: `link-spotify-${Date.now()}`,
      icon: 'spotify',
      name: 'Spotify Track',
      url: track.spotifyUrl,
      description: 'Spotify Track',
    }

    // Check if a Spotify link already exists
    const existingSpotifyIndex = links.findIndex(l => l.icon === 'spotify')
    if (existingSpotifyIndex >= 0) {
      // Replace existing Spotify link
      setLinks(prev =>
        prev.map((l, i) => (i === existingSpotifyIndex ? spotifyLink : l))
      )
    } else {
      // Add new Spotify link
      setLinks(prev => [...prev, spotifyLink])
    }

    // Collapse search after selection
    setShowSpotifySearch(false)
  }

  // Link management state
  const [links, setLinks] = useState<UILink[]>(
    song?.referenceLinks?.map(referenceLinkToUILink) || []
  )
  // Track whether user is actively adding a new link
  const [isAddingLink, setIsAddingLink] = useState(false)
  const [linkIcon, setLinkIcon] = useState<string>('other')
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [iconDropdownOpen, setIconDropdownOpen] = useState(false)

  // Get suggested label based on link type
  const getSuggestedLabel = (type: string): string => {
    switch (type) {
      case 'spotify':
        return 'Spotify Track'
      case 'youtube':
        return 'YouTube Video'
      case 'tabs':
        return 'Guitar Tabs'
      case 'lyrics':
        return 'Lyrics'
      case 'drive':
        return 'Google Drive File'
      case 'dropbox':
        return 'Dropbox File'
      case 'soundcloud':
        return 'SoundCloud Track'
      default:
        return ''
    }
  }

  // Character limits
  const LABEL_MAX_LENGTH = 50
  const URL_MAX_LENGTH = 300

  // Characters that could be used for command injection or XSS
  const DANGEROUS_PATTERNS = /[;|&$`\\<>{}[\]]/

  // Valid domain pattern: something.something (with optional subdomains)
  const DOMAIN_PATTERN =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+/

  // Validate URL format - accepts with or without protocol
  const isValidUrl = (url: string): boolean => {
    const trimmed = url.trim()
    if (!trimmed) return false

    // Check for dangerous characters (command injection protection)
    if (DANGEROUS_PATTERNS.test(trimmed)) return false

    // Block javascript: and data: protocols (XSS protection)
    const lower = trimmed.toLowerCase()
    if (lower.startsWith('javascript:') || lower.startsWith('data:'))
      return false

    // If it has a protocol, validate it's http/https
    if (trimmed.includes('://')) {
      if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
        return false
      }
      // Extract domain part after protocol
      const afterProtocol = trimmed.split('://')[1]
      if (!afterProtocol) return false
      const domain = afterProtocol.split('/')[0].split('?')[0].split('#')[0]
      return DOMAIN_PATTERN.test(domain)
    }

    // No protocol - check if it looks like a valid domain
    const domain = trimmed.split('/')[0].split('?')[0].split('#')[0]
    return DOMAIN_PATTERN.test(domain)
  }

  // Get URL validation error message
  const getUrlError = (url: string): string | null => {
    const trimmed = url.trim()
    if (!trimmed) return null // Empty is not an error, just can't save

    if (trimmed.length > URL_MAX_LENGTH) {
      return `URL is too long (max ${URL_MAX_LENGTH} characters)`
    }

    if (DANGEROUS_PATTERNS.test(trimmed)) {
      return 'URL contains invalid characters'
    }

    const lower = trimmed.toLowerCase()
    if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
      return 'Invalid URL protocol'
    }

    if (!isValidUrl(trimmed)) {
      return 'Please enter a valid URL (e.g., example.com or https://example.com)'
    }

    return null
  }

  // Normalize URL for storage - add https:// if no protocol
  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim()
    if (!trimmed.includes('://')) {
      return `https://${trimmed}`
    }
    return trimmed
  }

  // Auto-detect link type when URL changes and pre-fill label
  const handleLinkUrlChange = (url: string) => {
    setLinkUrl(url)

    // Auto-detect and update link type + label when URL changes (not editing)
    if (!editingLinkId) {
      if (url.trim()) {
        const detected = detectLinkType(url)
        setLinkIcon(detected.type)
        // Pre-fill label with suggestion (user can overwrite)
        const suggestedLabel = getSuggestedLabel(detected.type)
        if (suggestedLabel) {
          setLinkName(suggestedLabel)
        }
      } else {
        // Reset when URL is cleared
        setLinkIcon('other')
        setLinkName('')
      }
    }
  }

  // Cancel adding a new link
  const handleCancelAddLink = () => {
    setIsAddingLink(false)
    setLinkUrl('')
    setLinkName('')
    setLinkIcon('other')
  }

  // Start adding a new link
  const handleStartAddLink = () => {
    setIsAddingLink(true)
    setLinkUrl('')
    setLinkName('')
    setLinkIcon('other')
  }

  // Add or update link
  const handleAddLink = () => {
    if (!linkUrl.trim()) {
      return
    }

    // Use the user-provided label, or fall back to suggested label
    const finalName = linkName.trim() || getSuggestedLabel(linkIcon) || 'Link'

    // Normalize URL (add https:// if missing)
    const normalizedUrl = normalizeUrl(linkUrl)

    if (editingLinkId) {
      // Update existing link
      setLinks(
        links.map(link =>
          link.id === editingLinkId
            ? {
                ...link,
                icon: linkIcon,
                name: finalName,
                url: normalizedUrl,
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
        icon: linkIcon,
        name: finalName,
        url: normalizedUrl,
        description: finalName,
      }
      setLinks([...links, newLink])
    }

    // Reset form and close add mode
    setIsAddingLink(false)
    setLinkIcon('other')
    setLinkName('')
    setLinkUrl('')
  }

  // Edit link
  const handleEditLink = (link: UILink) => {
    setEditingLinkId(link.id)
    setLinkIcon(link.icon)
    setLinkName(link.name)
    setLinkUrl(link.url)
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingLinkId(null)
    setLinkIcon('other')
    setLinkName('')
    setLinkUrl('')
  }

  // Delete link
  const handleDeleteLink = (linkId: string) => {
    setLinks(links.filter(link => link.id !== linkId))
  }

  // Get icon for link type - minimalist outline icons with brand colors
  const getLinkIcon = (type: string, size: number = 16) => {
    switch (type) {
      case 'spotify':
        return <Music2 size={size} className="text-[#1DB954]" />
      case 'youtube':
        return <Play size={size} className="text-[#FF0000]" />
      case 'tabs':
        return <Guitar size={size} className="text-[#FFC600]" />
      case 'lyrics':
        return <FileText size={size} className="text-[#9B59B6]" />
      case 'drive':
        return <HardDrive size={size} className="text-[#4285F4]" />
      case 'dropbox':
        return <Cloud size={size} className="text-[#0061FF]" />
      case 'soundcloud':
        return <CloudRain size={size} className="text-[#FF5500]" />
      default:
        return <ExternalLink size={size} className="text-[#a0a0a0]" />
    }
  }

  // Icon type options for the dropdown
  const iconTypeOptions = [
    { value: 'other', label: 'Link' },
    { value: 'tabs', label: 'Tabs' },
    { value: 'lyrics', label: 'Lyrics' },
    { value: 'youtube', label: 'Video' },
    { value: 'spotify', label: 'Audio' },
    { value: 'drive', label: 'Cloud File' },
  ]

  // Custom Icon Select Component - compact icon-only popup that opens upward
  const IconSelect = ({
    value,
    onChange,
    testId,
  }: {
    value: string
    onChange: (value: string) => void
    testId: string
  }) => {
    return (
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setIconDropdownOpen(!iconDropdownOpen)}
          data-testid={testId}
          title="Select icon type"
          className="w-11 h-11 bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-white flex items-center justify-center hover:border-[#3a3a3a] focus:border-[#f17827ff] focus:outline-none transition-colors"
        >
          {getLinkIcon(value)}
        </button>
        {iconDropdownOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setIconDropdownOpen(false)}
            />
            {/* Popup menu - opens upward as a compact grid */}
            <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-[101] p-2 grid grid-cols-3 gap-2 w-[152px]">
              {iconTypeOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  onClick={() => {
                    onChange(option.value)
                    setIconDropdownOpen(false)
                  }}
                  className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${
                    value === option.value
                      ? 'bg-[#f17827ff]/20 ring-2 ring-[#f17827ff]'
                      : 'hover:bg-[#252525]'
                  }`}
                >
                  {getLinkIcon(option.value)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
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
      icon: link.icon,
      url: link.url,
      description: link.name,
    }))

    // For add mode, create a new song; for edit mode, preserve existing fields
    const savedSong: Song = isAddMode
      ? {
          id: crypto.randomUUID(),
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
          // Defaults for new songs (these will be set properly by SongsPage)
          difficulty: 1 as const,
          structure: [],
          chords: [],
          createdDate: new Date(),
          confidenceLevel: 1,
          contextType: 'band',
          contextId: '', // Will be set by SongsPage
          createdBy: '', // Will be set by SongsPage
          visibility: 'band',
        }
      : {
          ...song!, // Preserve existing fields
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
            <span className="text-[#a0a0a0]">
              {isAddMode ? 'New Song' : 'Edit Song'}
            </span>
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
          {/* Spotify Search Section */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowSpotifySearch(!showSpotifySearch)}
              className="flex items-center gap-2 text-sm text-[#1DB954] hover:text-[#1ed760] transition-colors"
              data-testid="toggle-spotify-search"
            >
              <Search size={16} />
              <span>Search Spotify to auto-fill</span>
              {showSpotifySearch ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>

            {showSpotifySearch && (
              <div className="mt-3">
                <SpotifySearch
                  onSelect={handleSpotifySelect}
                  placeholder="Search for a song on Spotify..."
                  autoFocus
                />
                <p className="mt-2 text-xs text-[#606060]">
                  Select a track to auto-fill title, artist, album, duration,
                  and add Spotify link
                </p>
              </div>
            )}
          </div>

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
            </div>
          </div>

          {/* Reference Links - Full Width Section with Inline Editing */}
          <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
            <label className="block text-sm text-[#a0a0a0] mb-3">
              Reference Links
            </label>

            {/* Inline Link Rows */}
            <div className="space-y-2">
              {/* Existing Links - Each row is inline editable */}
              {links.map(link => {
                const isEditing = editingLinkId === link.id

                if (isEditing) {
                  // Edit mode - show 3-row inline form
                  return (
                    <div
                      key={link.id}
                      className="p-3 bg-[#0a0a0a] border border-[#f17827ff]/50 rounded-lg space-y-3"
                    >
                      {/* Row 1: URL input (full width) with validation */}
                      <div>
                        <input
                          type="text"
                          value={linkUrl}
                          onChange={e =>
                            handleLinkUrlChange(
                              e.target.value.slice(0, URL_MAX_LENGTH)
                            )
                          }
                          placeholder="Paste URL here (e.g., youtube.com/watch?v=...)"
                          maxLength={URL_MAX_LENGTH}
                          autoFocus
                          data-testid="link-url-input-edit"
                          className={`w-full h-11 px-3 bg-[#0f0f0f] border rounded-lg text-white text-sm placeholder-[#505050] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 ${
                            getUrlError(linkUrl)
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-[#2a2a2a] focus:border-[#f17827ff]'
                          }`}
                        />
                        {getUrlError(linkUrl) && (
                          <p className="mt-1 text-xs text-red-400">
                            {getUrlError(linkUrl)}
                          </p>
                        )}
                      </div>

                      {/* Row 2: Label + Icon selector with character limit */}
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={linkName}
                            onChange={e =>
                              setLinkName(
                                e.target.value.slice(0, LABEL_MAX_LENGTH)
                              )
                            }
                            placeholder="Label (e.g., Live Recording, Chord Chart)"
                            maxLength={LABEL_MAX_LENGTH}
                            data-testid="link-label-input-edit"
                            className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
                          />
                          {linkName.length >= LABEL_MAX_LENGTH - 10 && (
                            <p
                              className={`mt-1 text-xs ${linkName.length >= LABEL_MAX_LENGTH ? 'text-red-400' : 'text-[#707070]'}`}
                            >
                              {linkName.length}/{LABEL_MAX_LENGTH}
                            </p>
                          )}
                        </div>
                        <IconSelect
                          value={linkIcon}
                          onChange={val => setLinkIcon(val)}
                          testId="link-icon-select-edit"
                        />
                      </div>

                      {/* Row 3: Save (check) and Cancel (X) buttons */}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#707070] hover:text-red-400 hover:border-red-400/50 hover:bg-red-400/10 transition-colors"
                          title="Cancel"
                          data-testid="cancel-edit-link-button"
                        >
                          <X size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!isValidUrl(linkUrl)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#707070] hover:text-green-400 hover:border-green-400/50 hover:bg-green-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-[#707070] disabled:hover:border-[#2a2a2a] disabled:hover:bg-transparent"
                          title="Save changes"
                          data-testid="save-edit-link-button"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </div>
                  )
                }

                // Display mode - show link with edit/delete actions
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg group hover:border-[#3a3a3a] transition-colors"
                  >
                    {/* Icon - use saved icon type */}
                    <div className="flex-shrink-0">
                      {getLinkIcon(link.icon)}
                    </div>

                    {/* Link Info */}
                    <div className="flex-1 min-w-0">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white text-sm hover:text-[#f17827ff] transition-colors truncate block"
                      >
                        {link.name || getLinkPresetName(link.icon)}
                      </a>
                      <span className="text-xs text-[#505050] truncate block">
                        {link.url}
                      </span>
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
                )
              })}

              {/* Add New Link - shows when not editing an existing link */}
              {!editingLinkId && (
                <div className="border border-[#2a2a2a] border-dashed rounded-lg">
                  {!isAddingLink ? (
                    /* Idle state - show "Add another link..." button */
                    <button
                      type="button"
                      onClick={handleStartAddLink}
                      className="w-full p-3 flex items-center justify-center gap-2 text-[#707070] hover:text-[#a0a0a0] hover:bg-[#0f0f0f] rounded-lg transition-colors"
                      data-testid="start-add-link-button"
                    >
                      <Plus size={18} />
                      <span className="text-sm">Add another link...</span>
                    </button>
                  ) : (
                    /* Active add mode - show 3-row input form */
                    <div className="p-3 bg-[#0a0a0a] space-y-3">
                      {/* Row 1: URL input (full width) */}
                      <div>
                        <input
                          type="text"
                          value={linkUrl}
                          onChange={e =>
                            handleLinkUrlChange(
                              e.target.value.slice(0, URL_MAX_LENGTH)
                            )
                          }
                          placeholder="Paste URL here (e.g., youtube.com/watch?v=...)"
                          maxLength={URL_MAX_LENGTH}
                          autoFocus
                          data-testid="link-url-input"
                          className={`w-full h-11 px-3 bg-[#0f0f0f] border rounded-lg text-white text-sm placeholder-[#505050] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 ${
                            getUrlError(linkUrl)
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-[#2a2a2a] focus:border-[#f17827ff]'
                          }`}
                        />
                        {getUrlError(linkUrl) && (
                          <p className="mt-1 text-xs text-red-400">
                            {getUrlError(linkUrl)}
                          </p>
                        )}
                      </div>

                      {/* Row 2: Label + Icon selector */}
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={linkName}
                            onChange={e =>
                              setLinkName(
                                e.target.value.slice(0, LABEL_MAX_LENGTH)
                              )
                            }
                            placeholder="Label (e.g., Live Recording, Chord Chart)"
                            maxLength={LABEL_MAX_LENGTH}
                            data-testid="link-label-input"
                            className="w-full h-11 px-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none"
                          />
                          {linkName.length >= LABEL_MAX_LENGTH - 10 && (
                            <p
                              className={`mt-1 text-xs ${linkName.length >= LABEL_MAX_LENGTH ? 'text-red-400' : 'text-[#707070]'}`}
                            >
                              {linkName.length}/{LABEL_MAX_LENGTH}
                            </p>
                          )}
                        </div>
                        <IconSelect
                          value={linkIcon}
                          onChange={val => setLinkIcon(val)}
                          testId="link-icon-select-add"
                        />
                      </div>

                      {/* Row 3: Save (check) and Cancel (X) buttons */}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCancelAddLink}
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#707070] hover:text-red-400 hover:border-red-400/50 hover:bg-red-400/10 transition-colors"
                          title="Cancel"
                          data-testid="cancel-add-link-button"
                        >
                          <X size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!isValidUrl(linkUrl)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#707070] hover:text-green-400 hover:border-green-400/50 hover:bg-green-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-[#707070] disabled:hover:border-[#2a2a2a] disabled:hover:bg-transparent"
                          title="Save link"
                          data-testid="save-add-link-button"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
