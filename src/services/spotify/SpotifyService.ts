/**
 * SpotifyService - Client for the Spotify search edge function
 *
 * Provides song search functionality using Spotify's catalog.
 * The actual Spotify API calls are handled by the edge function
 * to keep credentials secure.
 */

export interface SpotifyTrack {
  id: string
  name: string
  artist: string
  album: string
  durationMs: number
  spotifyUrl: string
  albumArt?: string
}

export interface SpotifySearchResult {
  tracks: SpotifyTrack[]
  error?: string
}

export class SpotifyService {
  private baseUrl: string
  private anonKey: string

  /**
   * Create a SpotifyService instance
   * @param baseUrl - Supabase functions base URL (e.g., http://localhost:54321/functions/v1)
   * @param anonKey - Supabase anon key for authentication
   */
  constructor(baseUrl: string, anonKey: string) {
    this.baseUrl = baseUrl
    this.anonKey = anonKey
  }

  /**
   * Search for tracks on Spotify
   *
   * @param query - Search query (minimum 3 characters)
   * @param limit - Maximum number of results (default: 10, max: 50)
   * @returns Promise<SpotifySearchResult> - Search results with tracks array
   * @throws Error if search fails or rate limited
   *
   * @example
   * const service = new SpotifyService('http://localhost:54321/functions/v1')
   * const result = await service.searchTracks('Bohemian Rhapsody')
   * result.tracks.forEach(track => {
   *   console.log(`${track.name} by ${track.artist}`)
   * })
   */
  async searchTracks(
    query: string,
    limit: number = 10
  ): Promise<SpotifySearchResult> {
    const response = await fetch(`${this.baseUrl}/spotify-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.anonKey}`,
      },
      body: JSON.stringify({ query, limit }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Spotify search failed')
    }

    return data as SpotifySearchResult
  }

  /**
   * Format duration from milliseconds to mm:ss string
   *
   * @param durationMs - Duration in milliseconds
   * @returns Formatted duration string (e.g., "3:45")
   *
   * @example
   * SpotifyService.formatDuration(225000) // "3:45"
   */
  static formatDuration(durationMs: number): string {
    const totalSeconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  /**
   * Convert duration from milliseconds to seconds
   *
   * @param durationMs - Duration in milliseconds
   * @returns Duration in whole seconds
   *
   * @example
   * SpotifyService.durationToSeconds(225000) // 225
   */
  static durationToSeconds(durationMs: number): number {
    return Math.floor(durationMs / 1000)
  }
}

// Create a singleton instance with the default Supabase URL
// This can be overridden in tests or different environments
let spotifyServiceInstance: SpotifyService | null = null

/**
 * Get the SpotifyService singleton instance
 *
 * @param baseUrl - Optional base URL (uses import.meta.env.VITE_SUPABASE_URL if not provided)
 * @param anonKey - Optional anon key (uses import.meta.env.VITE_SUPABASE_ANON_KEY if not provided)
 * @returns SpotifyService instance
 */
export function getSpotifyService(
  baseUrl?: string,
  anonKey?: string
): SpotifyService {
  if (!spotifyServiceInstance || baseUrl || anonKey) {
    const url =
      baseUrl ||
      `${import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'}/functions/v1`
    const key = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    spotifyServiceInstance = new SpotifyService(url, key)
  }
  return spotifyServiceInstance
}
