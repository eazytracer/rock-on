---
feature: Spotify Integration
created: 2026-01-19T23:59
status: research-complete
agent: research-agent
parent-feature: external-links-enhancements
---

# Spotify Integration - Research

## Overview

Integrate Spotify Web API to enhance the song creation experience:

1. **Phase 1 (MVP):** Auto-complete song search to pre-fill title, artist, duration, and Spotify link
2. **Phase 2 (Future):** Convert setlists to Spotify playlists
3. **Phase 3 (Future):** Get song recommendations for setlists

## Spotify Web API Analysis

### Authentication Options

Based on [Spotify's Authorization documentation](https://developer.spotify.com/documentation/web-api/concepts/authorization):

| Flow                          | Use Case                       | User Login | Token Type |
| ----------------------------- | ------------------------------ | ---------- | ---------- |
| **Client Credentials**        | Server-to-server, no user data | No         | App token  |
| **Authorization Code (PKCE)** | User actions (playlists)       | Yes        | User token |

**For Phase 1 (Search):** Client Credentials flow is sufficient - search doesn't require user login.

**For Phases 2-3 (Playlists):** Requires Authorization Code flow with user consent.

### API Endpoints Needed

| Phase | Endpoint                             | Auth               | Scopes                                                |
| ----- | ------------------------------------ | ------------------ | ----------------------------------------------------- |
| 1     | `GET /v1/search?type=track`          | Client Credentials | None                                                  |
| 2     | `POST /v1/users/{user_id}/playlists` | User OAuth         | `playlist-modify-public` or `playlist-modify-private` |
| 2     | `POST /v1/playlists/{id}/tracks`     | User OAuth         | `playlist-modify-public/private`                      |
| 3     | `GET /v1/recommendations`            | Client Credentials | None                                                  |

### Search Response Format

From [Spotify Search Reference](https://developer.spotify.com/documentation/web-api/reference/search):

```json
{
  "tracks": {
    "items": [
      {
        "id": "4iV5W9uYEdYUVa79Axb7Rh",
        "name": "Bohemian Rhapsody",
        "duration_ms": 354947,
        "artists": [
          {
            "id": "1dfeR4HaWDbWqFHLkxsg1d",
            "name": "Queen"
          }
        ],
        "album": {
          "name": "A Night at the Opera",
          "images": [{ "url": "https://..." }]
        },
        "external_urls": {
          "spotify": "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh"
        }
      }
    ]
  }
}
```

**Fields we can auto-fill:**

- `name` → Song title
- `artists[0].name` → Artist
- `duration_ms` → Duration (convert to seconds)
- `album.name` → Album (optional)
- `external_urls.spotify` → Spotify reference link

### Rate Limits

From [Spotify Rate Limits documentation](https://developer.spotify.com/documentation/web-api/concepts/rate-limits):

- Rate limit based on rolling 30-second window
- Exact limits not published (intentional)
- 429 responses include `Retry-After` header
- "Development mode" apps have lower limits
- Extended quota mode requires 250,000+ MAU and registered business

**Mitigation:**

- Debounce search input (300-500ms)
- Cache recent search results
- Implement exponential backoff on 429
- Consider search-as-you-type only after 3+ characters

### 2025 Policy Changes

From [Spotify's Extended Access Update](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access):

> Starting May 15, 2025, extended Web API access will be reserved for apps with established, scalable, and impactful use cases... Developers previously granted extended access and actively using the Web API in compliance will remain unaffected.

**Impact for Rock-On:**

- Phase 1 (search-only) should work fine in development mode
- Playlist features (Phases 2-3) may be limited without extended access
- Can apply for extended access if we reach significant scale

## Current Codebase Analysis

### Song Creation Flow

**NewSongModal** (`src/components/songs/NewSongModal.tsx`):

- Basic form with manual entry
- Fields: title, artist, duration, bpm, key, tuning, notes, tags, externalLink
- No database integration (TODO comment)
- Single external link field (not using referenceLinks array)

**EditSongModal** (`src/components/songs/EditSongModal.tsx`):

- Full-featured song editing
- Uses `referenceLinks: ReferenceLink[]` array
- Multiple links with types (spotify, youtube, tabs, lyrics, other)
- Database integration via `onSave` prop

**SongsPage** (`src/pages/SongsPage.tsx`):

- Actually creates songs via `useCreateSong` hook
- Uses EditSongModal for editing, NewSongModal for creation
- NewSongModal is largely unused (not wired to database)

### Existing OAuth Patterns

**Supabase Auth** (`src/services/auth/SupabaseAuthService.ts`):

- Supports email, Google, GitHub providers
- Uses Supabase SDK for OAuth flow
- Auth state listeners, session mapping

**Auth Callback** (`src/pages/auth/AuthCallback.tsx`):

- Handles OAuth redirects
- Supports both implicit and PKCE flows
- Waits for auth state before navigation

### Environment Configuration

**Pattern** (from `.env.local.example`):

```
VITE_SPOTIFY_CLIENT_ID=xxx
VITE_SPOTIFY_CLIENT_SECRET=xxx  # Only for server-side token exchange
```

**Note:** Client secret should NEVER be exposed in frontend code. For Phase 1, we have two options:

1. **Serverless function:** Use Supabase Edge Function or Vercel/Netlify function to exchange credentials
2. **Backend proxy:** Add endpoint to handle Spotify auth server-side

## Proposed Architecture

### Phase 1: Song Search (MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  NewSongModal                                                    │
│  ┌─────────────────┐                                            │
│  │ SpotifySearch   │ ←─ User types song name                    │
│  │ Component       │                                            │
│  │                 │ ─→ Debounced API call (300ms)              │
│  │ [Search Results]│ ←─ Display matching tracks                 │
│  │ [Click to fill] │ ─→ Auto-fill form fields                   │
│  └─────────────────┘                                            │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │ SpotifyService  │ ─→ POST /functions/v1/spotify-search       │
│  │ (Frontend)      │ ←─ Proxied search results                  │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Function                        │
├─────────────────────────────────────────────────────────────────┤
│  spotify-search                                                  │
│  ┌─────────────────┐                                            │
│  │ 1. Get/refresh  │ ─→ POST spotify.com/api/token              │
│  │    client token │    (client_id + client_secret)             │
│  │                 │ ←─ access_token (cache 1 hour)             │
│  │                 │                                            │
│  │ 2. Search       │ ─→ GET api.spotify.com/v1/search           │
│  │    Spotify API  │    (Authorization: Bearer {token})         │
│  │                 │ ←─ Track results                           │
│  │                 │                                            │
│  │ 3. Transform    │ ─→ Return simplified response              │
│  │    response     │    { title, artist, duration, spotifyUrl } │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Playlist Creation (Future)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  SetlistViewPage                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [Export to Spotify] button                                  ││
│  │                                                             ││
│  │ 1. Check if user has linked Spotify                         ││
│  │ 2. If not → OAuth popup to authorize                        ││
│  │ 3. If yes → Create playlist via Edge Function               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Function                        │
├─────────────────────────────────────────────────────────────────┤
│  spotify-create-playlist                                         │
│  1. Verify user's Spotify refresh token (stored in DB)          │
│  2. Refresh access token if needed                               │
│  3. Create playlist via Spotify API                              │
│  4. Add tracks (using stored spotify_track_id from songs)        │
└─────────────────────────────────────────────────────────────────┘
```

## Integration with External Links Feature

### Synergy Points

1. **Auto-add Spotify link:** When user selects a Spotify search result, automatically add to `referenceLinks[]`

2. **Store Spotify track ID:** Add optional `spotifyTrackId` field to Song model for future playlist features

3. **URL auto-detection:** Use existing link type detection for manually pasted Spotify URLs

### Database Changes Needed

```sql
-- Add to songs table (alongside reference_links JSONB)
ALTER TABLE public.songs
ADD COLUMN spotify_track_id TEXT;  -- For playlist features

-- Optional: Create spotify_accounts table for user OAuth tokens
CREATE TABLE public.spotify_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  spotify_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

## Implementation Approach

### Option A: Full Integration (Recommended)

Implement Spotify search as part of external-links-enhancements feature:

**Pros:**

- Single coherent feature
- Spotify link auto-added to referenceLinks
- Consistent UX

**Cons:**

- Larger scope
- More testing needed

### Option B: Separate Feature

Implement Spotify integration as standalone feature after external-links:

**Pros:**

- Smaller PRs
- Can ship external-links sooner

**Cons:**

- May need to refactor external-links later
- Duplicate work on link handling

### Recommendation

**Start with Option A** but phase the implementation:

1. **external-links-enhancements Phase 1:** Fix sync, add auto-detection, quick icons
2. **external-links-enhancements Phase 2:** Add Spotify search (Edge Function + UI)
3. **Future feature:** Spotify playlist export (requires user OAuth)

## Technical Requirements

### New Files

| File                                         | Purpose                       |
| -------------------------------------------- | ----------------------------- |
| `supabase/functions/spotify-search/index.ts` | Edge function for search      |
| `src/services/spotify/SpotifyService.ts`     | Frontend API wrapper          |
| `src/components/songs/SpotifySearch.tsx`     | Search autocomplete component |
| `src/hooks/useSpotifySearch.ts`              | Debounced search hook         |

### Environment Variables

```bash
# Supabase Edge Function secrets
SPOTIFY_CLIENT_ID=xxx
SPOTIFY_CLIENT_SECRET=xxx

# Frontend (optional - for direct API if we use PKCE)
VITE_SPOTIFY_CLIENT_ID=xxx
```

### Dependencies

```json
{
  "devDependencies": {
    "@spotify/web-api-ts-sdk": "^1.x" // Optional: Spotify SDK
  }
}
```

**Note:** Can use native fetch instead of SDK for simpler implementation.

## Risk Analysis

| Risk                   | Severity | Mitigation                                      |
| ---------------------- | -------- | ----------------------------------------------- |
| Rate limiting          | Medium   | Debounce, caching, exponential backoff          |
| API policy changes     | Low      | Client credentials flow is stable               |
| Token security         | High     | Use Edge Functions, never expose secret         |
| Search result mismatch | Low      | Show album art for visual verification          |
| Extended access denial | Medium   | Phase 1 works without it, apply later if needed |

## Open Questions

1. **Should Spotify search be the primary way to add songs?**
   - Recommendation: Make it optional/enhanced, keep manual entry

2. **What if song isn't on Spotify?**
   - Recommendation: Fall back to manual entry, don't require Spotify

3. **Should we store Spotify track IDs for all songs?**
   - Recommendation: Yes, for future playlist features

4. **How to handle different versions/remasters?**
   - Recommendation: Show album name + year in search results

## Sources

- [Spotify Web API Getting Started](https://developer.spotify.com/documentation/web-api/tutorials/getting-started)
- [Spotify API Search Reference](https://developer.spotify.com/documentation/web-api/reference/search)
- [Spotify Authorization Guide](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [Spotify Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [Spotify Quota Modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Spotify Scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes)
- [Spotify Extended Access Update (2025)](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)

## Next Steps

After research approval:

1. Decide whether to include in external-links-enhancements or separate feature
2. Create Spotify Developer App at https://developer.spotify.com/dashboard
3. Proceed with `/plan external-links-enhancements` including Spotify integration
