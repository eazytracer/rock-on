import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Song } from '../../models/Song'
import { Band } from '../../models/Band'
import { SongList } from '../../components/songs/SongList'
import { AddSongForm } from '../../components/songs/AddSongForm'
import { TouchButton } from '../../components/common/TouchButton'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { SongContextTabs, SongContext } from '../../components/songs/SongContextTabs'
import { SongLinkingSuggestions } from '../../components/songs/SongLinkingSuggestions'
import { LinkedSongView } from '../../components/songs/LinkedSongView'
import { SongLinkingService, LinkingSuggestion } from '../../services/SongLinkingService'
import { useAuth } from '../../contexts/AuthContext'
import { InitialSetupService } from '../../services/setup/InitialSetupService'
import { BandMembershipService } from '../../services/BandMembershipService'
import { db } from '../../services/database'

interface SongsProps {
  songs: Song[]
  loading?: boolean
  onAddSong?: (songData: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel' | 'contextType' | 'contextId' | 'createdBy' | 'visibility' | 'songGroupId' | 'linkedFromSongId'>) => Promise<void>
  onEditSong?: (songId: string, songData: Partial<Song>) => Promise<void>
  onDeleteSong?: (songId: string) => Promise<void>
  onSongClick?: (song: Song) => void
  onCreate?: () => void
  onBack?: () => void
}

type ViewMode = 'list' | 'add' | 'edit'

export const Songs: React.FC<SongsProps> = ({
  songs,
  loading = false,
  onAddSong,
  onEditSong,
  onDeleteSong,
  onSongClick,
  onCreate,
  onBack
}) => {
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeContext, setActiveContext] = useState<SongContext>('band')
  const [activeBandId, setActiveBandId] = useState<string>('')
  const [availableBands, setAvailableBands] = useState<{ id: string; name: string }[]>([])
  const [linkingSuggestions, setLinkingSuggestions] = useState<LinkingSuggestion[]>([])
  const [viewingLinkedSong, setViewingLinkedSong] = useState<Song | null>(null)
  const [linkedSongsData, setLinkedSongsData] = useState<any>(null)
  const [stats, setStats] = useState({
    total: 0,
    ready: 0,
    needsPractice: 0,
    new: 0,
    averageConfidence: 0
  })

  // Initialize default band and load available bands on mount
  useEffect(() => {
    const initializeBands = async () => {
      if (user?.id) {
        // Get user's band memberships
        const memberships = await BandMembershipService.getUserBands(user.id)

        // Fetch band details for each membership
        const bandPromises = memberships.map(membership =>
          db.bands.get(membership.bandId)
        )
        const bands = await Promise.all(bandPromises)

        // Filter out undefined bands and map to the format needed by SongContextTabs
        const validBands = bands
          .filter((band): band is Band => band !== undefined)
          .map(band => ({ id: band.id, name: band.name }))

        setAvailableBands(validBands)

        // Set default band
        const defaultBandId = await InitialSetupService.getUserDefaultBand(user.id)
        if (defaultBandId) {
          setActiveBandId(defaultBandId)
        } else if (validBands.length > 0) {
          // If no default, use the first available band
          setActiveBandId(validBands[0].id)
        }
      }
    }
    initializeBands()
  }, [user])

  // Filter songs by context - memoized to prevent infinite loops
  const contextFilteredSongs = useMemo(() => {
    return songs.filter(song => {
      if (activeContext === 'personal') {
        return song.contextType === 'personal' && song.contextId === user?.id
      } else {
        return song.contextType === 'band' && song.contextId === activeBandId
      }
    })
  }, [songs, activeContext, activeBandId, user?.id])

  // Calculate stats whenever filtered songs change
  const calculateStats = useCallback(() => {
    const total = contextFilteredSongs.length
    const ready = contextFilteredSongs.filter(song => song.confidenceLevel >= 4).length
    const needsPractice = contextFilteredSongs.filter(song => song.confidenceLevel >= 2 && song.confidenceLevel < 4).length
    const newSongs = contextFilteredSongs.filter(song => song.confidenceLevel < 2).length
    const averageConfidence = total > 0
      ? contextFilteredSongs.reduce((sum, song) => sum + song.confidenceLevel, 0) / total
      : 0

    setStats({
      total,
      ready,
      needsPractice,
      new: newSongs,
      averageConfidence
    })
  }, [contextFilteredSongs])

  useEffect(() => {
    calculateStats()
  }, [calculateStats])

  // Load linking suggestions when songs change
  useEffect(() => {
    const loadLinkingSuggestions = async () => {
      console.log('[Songs] Loading linking suggestions...', {
        hasUser: !!user,
        contextFilteredSongsCount: contextFilteredSongs.length,
        activeContext,
        activeBandId
      })

      if (!user || contextFilteredSongs.length === 0) return

      const allSuggestions: LinkingSuggestion[] = []
      for (const song of contextFilteredSongs.slice(0, 10)) { // Limit to prevent performance issues
        console.log('[Songs] Checking song for suggestions:', song.title, song.artist)
        const suggestions = await SongLinkingService.findLinkingSuggestions(song, user.id!)
        console.log('[Songs] Found suggestions for', song.title, ':', suggestions.length)
        allSuggestions.push(...suggestions)
      }

      // Deduplicate and limit suggestions
      const uniqueSuggestions = allSuggestions
        .filter((s, i, arr) =>
          arr.findIndex(x => x.song.id === s.song.id && x.targetSong.id === s.targetSong.id) === i
        )
        .slice(0, 5)

      console.log('[Songs] Total unique suggestions:', uniqueSuggestions.length)
      setLinkingSuggestions(uniqueSuggestions)
    }

    loadLinkingSuggestions()
  }, [contextFilteredSongs, user, activeContext, activeBandId])

  const handleLink = async (songId: string, targetSongId: string) => {
    if (!user) return

    const song = songs.find(s => s.id === songId)
    const targetSong = songs.find(s => s.id === targetSongId)
    if (!song || !targetSong) return

    await SongLinkingService.linkSongs(
      [songId, targetSongId],
      song.title,
      user.id!,
      `Linked variants of "${song.title}"`
    )

    // Remove the suggestion
    setLinkingSuggestions(prev => prev.filter(s => !(s.song.id === songId && s.targetSong.id === targetSongId)))
  }

  const handleDismissSuggestion = (songId: string, targetSongId: string) => {
    setLinkingSuggestions(prev => prev.filter(s => !(s.song.id === songId && s.targetSong.id === targetSongId)))
  }

  const handleViewLinkedSong = async (song: Song) => {
    if (!song.songGroupId) return

    const songGroup = await SongLinkingService.getSongGroup(song.id!)
    const linkedSongs = await SongLinkingService.getSongsInGroup(song.songGroupId)

    setViewingLinkedSong(song)
    setLinkedSongsData({ songGroup, linkedSongs })
  }

  const handleUnlinkSong = async (songId: string) => {
    await SongLinkingService.unlinkSongFromGroup(songId)
    setViewingLinkedSong(null)
    setLinkedSongsData(null)
  }

  const handleContributeToBand = async (songId: string) => {
    if (!user || !activeBandId) return

    await SongLinkingService.contributePersonalSongToBand(songId, activeBandId, user.id!)

    // Refresh to show the new band song
    window.location.reload() // In a real app, you'd update state properly
  }

  const handleCopyToPersonal = async (songId: string) => {
    if (!user) return

    await SongLinkingService.copyBandSongToPersonal(songId, user.id!)

    // Refresh to show the new personal song
    window.location.reload() // In a real app, you'd update state properly
  }

  const handleAddSong = async (songData: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel' | 'contextType' | 'contextId' | 'createdBy' | 'visibility' | 'songGroupId' | 'linkedFromSongId'>) => {
    if (!onAddSong || !user) return

    setIsSubmitting(true)
    try {
      // Add context information based on active tab
      const contextualSongData = {
        ...songData,
        contextType: activeContext,
        contextId: activeContext === 'personal' ? user.id : activeBandId,
        createdBy: user.id,
        visibility: (activeContext === 'personal' ? 'private' : 'band_only') as 'private' | 'band_only' | 'public'
      } as any

      await onAddSong(contextualSongData)
      setViewMode('list')
    } catch (error) {
      console.error('Failed to add song:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSong = async (songData: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel' | 'contextType' | 'contextId' | 'createdBy' | 'visibility' | 'songGroupId' | 'linkedFromSongId'>) => {
    if (!onEditSong || !selectedSong) return

    setIsSubmitting(true)
    try {
      await onEditSong(selectedSong.id, songData)
      setViewMode('list')
      setSelectedSong(null)
    } catch (error) {
      console.error('Failed to edit song:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSong = async (song: Song) => {
    if (!onDeleteSong) return

    const confirmed = window.confirm(`Are you sure you want to delete "${song.title}" by ${song.artist}?`)
    if (!confirmed) return

    try {
      await onDeleteSong(song.id)
    } catch (error) {
      console.error('Failed to delete song:', error)
    }
  }

  const handleSongEdit = (song: Song) => {
    setSelectedSong(song)
    setViewMode('edit')
  }

  const handleCancel = () => {
    setViewMode('list')
    setSelectedSong(null)
  }

  const handleCreateClick = () => {
    if (onCreate) {
      onCreate()
    } else {
      setViewMode('add')
    }
  }

  if (viewMode === 'add') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="mr-4"
          >
            ← Back
          </TouchButton>
          <h1 className="text-2xl font-bold text-steel-gray">Add New Song</h1>
        </div>
        <AddSongForm
          onSubmit={handleAddSong}
          onCancel={handleCancel}
          loading={isSubmitting}
        />
      </div>
    )
  }

  if (viewMode === 'edit' && selectedSong) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <TouchButton
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="mr-4"
          >
            ← Back
          </TouchButton>
          <h1 className="text-2xl font-bold text-steel-gray">Edit Song</h1>
        </div>
        <AddSongForm
          onSubmit={handleEditSong}
          onCancel={handleCancel}
          initialData={selectedSong}
          loading={isSubmitting}
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          {onBack && (
            <TouchButton
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-4"
            >
              ← Back
            </TouchButton>
          )}
          <div>
            <h1 className="text-2xl font-bold text-steel-gray">Songs</h1>
            <p className="text-gray-600">
              {activeContext === 'personal'
                ? 'Your personal song catalog'
                : 'Band song catalog'}
            </p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0">
          <TouchButton
            variant="primary"
            size="md"
            onClick={handleCreateClick}
          >
            Add Song
          </TouchButton>
        </div>
      </div>

      {/* Context Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <SongContextTabs
          activeContext={activeContext}
          onContextChange={setActiveContext}
          activeBandId={activeBandId}
          onBandChange={setActiveBandId}
          availableBands={availableBands}
          personalSongCount={songs.filter(s => s.contextType === 'personal' && s.contextId === user?.id).length}
          bandSongCount={songs.filter(s => s.contextType === 'band' && s.contextId === activeBandId).length}
        />
      </div>

      {/* Linking Suggestions */}
      {linkingSuggestions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <SongLinkingSuggestions
            suggestions={linkingSuggestions}
            onLink={handleLink}
            onDismiss={handleDismissSuggestion}
          />
        </div>
      )}

      {/* Linked Song View */}
      {viewingLinkedSong && linkedSongsData && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Linked Song Variants</h2>
            <button
              onClick={() => {
                setViewingLinkedSong(null)
                setLinkedSongsData(null)
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <LinkedSongView
            songGroup={linkedSongsData.songGroup}
            linkedSongs={linkedSongsData.linkedSongs}
            currentSongId={viewingLinkedSong.id}
            onSelectSong={(songId) => {
              const song = songs.find(s => s.id === songId)
              if (song && onSongClick) onSongClick(song)
            }}
            onUnlink={handleUnlinkSong}
            onContributeToBand={handleContributeToBand}
            onCopyToPersonal={handleCopyToPersonal}
          />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-steel-gray">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Songs</div>
        </div>

        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{stats.ready}</div>
          <div className="text-sm text-gray-600">Performance Ready</div>
        </div>

        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">{stats.needsPractice}</div>
          <div className="text-sm text-gray-600">Needs Practice</div>
        </div>

        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-red-600">{stats.new}</div>
          <div className="text-sm text-gray-600">New Songs</div>
        </div>

        <div className="bg-smoke-white p-4 rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-2xl font-bold text-energy-orange">
            {stats.averageConfidence.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600">Avg Confidence</div>
        </div>
      </div>

      {/* Empty State */}
      {contextFilteredSongs.length === 0 && !loading && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-steel-gray">No songs yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeContext === 'personal'
                ? 'Get started by adding your first personal song.'
                : 'Get started by adding your first band song.'}
            </p>
            <div className="mt-6">
              <TouchButton
                variant="primary"
                size="lg"
                onClick={handleCreateClick}
              >
                Add Your First Song
              </TouchButton>
            </div>
          </div>
        </div>
      )}

      {/* Song List */}
      {contextFilteredSongs.length > 0 && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="p-6">
            <SongList
              songs={contextFilteredSongs}
              loading={loading}
              onSongClick={onSongClick}
              onSongEdit={handleSongEdit}
              onSongDelete={handleDeleteSong}
              onViewLinked={handleViewLinkedSong}
              showSearch={true}
              searchPlaceholder="Search songs by title, artist, or tags..."
              virtualized={contextFilteredSongs.length > 50}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {contextFilteredSongs.length > 0 && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold text-steel-gray mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TouchButton
              variant="secondary"
              size="md"
              onClick={() => {
                // Filter to songs that need practice
                const needsPracticeSongs = contextFilteredSongs.filter(song => song.confidenceLevel < 3)
                if (needsPracticeSongs.length > 0 && onSongClick) {
                  onSongClick(needsPracticeSongs[0])
                }
              }}
              disabled={stats.needsPractice === 0 && stats.new === 0}
            >
              Practice Weakest Song
            </TouchButton>

            <TouchButton
              variant="secondary"
              size="md"
              onClick={() => {
                // Filter to songs that haven't been practiced recently
                const unpracticedSongs = contextFilteredSongs.filter(song => !song.lastPracticed)
                if (unpracticedSongs.length > 0 && onSongClick) {
                  onSongClick(unpracticedSongs[0])
                }
              }}
              disabled={contextFilteredSongs.every(song => song.lastPracticed)}
            >
              Practice Unpracticed
            </TouchButton>

            <TouchButton
              variant="secondary"
              size="md"
              onClick={() => {
                // Pick a random song
                if (contextFilteredSongs.length > 0 && onSongClick) {
                  const randomIndex = Math.floor(Math.random() * contextFilteredSongs.length)
                  onSongClick(contextFilteredSongs[randomIndex])
                }
              }}
              disabled={contextFilteredSongs.length === 0}
            >
              Random Song
            </TouchButton>

            <TouchButton
              variant="primary"
              size="md"
              onClick={handleCreateClick}
            >
              Add New Song
            </TouchButton>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && songs.length === 0 && (
        <div className="bg-smoke-white rounded-lg border border-steel-gray/20 shadow-sm">
          <div className="p-12">
            <LoadingSpinner size="lg" centered text="Loading songs..." />
          </div>
        </div>
      )}
    </div>
  )
}