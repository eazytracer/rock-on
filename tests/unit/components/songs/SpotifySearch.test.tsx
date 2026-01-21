import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpotifySearch } from '../../../../src/components/songs/SpotifySearch'
import type { SpotifyTrack } from '../../../../src/services/spotify/SpotifyService'

// Mock the useSpotifySearch hook
const mockSetQuery = vi.fn()
const mockClear = vi.fn()

const mockTracks: SpotifyTrack[] = [
  {
    id: 'track1',
    name: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    durationMs: 354947,
    spotifyUrl: 'https://open.spotify.com/track/track1',
    albumArt: 'https://i.scdn.co/image/album1',
  },
  {
    id: 'track2',
    name: 'We Will Rock You',
    artist: 'Queen',
    album: 'News of the World',
    durationMs: 122000,
    spotifyUrl: 'https://open.spotify.com/track/track2',
  },
]

let mockHookReturn = {
  query: '',
  setQuery: mockSetQuery,
  results: [] as SpotifyTrack[],
  isLoading: false,
  error: null as string | null,
  clear: mockClear,
}

vi.mock('../../../../src/hooks/useSpotifySearch', () => ({
  useSpotifySearch: () => mockHookReturn,
}))

describe('SpotifySearch', () => {
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockHookReturn = {
      query: '',
      setQuery: mockSetQuery,
      results: [],
      isLoading: false,
      error: null,
      clear: mockClear,
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render search input', () => {
      render(<SpotifySearch onSelect={mockOnSelect} />)

      const input = screen.getByPlaceholderText('Search Spotify for a song...')
      expect(input).toBeInTheDocument()
    })

    it('should render custom placeholder', () => {
      render(
        <SpotifySearch onSelect={mockOnSelect} placeholder="Find a track..." />
      )

      const input = screen.getByPlaceholderText('Find a track...')
      expect(input).toBeInTheDocument()
    })

    it('should show loading indicator when searching', () => {
      mockHookReturn.isLoading = true

      render(<SpotifySearch onSelect={mockOnSelect} />)

      expect(screen.getByText('Searching...')).toBeInTheDocument()
    })

    it('should show error message', () => {
      mockHookReturn.error = 'Rate limited. Try again later.'

      render(<SpotifySearch onSelect={mockOnSelect} />)

      expect(
        screen.getByText('Rate limited. Try again later.')
      ).toBeInTheDocument()
    })
  })

  describe('search results', () => {
    beforeEach(() => {
      mockHookReturn.results = mockTracks
      mockHookReturn.query = 'Queen'
    })

    it('should display search results', () => {
      render(<SpotifySearch onSelect={mockOnSelect} />)

      expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument()
      expect(screen.getByText('We Will Rock You')).toBeInTheDocument()
    })

    it('should display artist name', () => {
      render(<SpotifySearch onSelect={mockOnSelect} />)

      // Both tracks have Queen as artist
      const artistElements = screen.getAllByText('Queen')
      expect(artistElements.length).toBeGreaterThanOrEqual(2)
    })

    it('should display album name', () => {
      render(<SpotifySearch onSelect={mockOnSelect} />)

      expect(screen.getByText('A Night at the Opera')).toBeInTheDocument()
      expect(screen.getByText('News of the World')).toBeInTheDocument()
    })

    it('should display formatted duration', () => {
      render(<SpotifySearch onSelect={mockOnSelect} />)

      // 354947ms = 5:54, 122000ms = 2:02
      expect(screen.getByText('5:54')).toBeInTheDocument()
      expect(screen.getByText('2:02')).toBeInTheDocument()
    })

    it('should render album art when available', () => {
      render(<SpotifySearch onSelect={mockOnSelect} />)

      const image = screen.getByAltText('Bohemian Rhapsody album art')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', 'https://i.scdn.co/image/album1')
    })

    it('should show placeholder when album art is missing', () => {
      render(<SpotifySearch onSelect={mockOnSelect} />)

      // Second track has no album art - should show placeholder
      const placeholders = document.querySelectorAll(
        '[data-testid="album-art-placeholder"]'
      )
      expect(placeholders.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('user interactions', () => {
    it('should call setQuery when typing', async () => {
      const user = userEvent.setup()

      render(<SpotifySearch onSelect={mockOnSelect} />)

      const input = screen.getByPlaceholderText('Search Spotify for a song...')
      await user.type(input, 'Queen')

      expect(mockSetQuery).toHaveBeenCalled()
    })

    it('should call onSelect when clicking a result', async () => {
      const user = userEvent.setup()
      mockHookReturn.results = mockTracks
      mockHookReturn.query = 'Queen'

      render(<SpotifySearch onSelect={mockOnSelect} />)

      const firstResult = screen.getByText('Bohemian Rhapsody')
      await user.click(firstResult)

      expect(mockOnSelect).toHaveBeenCalledWith(mockTracks[0])
    })

    it('should call clear and onSelect when selecting a result', async () => {
      const user = userEvent.setup()
      mockHookReturn.results = mockTracks
      mockHookReturn.query = 'Queen'

      render(<SpotifySearch onSelect={mockOnSelect} />)

      const secondResult = screen.getByText('We Will Rock You')
      await user.click(secondResult)

      expect(mockOnSelect).toHaveBeenCalledWith(mockTracks[1])
      expect(mockClear).toHaveBeenCalled()
    })
  })

  describe('empty states', () => {
    it('should not show results when query is empty', () => {
      mockHookReturn.query = ''
      mockHookReturn.results = []

      render(<SpotifySearch onSelect={mockOnSelect} />)

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('should show no results message when search returns empty', () => {
      mockHookReturn.query = 'xyznonexistent'
      mockHookReturn.results = []

      render(<SpotifySearch onSelect={mockOnSelect} />)

      expect(screen.getByText('No results found')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have accessible input', () => {
      render(<SpotifySearch onSelect={mockOnSelect} />)

      const input = screen.getByRole('searchbox')
      expect(input).toBeInTheDocument()
    })

    it('should have accessible results list', () => {
      mockHookReturn.results = mockTracks
      mockHookReturn.query = 'Queen'

      render(<SpotifySearch onSelect={mockOnSelect} />)

      const list = screen.getByRole('listbox')
      expect(list).toBeInTheDocument()
    })

    it('should have keyboard-navigable results', async () => {
      const user = userEvent.setup()
      mockHookReturn.results = mockTracks
      mockHookReturn.query = 'Queen'

      render(<SpotifySearch onSelect={mockOnSelect} />)

      const input = screen.getByRole('searchbox')
      await user.click(input)

      // Focus should be manageable via keyboard
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{Enter}')

      // Should select the focused item
      expect(mockOnSelect).toHaveBeenCalled()
    })
  })
})
