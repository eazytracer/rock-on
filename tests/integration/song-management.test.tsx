import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Songs } from '../../src/pages/Songs/Songs'
import { SongService } from '../../src/services/SongService'
import { DatabaseService } from '../../src/services/DatabaseService'

// Mock the services
vi.mock('../../src/services/SongService')
vi.mock('../../src/services/DatabaseService')

const mockSongs = [
  {
    id: 'song-1',
    title: 'Wonderwall',
    artist: 'Oasis',
    album: 'Morning Glory',
    duration: 258,
    key: 'Em',
    bpm: 87,
    difficulty: 3,
    structure: [],
    chords: ['Em', 'G', 'D', 'C'],
    tags: ['rock', 'alternative'],
    createdDate: new Date('2023-01-01'),
    confidenceLevel: 0,
    notes: ''
  },
  {
    id: 'song-2',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    album: 'Appetite for Destruction',
    duration: 356,
    key: 'D',
    bpm: 125,
    difficulty: 4,
    structure: [],
    chords: ['D', 'C', 'G', 'A'],
    tags: ['rock', 'classic'],
    createdDate: new Date('2023-01-02'),
    confidenceLevel: 0,
    notes: ''
  }
]

const mockBand = {
  id: 'band-1',
  name: 'Test Band',
  description: 'A test band',
  createdDate: new Date(),
  memberIds: ['member-1'],
  settings: {}
}

// Wrapper component with router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('Song Management Workflow - Integration Test', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock database service
    vi.mocked(DatabaseService.isInitialized).mockReturnValue(true)
    vi.mocked(DatabaseService.getCurrentBand).mockResolvedValue(mockBand)

    // Mock song service
    vi.mocked(SongService.getAll).mockResolvedValue(mockSongs)
    vi.mocked(SongService.search).mockImplementation(async (query) => {
      return mockSongs.filter(song =>
        song.title.toLowerCase().includes(query.toLowerCase()) ||
        song.artist.toLowerCase().includes(query.toLowerCase())
      )
    })
    vi.mocked(SongService.create).mockImplementation(async (songData) => ({
      id: 'new-song-id',
      createdDate: new Date(),
      confidenceLevel: 0,
      ...songData
    }))
    vi.mocked(SongService.update).mockImplementation(async (id, updates) => ({
      ...mockSongs.find(s => s.id === id)!,
      ...updates
    }))
    vi.mocked(SongService.delete).mockResolvedValue(undefined)
  })

  it('should display empty song catalog and allow adding first song', async () => {
    // Mock empty song list
    vi.mocked(SongService.getAll).mockResolvedValue([])

    render(<Songs />, { wrapper: TestWrapper })

    // Should show empty state
    await waitFor(() => {
      expect(screen.getByText(/no songs in your catalog yet/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/add your first song/i)).toBeInTheDocument()

    // Click add song button
    const addSongButton = screen.getByRole('button', { name: /add song/i })
    await user.click(addSongButton)

    // Should show add song form
    await waitFor(() => {
      expect(screen.getByLabelText(/song title/i)).toBeInTheDocument()
    })

    // Fill in song details
    await user.type(screen.getByLabelText(/song title/i), 'Test Song')
    await user.type(screen.getByLabelText(/artist/i), 'Test Artist')
    await user.type(screen.getByLabelText(/album/i), 'Test Album')

    // Set duration (4:18 = 258 seconds)
    const minutesInput = screen.getByLabelText(/minutes/i)
    const secondsInput = screen.getByLabelText(/seconds/i)
    await user.clear(minutesInput)
    await user.type(minutesInput, '4')
    await user.clear(secondsInput)
    await user.type(secondsInput, '18')

    // Select key
    await user.selectOptions(screen.getByLabelText(/key/i), 'Am')

    // Set BPM
    const bpmInput = screen.getByLabelText(/bpm/i)
    await user.clear(bpmInput)
    await user.type(bpmInput, '120')

    // Set difficulty
    const difficultySlider = screen.getByLabelText(/difficulty/i)
    fireEvent.change(difficultySlider, { target: { value: '3' } })

    // Add chords
    const chordsInput = screen.getByLabelText(/chords/i)
    await user.type(chordsInput, 'Am F C G')

    // Add tags
    const tagsInput = screen.getByLabelText(/tags/i)
    await user.type(tagsInput, 'acoustic ballad')

    // Submit form
    const saveButton = screen.getByRole('button', { name: /save song/i })
    await user.click(saveButton)

    // Verify song creation was called
    await waitFor(() => {
      expect(SongService.create).toHaveBeenCalledWith({
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 258,
        key: 'Am',
        bpm: 120,
        difficulty: 3,
        chords: ['Am', 'F', 'C', 'G'],
        tags: ['acoustic', 'ballad'],
        bandId: 'band-1'
      })
    })
  })

  it('should display song catalog with search and filtering capabilities', async () => {
    render(<Songs />, { wrapper: TestWrapper })

    // Should show songs list
    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
      expect(screen.getByText('Sweet Child O\' Mine')).toBeInTheDocument()
    })

    // Should show song details
    expect(screen.getByText('Oasis')).toBeInTheDocument()
    expect(screen.getByText('Guns N\' Roses')).toBeInTheDocument()
    expect(screen.getByText('Em')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()

    // Test search functionality
    const searchInput = screen.getByPlaceholderText(/search songs/i)
    await user.type(searchInput, 'wonder')

    await waitFor(() => {
      expect(SongService.search).toHaveBeenCalledWith('wonder')
    })

    // Only Wonderwall should be visible
    expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    expect(screen.queryByText('Sweet Child O\' Mine')).not.toBeInTheDocument()

    // Clear search
    await user.clear(searchInput)

    // Both songs should be visible again
    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
      expect(screen.getByText('Sweet Child O\' Mine')).toBeInTheDocument()
    })
  })

  it('should support filtering by key, difficulty, and tags', async () => {
    render(<Songs />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    })

    // Open filters
    const filterButton = screen.getByRole('button', { name: /filters/i })
    await user.click(filterButton)

    // Filter by key
    const keyFilter = screen.getByLabelText(/filter by key/i)
    await user.selectOptions(keyFilter, 'Em')

    // Only Wonderwall (Em) should be visible
    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
      expect(screen.queryByText('Sweet Child O\' Mine')).not.toBeInTheDocument()
    })

    // Filter by difficulty
    const difficultyFilter = screen.getByLabelText(/filter by difficulty/i)
    await user.selectOptions(difficultyFilter, '4')

    // Now only Sweet Child O\' Mine (difficulty 4) should be visible
    await waitFor(() => {
      expect(screen.queryByText('Wonderwall')).not.toBeInTheDocument()
      expect(screen.getByText('Sweet Child O\' Mine')).toBeInTheDocument()
    })

    // Clear filters
    const clearFiltersButton = screen.getByRole('button', { name: /clear filters/i })
    await user.click(clearFiltersButton)

    // Both songs should be visible
    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
      expect(screen.getByText('Sweet Child O\' Mine')).toBeInTheDocument()
    })
  })

  it('should allow editing song details', async () => {
    render(<Songs />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    })

    // Click on song to open details
    const songCard = screen.getByText('Wonderwall').closest('[data-testid="song-card"]')
    expect(songCard).toBeInTheDocument()

    await user.click(songCard!)

    // Should show song details modal/page
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit song/i })).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit song/i })
    await user.click(editButton)

    // Should show edit form with current values
    await waitFor(() => {
      expect(screen.getByDisplayValue('Wonderwall')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Oasis')).toBeInTheDocument()
    })

    // Update title
    const titleInput = screen.getByDisplayValue('Wonderwall')
    await user.clear(titleInput)
    await user.type(titleInput, 'Wonderwall (Acoustic)')

    // Update difficulty
    const difficultySlider = screen.getByLabelText(/difficulty/i)
    fireEvent.change(difficultySlider, { target: { value: '2' } })

    // Save changes
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    // Verify update was called
    await waitFor(() => {
      expect(SongService.update).toHaveBeenCalledWith('song-1', {
        title: 'Wonderwall (Acoustic)',
        difficulty: 2
      })
    })
  })

  it('should support deleting songs with confirmation', async () => {
    render(<Songs />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    })

    // Long press on song card to show context menu
    const songCard = screen.getByText('Wonderwall').closest('[data-testid="song-card"]')

    // Simulate long press (in a real app, this would use the useLongPress hook)
    fireEvent.mouseDown(songCard!)
    await new Promise(resolve => setTimeout(resolve, 600)) // Wait for long press threshold
    fireEvent.mouseUp(songCard!)

    // Should show context menu
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete song/i })).toBeInTheDocument()
    })

    const deleteButton = screen.getByRole('button', { name: /delete song/i })
    await user.click(deleteButton)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument()
    })

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /delete/i })
    await user.click(confirmButton)

    // Verify deletion was called
    await waitFor(() => {
      expect(SongService.delete).toHaveBeenCalledWith('song-1')
    })
  })

  it('should support song sorting options', async () => {
    render(<Songs />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    })

    // Open sort menu
    const sortButton = screen.getByRole('button', { name: /sort/i })
    await user.click(sortButton)

    // Sort by artist
    const sortByArtist = screen.getByRole('button', { name: /sort by artist/i })
    await user.click(sortByArtist)

    // Verify songs are reordered (Guns N' Roses before Oasis alphabetically)
    const songCards = screen.getAllByTestId('song-card')
    expect(songCards[0]).toHaveTextContent('Guns N\' Roses')
    expect(songCards[1]).toHaveTextContent('Oasis')

    // Sort by difficulty
    await user.click(sortButton)
    const sortByDifficulty = screen.getByRole('button', { name: /sort by difficulty/i })
    await user.click(sortByDifficulty)

    // Verify songs are reordered by difficulty (3 before 4)
    const reorderedCards = screen.getAllByTestId('song-card')
    expect(reorderedCards[0]).toHaveTextContent('Wonderwall') // difficulty 3
    expect(reorderedCards[1]).toHaveTextContent('Sweet Child O\' Mine') // difficulty 4
  })

  it('should maintain mobile-responsive grid layout', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    fireEvent(window, new Event('resize'))

    render(<Songs />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    })

    // Verify mobile layout (1 column grid)
    const songGrid = screen.getByTestId('songs-grid')
    expect(songGrid).toHaveClass('grid-cols-1')

    // Change to tablet viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768
    })
    fireEvent(window, new Event('resize'))

    // Should adapt to tablet layout (2 columns)
    await waitFor(() => {
      expect(songGrid).toHaveClass('sm:grid-cols-2')
    })
  })

  it('should handle form validation errors when adding songs', async () => {
    render(<Songs />, { wrapper: TestWrapper })

    // Click add song
    const addSongButton = screen.getByRole('button', { name: /add song/i })
    await user.click(addSongButton)

    // Try to submit without required fields
    const saveButton = screen.getByRole('button', { name: /save song/i })
    await user.click(saveButton)

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument()
      expect(screen.getByText(/artist is required/i)).toBeInTheDocument()
    })

    // Fill with invalid data
    await user.type(screen.getByLabelText(/song title/i), 'A'.repeat(101)) // Too long
    await user.type(screen.getByLabelText(/bpm/i), '500') // Invalid BPM

    await user.click(saveButton)

    // Should show specific validation errors
    await waitFor(() => {
      expect(screen.getByText(/title must be 100 characters or less/i)).toBeInTheDocument()
      expect(screen.getByText(/bpm must be between 40 and 300/i)).toBeInTheDocument()
    })
  })
})