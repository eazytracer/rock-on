import React, { useState, useMemo } from 'react'
import { Search, Plus, Clock, Guitar, List } from 'lucide-react'
import { SlideOutTray } from './SlideOutTray'
import { Song } from '../../models/Song'
import { Setlist } from '../../models/Setlist'

// Generate consistent avatar color from song title
const generateAvatarColor = (title: string): string => {
  const colors = [
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#f43f5e',
    '#14b8a6',
    '#ef4444',
    '#6366f1',
    '#a855f7',
    '#84cc16',
    '#eab308',
    '#10b981',
    '#06b6d4',
    '#d946ef',
    '#f97316',
  ]
  const index = title.charCodeAt(0) % colors.length
  return colors[index]
}

interface BrowseSongsDrawerProps {
  isOpen: boolean
  onClose: () => void
  songs: Song[] // All available songs
  selectedSongIds: string[] // Songs already added (to filter out)
  onAddSong: (song: Song) => void // Called when user clicks to add
  setlists?: Setlist[] // For setlist filter dropdown
  onAddAllFromSetlist?: (songs: Song[]) => void // Add all songs from selected setlist
}

export const BrowseSongsDrawer: React.FC<BrowseSongsDrawerProps> = ({
  isOpen,
  onClose,
  songs,
  selectedSongIds,
  onAddSong,
  setlists = [],
  onAddAllFromSetlist,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTuning, setSelectedTuning] = useState('')
  const [selectedSetlistId, setSelectedSetlistId] = useState('')

  // Extract unique tunings from songs
  const availableTunings = useMemo(() => {
    const tunings = new Set<string>()
    songs.forEach(song => {
      if (song.guitarTuning) {
        tunings.add(song.guitarTuning)
      }
    })
    return Array.from(tunings).sort()
  }, [songs])

  // Filter songs by search, tuning, setlist, and exclude already selected
  const filteredSongs = useMemo(() => {
    const selectedSongIdsSet = new Set(selectedSongIds)

    let filtered = songs.filter(song => !selectedSongIdsSet.has(song.id))

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        song =>
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query)
      )
    }

    // Apply tuning filter
    if (selectedTuning) {
      filtered = filtered.filter(song => song.guitarTuning === selectedTuning)
    }

    // Apply setlist filter
    if (selectedSetlistId) {
      const setlist = setlists.find(s => s.id === selectedSetlistId)
      if (setlist) {
        const setlistSongIds = new Set(
          setlist.items
            .filter(item => item.type === 'song')
            .map(item => item.songId!)
        )
        filtered = filtered.filter(song => setlistSongIds.has(song.id))
      }
    }

    return filtered
  }, [
    songs,
    selectedSongIds,
    searchQuery,
    selectedTuning,
    selectedSetlistId,
    setlists,
  ])

  // Get songs from selected setlist for "Add All" functionality
  const selectedSetlistSongs = useMemo(() => {
    if (!selectedSetlistId) return []

    const setlist = setlists.find(s => s.id === selectedSetlistId)
    if (!setlist) return []

    const setlistSongIds = new Set(
      setlist.items
        .filter(item => item.type === 'song')
        .map(item => item.songId!)
    )

    const selectedSongIdsSet = new Set(selectedSongIds)

    return songs.filter(
      song => setlistSongIds.has(song.id) && !selectedSongIdsSet.has(song.id)
    )
  }, [selectedSetlistId, setlists, songs, selectedSongIds])

  const selectedSetlist = setlists.find(s => s.id === selectedSetlistId)

  const handleAddAllFromSetlist = () => {
    if (onAddAllFromSetlist && selectedSetlistSongs.length > 0) {
      onAddAllFromSetlist(selectedSetlistSongs)
    }
  }

  return (
    <SlideOutTray
      isOpen={isOpen}
      onClose={onClose}
      title="Browse Songs"
      width="480px"
    >
      <div className="flex flex-col h-full">
        {/* Search and Filters */}
        <div className="px-6 py-4 border-b border-[#2a2a2a] space-y-3 flex-shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]"
            />
            <input
              type="text"
              placeholder="Search songs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              data-testid="browse-songs-search-input"
            />
          </div>

          {/* Tuning Filter */}
          <select
            value={selectedTuning}
            onChange={e => setSelectedTuning(e.target.value)}
            className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
            data-testid="browse-songs-tuning-filter"
          >
            <option value="">All Tunings</option>
            {availableTunings.map(tuning => (
              <option key={tuning} value={tuning}>
                {tuning}
              </option>
            ))}
          </select>

          {/* Setlist Filter */}
          {setlists.length > 0 && (
            <select
              value={selectedSetlistId}
              onChange={e => setSelectedSetlistId(e.target.value)}
              className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
              data-testid="browse-songs-setlist-filter"
            >
              <option value="">All Songs</option>
              {setlists.map(setlist => (
                <option key={setlist.id} value={setlist.id}>
                  {setlist.name}
                </option>
              ))}
            </select>
          )}

          {/* Add All from Setlist Button */}
          {selectedSetlistId &&
            selectedSetlistSongs.length > 0 &&
            onAddAllFromSetlist && (
              <button
                onClick={handleAddAllFromSetlist}
                className="w-full h-10 px-4 bg-[#f17827ff] hover:bg-[#d96a1f] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                data-testid="browse-songs-add-all-button"
              >
                <List size={18} />
                Add All from {selectedSetlist?.name} (
                {selectedSetlistSongs.length})
              </button>
            )}
        </div>

        {/* Songs List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-6 py-4">
          <div data-testid="browse-songs-list" className="space-y-2">
            {filteredSongs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#707070] text-sm">No songs available</p>
                <p className="text-[#505050] text-xs mt-1">
                  {selectedSongIds.length > 0
                    ? 'All matching songs have been added'
                    : 'Try adjusting your search or filters'}
                </p>
              </div>
            ) : (
              filteredSongs.map(song => (
                <button
                  key={song.id}
                  onClick={() => onAddSong(song)}
                  data-testid={`browse-song-${song.id}`}
                  className="w-full flex items-center gap-3 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#f17827ff] hover:bg-[#1f1f1f] transition-colors text-left group"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
                    style={{
                      backgroundColor: generateAvatarColor(song.title),
                    }}
                  >
                    {song.artist
                      .split(' ')
                      .map(word => word[0])
                      .join('')
                      .substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold truncate">
                      {song.title}
                    </div>
                    <div className="text-[#707070] text-xs truncate">
                      {song.artist}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#505050]">
                      <span className="flex items-center gap-1">
                        <Guitar size={12} />
                        {song.guitarTuning || 'Standard'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {Math.floor(song.duration / 60)}:
                        {String(song.duration % 60).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  <Plus
                    size={18}
                    className="text-[#505050] group-hover:text-[#f17827ff] transition-colors flex-shrink-0"
                  />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </SlideOutTray>
  )
}
