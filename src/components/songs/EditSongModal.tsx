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

import React, { useEffect, useRef, useState } from 'react'
import {
  X,
  Plus,
  Edit,
  Music2,
  Play,
  Guitar,
  ExternalLink,
  FileText,
  HardDrive,
  Cloud,
  CloudRain,
  Check,
} from 'lucide-react'
import CircleOfFifths from './CircleOfFifths'
import { formatSeconds } from '../../domain/format'
import { useSpotifySearch } from '../../hooks/useSpotifySearch'
import type { Song } from '../../models/Song'
import type { ReferenceLink } from '../../types'
import type { SpotifyTrack } from '../../services/spotify/SpotifyService'
import { SpotifyService } from '../../services/spotify/SpotifyService'
import { detectLinkType } from '../../utils/linkDetection'
import {
  tuningColor,
  tuningLabel,
  canonicalTuningId,
  tuningOrderIndex,
} from '../../utils/tunings'
import { Dropdown, DropdownGroup } from '../common/Dropdown'
import { useTunings } from '../../hooks/useTunings'
import { CreateTuningModal } from '../tunings/CreateTuningModal'
import { useNavigate } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { UnsavedChangesDialog } from '../common/UnsavedChangesDialog'

// Extended link type for UI that includes id and name
interface UILink extends ReferenceLink {
  id: string
  name: string
}

export interface EditSongModalProps {
  song?: Song // Optional - if not provided, it's "add" mode
  mode?: 'add' | 'edit' // Defaults to 'edit' if song provided, 'add' if not
  onClose: () => void
  onSave: (
    song: Song,
    options?: { alsoSaveToPersonal?: boolean }
  ) => void | Promise<void>
  /**
   * When true and the modal is in add mode, show a checkbox offering to
   * also save a linked copy to the user's personal catalog. The parent
   * receives the checkbox value via the `alsoSaveToPersonal` option on
   * onSave and is responsible for actually creating the linked copy.
   *
   * Only meaningful when adding to a band catalog (no need to "also save
   * to personal" while already adding a personal song).
   */
  showAlsoSaveToPersonal?: boolean
}

const CARD = 'rounded-[18px] bg-bg-2 shadow-group'
const FIELD = 'px-4 py-2.5'
const LABEL =
  'block font-mono text-[10.5px] tracking-[.14em] uppercase text-ink-3'
const INPUT_BARE =
  'bg-transparent text-[16.5px] font-bold text-ink-1 placeholder-ink-4 focus:outline-none'
const INPUT = `w-full ${INPUT_BARE}`

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

const FIELD_NAMES: [keyof ChangeForm, string][] = [
  ['title', 'Title'],
  ['artist', 'Artist'],
  ['album', 'Album'],
  ['tuning', 'Tuning'],
  ['key', 'Key'],
  ['bpm', 'BPM'],
  ['durationMin', 'Length'],
  ['durationSec', 'Length'],
  ['tags', 'Tags'],
]

interface ChangeForm {
  title: string
  artist: string
  album: string
  tuning: string
  key: string
  bpm: string
  durationMin: string
  durationSec: string
  tags: string
}

/** "You changed Tuning and Key. These haven't been saved." */
function changedFieldsMessage(
  song: Song | undefined,
  form: ChangeForm,
  links: UILink[]
): string {
  const { min, sec } = secondsToMinSec(song?.duration || 0)
  const before: ChangeForm = {
    title: song?.title || '',
    artist: song?.artist || '',
    album: song?.album || '',
    tuning: song?.guitarTuning || 'Standard',
    key: song?.key || '',
    bpm: song?.bpm ? String(song.bpm) : '',
    durationMin: min,
    durationSec: sec,
    tags: song?.tags?.join(', ') || '',
  }
  const names = [
    ...new Set(
      FIELD_NAMES.filter(([k]) => before[k] !== form[k]).map(([, n]) => n)
    ),
  ]
  const linksBefore = (song?.referenceLinks ?? []).map(l => l.url).join()
  if (linksBefore !== links.map(l => l.url).join()) names.push('Links')
  if (!names.length) return "Your changes haven't been saved."
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `You changed ${list}. These haven't been saved.`
}

export const EditSongModal: React.FC<EditSongModalProps> = ({
  song,
  mode: explicitMode,
  onClose,
  onSave,
  showAlsoSaveToPersonal = false,
}) => {
  // Determine mode: explicit mode takes precedence, otherwise infer from song
  const mode = explicitMode ?? (song ? 'edit' : 'add')
  const isAddMode = mode === 'add'

  // Add-mode-only: opt-in to also creating a linked copy in the user's
  // personal catalog. Default off; enabled in add mode only and only when
  // the parent has explicitly enabled the option (i.e. we're adding a
  // band song, not a personal song).
  const [alsoSaveToPersonal, setAlsoSaveToPersonal] = useState(false)
  const showPersonalCheckbox = isAddMode && showAlsoSaveToPersonal

  const { min, sec } = secondsToMinSec(song?.duration || 0)

  const [formData, setFormData] = useState({
    title: song?.title || '',
    artist: song?.artist || '',
    album: song?.album || '',
    durationMin: min,
    durationSec: sec,
    key: song?.key || '',
    tuning: song?.guitarTuning || 'Standard',
    tuningId: song?.tuningId ?? (null as string | null),
    bpm: song?.bpm ? String(song.bpm) : '',
    tags: song?.tags?.join(', ') || '',
    notes: song?.notes || '',
  })

  // Custom-tuning picker data (built-ins + the user's customs, from the DB).
  // Guitar-only for now — bass tunings just clutter the song picker.
  const {
    builtins: builtinTunings,
    customs: customTunings,
    refetch: refetchTunings,
  } = useTunings('guitar')
  const navigate = useNavigate()
  const [creatingTuning, setCreatingTuning] = useState(false)

  // Legacy songs store only guitarTuning text; once tunings load, resolve the
  // matching built-in id so saving writes tuning_id (progressive backfill).
  useEffect(() => {
    if (formData.tuningId || builtinTunings.length === 0) return
    const match = builtinTunings.find(
      t => t.slug === canonicalTuningId(formData.tuning)
    )
    if (match) setFormData(f => ({ ...f, tuningId: match.id }))
  }, [builtinTunings, formData.tuningId, formData.tuning])

  const tuningGroups: DropdownGroup[] = [
    {
      label: 'Built-in',
      options: [...builtinTunings]
        .sort(
          (a, b) =>
            tuningOrderIndex(a.slug) - tuningOrderIndex(b.slug) ||
            a.name.localeCompare(b.name)
        )
        .map(t => ({
          value: t.id,
          label: t.name,
          color: t.color ?? tuningColor(t.name),
        })),
    },
    ...(customTunings.length
      ? [
          {
            label: 'Your tunings',
            options: customTunings.map(t => ({
              value: t.id,
              label: t.name,
              color: t.color ?? undefined,
              tag: 'custom',
            })),
          },
        ]
      : []),
  ]

  const handleTuningChange = (id: string) => {
    const t = [...builtinTunings, ...customTunings].find(x => x.id === id)
    setFormData(f => ({ ...f, tuningId: id, tuning: t?.name ?? f.tuning }))
  }

  // Circle of Fifths visibility state
  const [showCircleOfFifths, setShowCircleOfFifths] = useState(false)

  // Spotify matches under the title while adding (up to 3).
  const spotify = useSpotifySearch({ limit: 3 })
  const [spotifyPicked, setSpotifyPicked] = useState(false)
  const setSpotifyQuery = spotify.setQuery
  useEffect(() => {
    if (isAddMode && !spotifyPicked) setSpotifyQuery(formData.title)
  }, [isAddMode, spotifyPicked, formData.title, setSpotifyQuery])

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

    setSpotifyPicked(true)
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

  // --- Unsaved changes tracking ---
  // Serialize formData + links (minus transient id/name) and compare against
  // a snapshot captured on first render. After a successful save we update
  // the snapshot so the form reads as "clean" again.
  const initialSnapshotRef = useRef<string>('')
  // Exclude `tuningId` from the dirty snapshot: it is backfilled asynchronously
  // from `tuning` once the tunings list loads (see the progressive-backfill
  // effect above), which would otherwise mark a pristine add-mode form dirty and
  // pop a spurious "unsaved changes" dialog on close. Real tuning changes are
  // still detected via `tuning`, which is set alongside tuningId on select.
  const currentSnapshot = JSON.stringify({
    formData: { ...formData, tuningId: undefined },
    links: links.map(l => ({
      icon: l.icon,
      url: l.url,
      description: l.description,
    })),
  })
  useEffect(() => {
    if (!initialSnapshotRef.current) {
      initialSnapshotRef.current = currentSnapshot
    }
  }, [currentSnapshot])
  const isDirty =
    initialSnapshotRef.current !== '' &&
    currentSnapshot !== initialSnapshotRef.current

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
        return <ExternalLink size={size} className="text-ink-3" />
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
          className="w-11 h-11 bg-bg-1 border border-border-1 rounded-md text-ink-1 flex items-center justify-center hover:border-border-2 focus:border-accent focus:outline-none transition-colors"
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
            <div className="absolute bottom-full right-0 mb-2 bg-bg-2 border border-border-1 rounded-lg shadow-xl z-[101] p-2 grid grid-cols-3 gap-2 w-[152px]">
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
                      ? 'bg-accent/20 ring-2 ring-accent'
                      : 'hover:bg-bg-4'
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

  // Core save function — used by both the form submit handler AND the
  // unsaved-changes dialog's "Save" path. Throws on validation failure so
  // the dialog stays open.
  const doSave = async (): Promise<void> => {
    // Only the title is required (Song Editor: "Only the title is required").
    if (!formData.title.trim()) {
      throw new Error('Required fields missing')
    }

    const duration = minSecToSeconds(formData.durationMin, formData.durationSec)
    const tags = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const referenceLinks: ReferenceLink[] = links.map(link => ({
      icon: link.icon,
      url: link.url,
      description: link.name,
    }))

    const savedSong: Song = isAddMode
      ? {
          id: crypto.randomUUID(),
          title: formData.title,
          artist: formData.artist,
          album: formData.album || undefined,
          duration,
          key: formData.key,
          guitarTuning: formData.tuning,
          tuningId: formData.tuningId,
          bpm: parseInt(formData.bpm) || 0,
          tags,
          notes: formData.notes || undefined,
          referenceLinks,
          difficulty: 1 as const,
          structure: [],
          chords: [],
          createdDate: new Date(),
          confidenceLevel: 1,
          contextType: 'band',
          contextId: '',
          createdBy: '',
          visibility: 'band',
        }
      : {
          ...song!,
          title: formData.title,
          artist: formData.artist,
          album: formData.album || undefined,
          duration,
          key: formData.key,
          guitarTuning: formData.tuning,
          tuningId: formData.tuningId,
          bpm: parseInt(formData.bpm) || 0,
          tags,
          notes: formData.notes || undefined,
          referenceLinks,
        }

    await onSave(
      savedSong,
      showPersonalCheckbox ? { alsoSaveToPersonal } : undefined
    )

    // Mark the form clean so unsaved-changes checks read as pristine.
    // (Mirror the currentSnapshot shape, excluding the backfilled tuningId.)
    initialSnapshotRef.current = JSON.stringify({
      formData: { ...formData, tuningId: undefined },
      links: links.map(l => ({
        icon: l.icon,
        url: l.url,
        description: l.description,
      })),
    })
  }

  // Unsaved-changes guard wired to the form's dirty state.
  const { dialogProps, requestClose } = useUnsavedChanges({
    isDirty,
    onSave: doSave,
    title: 'Discard changes?',
    message: changedFieldsMessage(song, formData, links),
  })

  // Close handler for backdrop / X / Cancel. Pops the blocking dialog if
  // there are unsaved changes.
  const handleClose = async () => {
    const proceed = await requestClose()
    if (proceed) onClose()
  }

  // Form submit handler — swallows doSave's validation error silently
  // (required-field UI already prompts via the `required` attribute).
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await doSave()
    } catch {
      // Validation errors are surfaced inline via required-field handling.
    }
  }

  const showMatches =
    isAddMode &&
    !spotifyPicked &&
    formData.title.trim().length >= 3 &&
    (spotify.results.length > 0 || spotify.isLoading)

  return (
    <div
      className="fixed inset-0 z-50 bg-bg-1 overflow-y-auto custom-scrollbar"
      data-testid="edit-song-screen"
    >
      <form onSubmit={handleSubmit} className="min-h-full">
        <header className="sticky top-0 z-10 bg-bg-1/95 backdrop-blur">
          <div className="max-w-xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center h-16 px-4">
            <button
              type="button"
              onClick={handleClose}
              className="justify-self-start text-[16px] font-semibold text-ink-2 hover:text-ink-1"
              data-testid="edit-song-modal-close"
            >
              Cancel
            </button>
            <h2 className="text-[17px] font-bold text-ink-1">
              {isAddMode ? 'Add song' : 'Edit song'}
            </h2>
            <button
              type="submit"
              data-testid="song-submit-button"
              className="justify-self-end h-10 px-5 rounded-full bg-accent text-on-accent text-[15px] font-bold hover:bg-accent-deep"
            >
              Save
            </button>
          </div>
        </header>

        <div className="max-w-xl mx-auto px-4 pb-16 space-y-3">
          <div className={CARD}>
            <div
              className={`${FIELD} rounded-[18px] focus-within:ring-2 focus-within:ring-accent`}
            >
              <label htmlFor="song-title" className={LABEL}>
                Title <span className="text-accent">Required</span>
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
                placeholder="Song title"
                autoFocus={isAddMode}
                autoComplete="off"
                className={INPUT}
                required
              />
            </div>
          </div>

          {showMatches && (
            <div className={`${CARD} p-3`} data-testid="spotify-matches">
              <p className="flex items-center gap-2 px-1 pb-2 text-[12.5px] text-ink-3">
                <span className="text-[#1DB954]">●</span> From Spotify · tap to
                fill in
              </p>
              {spotify.results.map(track => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => handleSpotifySelect(track)}
                  data-testid="spotify-match"
                  className="w-full flex items-center gap-3 p-1.5 rounded-xl text-left hover:bg-bg-3"
                >
                  {track.albumArt ? (
                    <img
                      src={track.albumArt}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-lg bg-bg-4" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[15px] font-bold text-ink-1">
                      {track.name}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {track.artist} · {track.album}
                    </span>
                  </span>
                  <span className="font-mono text-[13px] text-ink-2">
                    {formatSeconds(
                      SpotifyService.durationToSeconds(track.durationMs)
                    )}
                  </span>
                </button>
              ))}
              <p className="px-1 pt-2 text-[12.5px] text-ink-3">
                Or keep typing. Only the title is required.
              </p>
            </div>
          )}

          <div className={`${CARD} divide-y divide-divider`}>
            <div className={FIELD}>
              <label htmlFor="song-artist" className={LABEL}>
                Artist
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
                placeholder="Optional"
                className={INPUT}
              />
            </div>
            <div className={FIELD}>
              <label htmlFor="song-album" className={LABEL}>
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
                placeholder="Optional"
                className={INPUT}
              />
            </div>
          </div>

          <div className={`${CARD} divide-y divide-divider`}>
            <div className={FIELD}>
              <label htmlFor="song-tuning" className={LABEL}>
                Tuning
              </label>
              <div data-testid="song-tuning-select">
                <Dropdown
                  data-testid="song-tuning"
                  value={formData.tuningId}
                  onChange={handleTuningChange}
                  groups={tuningGroups}
                  placeholder="Choose a tuning"
                  footerActions={[
                    {
                      label: 'New tuning',
                      icon: <Plus size={15} />,
                      onClick: () => setCreatingTuning(true),
                    },
                    {
                      label: 'Manage tunings',
                      icon: <Settings2 size={15} />,
                      onClick: () => navigate('/settings'),
                    },
                  ]}
                  renderTriggerLabel={opt => {
                    // Selected DB tuning → its dot + name. Legacy song with only
                    // a guitarTuning label (id not yet resolved) → show that label.
                    const color = opt
                      ? opt.color
                      : formData.tuning
                        ? tuningColor(formData.tuning)
                        : undefined
                    const label = opt
                      ? opt.label
                      : formData.tuning
                        ? tuningLabel(formData.tuning)
                        : null
                    if (!label)
                      return (
                        <span className="text-ink-4 truncate">
                          Choose a tuning
                        </span>
                      )
                    return (
                      <>
                        {color && (
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                        )}
                        <span className="truncate">{label}</span>
                      </>
                    )
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-divider">
              <div className={FIELD}>
                <span className={LABEL}>Key</span>
                <button
                  type="button"
                  id="song-key"
                  data-testid="song-key-button"
                  onClick={() => setShowCircleOfFifths(true)}
                  className={`${INPUT} text-left font-mono ${formData.key ? '' : 'text-ink-4'}`}
                >
                  {formData.key || 'Optional'}
                </button>
              </div>
              <div className={FIELD}>
                <label htmlFor="song-bpm" className={LABEL}>
                  BPM
                </label>
                <input
                  type="text"
                  inputMode="numeric"
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
                  placeholder="—"
                  className={`${INPUT} font-mono`}
                />
              </div>
              <div className={FIELD}>
                <span className={LABEL}>Length</span>
                <div className="flex items-center font-mono">
                  <input
                    type="text"
                    inputMode="numeric"
                    name="durationMinutes"
                    id="song-duration-minutes"
                    aria-label="Minutes"
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
                    className={`${INPUT_BARE} w-[2.2ch] text-right`}
                  />
                  <span className="text-ink-3 font-semibold">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="durationSeconds"
                    id="song-duration-seconds"
                    aria-label="Seconds"
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
                    className={`${INPUT_BARE} w-[2.6ch]`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Reference Links - inline editing */}
          <div>
            <p className="px-1 pt-3 pb-2 font-mono text-[11px] tracking-[.14em] uppercase text-ink-3">
              Links
            </p>

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
                      className="p-3 bg-bg-0 border border-accent/50 rounded-lg space-y-3"
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
                          className={`w-full h-11 px-3 bg-bg-1 border rounded-lg text-ink-1 text-sm placeholder-ink-5 focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                            getUrlError(linkUrl)
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-border-1 focus:border-accent'
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
                            className="w-full h-11 px-3 bg-bg-1 border border-border-1 rounded-md text-ink-1 text-sm placeholder-ink-5 focus:border-accent focus:outline-none"
                          />
                          {linkName.length >= LABEL_MAX_LENGTH - 10 && (
                            <p
                              className={`mt-1 text-xs ${linkName.length >= LABEL_MAX_LENGTH ? 'text-red-400' : 'text-ink-4'}`}
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
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-border-1 text-ink-4 hover:text-red-400 hover:border-red-400/50 hover:bg-red-400/10 transition-colors"
                          title="Cancel"
                          data-testid="cancel-edit-link-button"
                        >
                          <X size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!isValidUrl(linkUrl)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-border-1 text-ink-4 hover:text-green-400 hover:border-green-400/50 hover:bg-green-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-ink-4 disabled:hover:border-border-1 disabled:hover:bg-transparent"
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
                    className="flex items-center gap-3 p-3 bg-bg-1 border border-border-1 rounded-lg group hover:border-border-2 transition-colors"
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
                        className="text-ink-1 text-sm hover:text-accent transition-colors truncate block"
                      >
                        {link.name || getLinkPresetName(link.icon)}
                      </a>
                      <span className="text-xs text-ink-5 truncate block">
                        {link.url}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditLink(link)}
                        className="p-1.5 text-ink-4 hover:text-ink-1 hover:bg-border-1 rounded transition-colors"
                        title="Edit link"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(link.id)}
                        className="p-1.5 text-ink-4 hover:text-danger hover:bg-border-1 rounded transition-colors"
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
                <div className="border border-border-1 border-dashed rounded-lg">
                  {!isAddingLink ? (
                    /* Idle state - show "Add another link..." button */
                    <button
                      type="button"
                      onClick={handleStartAddLink}
                      className="w-full p-3 flex items-center justify-center gap-2 text-ink-4 hover:text-ink-3 hover:bg-bg-1 rounded-lg transition-colors"
                      data-testid="start-add-link-button"
                    >
                      <Plus size={18} />
                      <span className="text-sm">Add another link...</span>
                    </button>
                  ) : (
                    /* Active add mode - show 3-row input form */
                    <div className="p-3 bg-bg-0 space-y-3">
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
                          className={`w-full h-11 px-3 bg-bg-1 border rounded-lg text-ink-1 text-sm placeholder-ink-5 focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                            getUrlError(linkUrl)
                              ? 'border-red-500/50 focus:border-red-500'
                              : 'border-border-1 focus:border-accent'
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
                            className="w-full h-11 px-3 bg-bg-1 border border-border-1 rounded-md text-ink-1 text-sm placeholder-ink-5 focus:border-accent focus:outline-none"
                          />
                          {linkName.length >= LABEL_MAX_LENGTH - 10 && (
                            <p
                              className={`mt-1 text-xs ${linkName.length >= LABEL_MAX_LENGTH ? 'text-red-400' : 'text-ink-4'}`}
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
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-border-1 text-ink-4 hover:text-red-400 hover:border-red-400/50 hover:bg-red-400/10 transition-colors"
                          title="Cancel"
                          data-testid="cancel-add-link-button"
                        >
                          <X size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!isValidUrl(linkUrl)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg border border-border-1 text-ink-4 hover:text-green-400 hover:border-green-400/50 hover:bg-green-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-ink-4 disabled:hover:border-border-1 disabled:hover:bg-transparent"
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

          <div className={CARD}>
            <div className={FIELD}>
              <label htmlFor="song-tags" className={LABEL}>
                Tags
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
                placeholder="90s, Opener"
                className={INPUT}
              />
            </div>
          </div>

          {showPersonalCheckbox && (
            <label
              htmlFor="song-also-save-personal"
              className={`${CARD} flex items-center gap-3 px-4 py-3.5 cursor-pointer`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[15.5px] font-bold text-ink-1">
                  Also add to My Songs
                </span>
                <span className="block text-[12.5px] text-ink-3">
                  A linked copy that follows the band's version
                </span>
              </span>
              <input
                type="checkbox"
                name="alsoSaveToPersonal"
                id="song-also-save-personal"
                data-testid="song-also-save-personal-checkbox"
                checked={alsoSaveToPersonal}
                onChange={e => setAlsoSaveToPersonal(e.target.checked)}
                className="w-5 h-5 accent-[rgb(var(--accent-rgb))] cursor-pointer"
              />
            </label>
          )}
        </div>
      </form>

      {/* Circle of Fifths Modal */}
      {showCircleOfFifths && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowCircleOfFifths(false)}
        >
          <div
            className="bg-bg-2 rounded-2xl border border-border-1 p-4 sm:p-6 w-full max-w-[min(90vw,500px)] max-h-[90vh] overflow-y-auto custom-scrollbar-thin"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-ink-1">
                Select Key
              </h3>
              <button
                onClick={() => setShowCircleOfFifths(false)}
                className="p-1 text-ink-4 hover:text-ink-1 transition-colors"
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

      {/* Create custom tuning (from the tuning picker's "New tuning" action) */}
      {creatingTuning && (
        <CreateTuningModal
          onClose={() => setCreatingTuning(false)}
          onCreated={async created => {
            setCreatingTuning(false)
            await refetchTunings()
            // Select the freshly-created tuning on this song.
            setFormData(f => ({
              ...f,
              tuningId: created.id,
              tuning: created.name,
            }))
          }}
        />
      )}

      {/* Unsaved changes guard */}
      <UnsavedChangesDialog {...dialogProps} />
    </div>
  )
}

export default EditSongModal
