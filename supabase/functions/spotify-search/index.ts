// Spotify Search Edge Function
// Uses Client Credentials flow (no user login required)
// Proxies Spotify search to hide API credentials from client

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Types
interface SpotifyToken {
  access_token: string
  token_type: string
  expires_in: number
}

interface SpotifyTrackSimplified {
  id: string
  name: string
  artist: string
  album: string
  durationMs: number
  spotifyUrl: string
  albumArt?: string
}

interface SearchRequest {
  query: string
  limit?: number
}

interface SearchResponse {
  tracks: SpotifyTrackSimplified[]
  error?: string
}

// Token cache (in-memory, resets on cold start)
let cachedToken: string | null = null
let tokenExpiry: number = 0

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

/**
 * Get access token using Client Credentials flow
 * https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow
 */
async function getSpotifyToken(): Promise<string> {
  const now = Date.now()

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured')
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Spotify token error:', errorText)
    throw new Error('Failed to get Spotify access token')
  }

  const data: SpotifyToken = await response.json()

  // Cache the token
  cachedToken = data.access_token
  tokenExpiry = now + data.expires_in * 1000

  return data.access_token
}

/**
 * Search Spotify tracks
 * https://developer.spotify.com/documentation/web-api/reference/search
 */
async function searchTracks(
  query: string,
  limit: number = 10
): Promise<SpotifyTrackSimplified[]> {
  const token = await getSpotifyToken()

  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: Math.min(limit, 50).toString(), // Spotify max is 50
    market: 'US', // Use US market for consistent results
  })

  const response = await fetch(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '5'
    throw new Error(`Rate limited. Retry after ${retryAfter} seconds`)
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Spotify search error:', errorText)
    throw new Error('Spotify search failed')
  }

  const data = await response.json()

  // Transform Spotify response to our simplified format
  return (data.tracks?.items || []).map(
    (track: {
      id: string
      name: string
      duration_ms: number
      artists: Array<{ name: string }>
      album: {
        name: string
        images: Array<{ url: string; height?: number }>
      }
      external_urls: { spotify: string }
    }) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      durationMs: track.duration_ms,
      spotifyUrl: track.external_urls.spotify,
      // Get smallest image (64x64) for performance, or fallback to first
      albumArt:
        track.album.images.find(img => img.height === 64)?.url ||
        track.album.images[0]?.url,
    })
  )
}

serve(async req => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only accept POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body: SearchRequest = await req.json()

    // Validate input
    if (!body.query || typeof body.query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Require minimum query length to prevent excessive API calls
    if (body.query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Query must be at least 3 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const tracks = await searchTracks(body.query, body.limit || 10)

    const response: SearchResponse = { tracks }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Edge function error:', error)

    const message =
      error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Rate limited') ? 429 : 500

    return new Response(JSON.stringify({ error: message, tracks: [] }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
