import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SpotifyTrack,
  getSpotifyService,
} from '../services/spotify/SpotifyService'

export interface UseSpotifySearchOptions {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number
  /** Minimum query length before searching (default: 3) */
  minQueryLength?: number
  /** Maximum results to return (default: 10) */
  limit?: number
}

export interface UseSpotifySearchResult {
  /** Current search query */
  query: string
  /** Set the search query */
  setQuery: (query: string) => void
  /** Search results */
  results: SpotifyTrack[]
  /** Loading state */
  isLoading: boolean
  /** Error message if search failed */
  error: string | null
  /** Clear search state */
  clear: () => void
}

/**
 * Hook for searching Spotify tracks with debouncing
 *
 * @param options - Configuration options
 * @returns Search state and controls
 *
 * @example
 * function SongSearch() {
 *   const { query, setQuery, results, isLoading, error } = useSpotifySearch()
 *
 *   return (
 *     <div>
 *       <input
 *         value={query}
 *         onChange={(e) => setQuery(e.target.value)}
 *         placeholder="Search for a song..."
 *       />
 *       {isLoading && <span>Searching...</span>}
 *       {error && <span className="error">{error}</span>}
 *       <ul>
 *         {results.map(track => (
 *           <li key={track.id}>{track.name} by {track.artist}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 */
export function useSpotifySearch(
  options: UseSpotifySearchOptions = {}
): UseSpotifySearchResult {
  const { debounceMs = 300, minQueryLength = 3, limit = 10 } = options

  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<SpotifyTrack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track current search to prevent race conditions
  const currentSearchRef = useRef<string | null>(null)

  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery)

      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // If query is too short, clear results immediately
      if (!newQuery.trim() || newQuery.trim().length < minQueryLength) {
        setResults([])
        setError(null)
        setIsLoading(false)
        return
      }

      // Start debounce timer
      debounceTimerRef.current = setTimeout(async () => {
        const trimmedQuery = newQuery.trim()

        // Store current search to check for race conditions
        currentSearchRef.current = trimmedQuery

        setIsLoading(true)
        setError(null)

        try {
          const service = getSpotifyService()
          const result = await service.searchTracks(trimmedQuery, limit)

          // Only update if this is still the current search
          if (currentSearchRef.current === trimmedQuery) {
            setResults(result.tracks)
          }
        } catch (err) {
          // Only update if this is still the current search
          if (currentSearchRef.current === trimmedQuery) {
            setError(err instanceof Error ? err.message : 'Search failed')
            setResults([])
          }
        } finally {
          // Only update if this is still the current search
          if (currentSearchRef.current === trimmedQuery) {
            setIsLoading(false)
          }
        }
      }, debounceMs)
    },
    [debounceMs, minQueryLength, limit]
  )

  const clear = useCallback(() => {
    // Clear timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Reset state
    setQueryState('')
    setResults([])
    setError(null)
    setIsLoading(false)
    currentSearchRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clear,
  }
}
