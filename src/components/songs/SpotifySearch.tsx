import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Music2, Loader2 } from 'lucide-react'
import { useSpotifySearch } from '../../hooks/useSpotifySearch'
import {
  SpotifyService,
  SpotifyTrack,
} from '../../services/spotify/SpotifyService'

export interface SpotifySearchProps {
  /** Callback when a track is selected */
  onSelect: (track: SpotifyTrack) => void
  /** Placeholder text for search input */
  placeholder?: string
  /** Auto-focus the input on mount */
  autoFocus?: boolean
}

/**
 * Spotify search component with debounced input and result selection
 *
 * @example
 * <SpotifySearch
 *   onSelect={(track) => {
 *     setTitle(track.name)
 *     setArtist(track.artist)
 *     setDuration(Math.floor(track.durationMs / 1000))
 *     addLink({ type: 'spotify', url: track.spotifyUrl })
 *   }}
 * />
 */
export const SpotifySearch: React.FC<SpotifySearchProps> = ({
  onSelect,
  placeholder = 'Search Spotify for a song...',
  autoFocus = false,
}) => {
  const { query, setQuery, results, isLoading, error, clear } =
    useSpotifySearch()

  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Handle track selection
  const handleSelect = useCallback(
    (track: SpotifyTrack) => {
      onSelect(track)
      clear()
    },
    [onSelect, clear]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (results.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0))
          break
        case 'Enter':
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < results.length) {
            handleSelect(results[focusedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          clear()
          inputRef.current?.blur()
          break
      }
    },
    [results, focusedIndex, handleSelect, clear]
  )

  // Reset focused index when results change
  useEffect(() => {
    setFocusedIndex(-1)
  }, [results])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement
      if (item && typeof item.scrollIntoView === 'function') {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [focusedIndex])

  const showResults = query.length >= 3 && (results.length > 0 || !isLoading)
  const showNoResults =
    query.length >= 3 && results.length === 0 && !isLoading && !error

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]"
          size={18}
        />
        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder-[#606060] focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954] transition-colors"
          data-testid="spotify-search-input"
        />
        {isLoading && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1DB954] animate-spin"
            size={18}
          />
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mt-2 text-sm text-[#707070]">Searching...</div>
      )}

      {/* Error State */}
      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}

      {/* Results List */}
      {showResults && results.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 w-full mt-2 max-h-[300px] overflow-y-auto custom-scrollbar bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-lg shadow-black/50"
          data-testid="spotify-search-results"
        >
          {results.map((track, index) => (
            <li
              key={track.id}
              role="option"
              aria-selected={index === focusedIndex}
              onClick={() => handleSelect(track)}
              onMouseEnter={() => setFocusedIndex(index)}
              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                index === focusedIndex ? 'bg-[#2a2a2a]' : 'hover:bg-[#252525]'
              }`}
              data-testid={`spotify-result-${track.id}`}
            >
              {/* Album Art */}
              {track.albumArt ? (
                <img
                  src={track.albumArt}
                  alt={`${track.name} album art`}
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded bg-[#2a2a2a] flex items-center justify-center flex-shrink-0"
                  data-testid="album-art-placeholder"
                >
                  <Music2 size={20} className="text-[#505050]" />
                </div>
              )}

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">
                  {track.name}
                </div>
                <div className="text-[#a0a0a0] text-xs truncate">
                  {track.artist}
                </div>
                <div className="text-[#707070] text-xs truncate">
                  {track.album}
                </div>
              </div>

              {/* Duration */}
              <div className="text-[#707070] text-sm flex-shrink-0">
                {SpotifyService.formatDuration(track.durationMs)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* No Results State */}
      {showNoResults && (
        <div className="absolute z-50 w-full mt-2 p-4 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-center text-[#707070] text-sm">
          No results found
        </div>
      )}
    </div>
  )
}

export default SpotifySearch
