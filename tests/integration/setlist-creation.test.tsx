import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Setlists } from '../../src/pages/Setlists/Setlists'
import { SetlistService } from '../../src/services/SetlistService'
import { SongService } from '../../src/services/SongService'
import { DatabaseService } from '../../src/services/DatabaseService'

// Mock the services
vi.mock('../../src/services/SetlistService')
vi.mock('../../src/services/SongService')
vi.mock('../../src/services/DatabaseService')

const mockSongs = [
  {
    id: 'song-1',
    title: 'Wonderwall',
    artist: 'Oasis',
    duration: 258,
    key: 'Em',
    bpm: 87,
    difficulty: 3,
    confidenceLevel: 4.2,
    lastPracticed: new Date('2023-12-10')
  },
  {
    id: 'song-2',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    duration: 356,
    key: 'D',
    bpm: 125,
    difficulty: 4,
    confidenceLevel: 2.8,
    lastPracticed: new Date('2023-12-05')
  },
  {
    id: 'song-3',
    title: 'Hotel California',
    artist: 'Eagles',
    duration: 391,
    key: 'Bm',
    bpm: 75,
    difficulty: 5,
    confidenceLevel: 4.5,
    lastPracticed: new Date('2023-12-12')
  }
]

const mockSetlists = [
  {
    id: 'setlist-1',
    name: 'Coffee Shop Gig',
    bandId: 'band-1',
    showDate: new Date('2024-01-15T20:00:00'),
    venue: 'Downtown Coffee',
    songs: [
      {
        songId: 'song-1',
        order: 1,
        transitionNotes: 'Quick transition to next song'
      },
      {
        songId: 'song-3',
        order: 2,
        keyChange: 'Am',
        specialInstructions: 'Acoustic version'
      }
    ],
    totalDuration: 649, // 258 + 391 seconds
    status: 'draft' as const,
    createdDate: new Date('2023-12-01'),
    lastModified: new Date('2023-12-01')
  }
]

const mockBand = {
  id: 'band-1',
  name: 'Test Band',
  memberIds: ['member-1', 'member-2']
}

// Wrapper component with router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('Setlist Creation Workflow - Integration Test', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock database service
    vi.mocked(DatabaseService.isInitialized).mockReturnValue(true)
    vi.mocked(DatabaseService.getCurrentBand).mockResolvedValue(mockBand)

    // Mock setlist service
    vi.mocked(SetlistService.getAll).mockResolvedValue(mockSetlists)
    vi.mocked(SetlistService.create).mockImplementation(async (setlistData) => ({
      id: 'new-setlist-id',
      createdDate: new Date(),
      lastModified: new Date(),
      status: 'draft' as const,
      songs: [],
      totalDuration: 0,
      ...setlistData
    }))
    vi.mocked(SetlistService.update).mockImplementation(async (id, updates) => ({
      ...mockSetlists.find(s => s.id === id)!,
      ...updates,
      lastModified: new Date()
    }))
    vi.mocked(SetlistService.addSong).mockImplementation(async (setlistId, songId, position) => ({
      ...mockSetlists.find(s => s.id === setlistId)!,
      songs: [
        ...mockSetlists.find(s => s.id === setlistId)!.songs,
        { songId, order: position || mockSetlists.find(s => s.id === setlistId)!.songs.length + 1 }
      ]
    }))
    vi.mocked(SetlistService.reorderSongs).mockResolvedValue(mockSetlists[0])
    vi.mocked(SetlistService.delete).mockResolvedValue(undefined)

    // Mock song service
    vi.mocked(SongService.getAll).mockResolvedValue(mockSongs)
    vi.mocked(SongService.getById).mockImplementation(async (id) =>
      mockSongs.find(song => song.id === id) || null
    )
  })

  it('should display setlists overview with readiness indicators', async () => {
    render(<Setlists />, { wrapper: TestWrapper })

    // Should show setlists list
    await waitFor(() => {
      expect(screen.getByText('Coffee Shop Gig')).toBeInTheDocument()
    })

    // Should show setlist details
    expect(screen.getByText('Downtown Coffee')).toBeInTheDocument()
    expect(screen.getByText(/jan 15, 2024/i)).toBeInTheDocument()

    // Should show readiness indicator
    expect(screen.getByTestId('setlist-readiness')).toBeInTheDocument()

    // Should show song count and duration
    expect(screen.getByText('2 songs')).toBeInTheDocument()
    expect(screen.getByText(/10:49/i)).toBeInTheDocument() // 649 seconds = 10:49
  })

  it('should create a new setlist from scratch', async () => {
    render(<Setlists />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create setlist/i })).toBeInTheDocument()
    })

    // Click create setlist button
    const createButton = screen.getByRole('button', { name: /create setlist/i })
    await user.click(createButton)

    // Should show setlist creation form
    await waitFor(() => {
      expect(screen.getByLabelText(/setlist name/i)).toBeInTheDocument()
    })

    // Fill in setlist details
    const nameInput = screen.getByLabelText(/setlist name/i)
    await user.type(nameInput, 'New Year\'s Eve Show')

    const venueInput = screen.getByLabelText(/venue/i)
    await user.type(venueInput, 'City Music Hall')

    // Set show date
    const dateInput = screen.getByLabelText(/show date/i)
    await user.type(dateInput, '2024-12-31')

    const timeInput = screen.getByLabelText(/show time/i)
    await user.type(timeInput, '21:00')

    // Add notes
    const notesInput = screen.getByLabelText(/notes/i)
    await user.type(notesInput, 'High-energy set for New Year celebration')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create setlist/i })
    await user.click(submitButton)

    // Verify setlist creation
    await waitFor(() => {
      expect(SetlistService.create).toHaveBeenCalledWith({
        name: 'New Year\'s Eve Show',
        bandId: 'band-1',
        venue: 'City Music Hall',
        showDate: new Date('2024-12-31T21:00:00'),
        notes: 'High-energy set for New Year celebration'
      })
    })

    // Should navigate to setlist builder
    expect(screen.getByText(/setlist builder/i)).toBeInTheDocument()
  })

  it('should build setlist by adding songs with drag and drop', async () => {
    // Mock empty setlist for this test
    const emptySetlist = {
      ...mockSetlists[0],
      songs: []
    }
    vi.mocked(SetlistService.getById).mockResolvedValue(emptySetlist)

    render(<Setlists />, { wrapper: TestWrapper })

    // Navigate to setlist builder
    const setlistCard = await screen.findByText('Coffee Shop Gig')
    await user.click(setlistCard)

    const editButton = await screen.findByRole('button', { name: /edit setlist/i })
    await user.click(editButton)

    // Should show setlist builder interface
    await waitFor(() => {
      expect(screen.getByText(/setlist builder/i)).toBeInTheDocument()
    })

    // Should show available songs
    expect(screen.getByText('Available Songs')).toBeInTheDocument()
    expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    expect(screen.getByText('Sweet Child O\' Mine')).toBeInTheDocument()
    expect(screen.getByText('Hotel California')).toBeInTheDocument()

    // Should show readiness indicators for each song
    const wonderwallCard = screen.getByTestId('song-card-song-1')
    expect(wonderwallCard).toHaveClass('ready') // confidence > 4

    const sweetChildCard = screen.getByTestId('song-card-song-2')
    expect(sweetChildCard).toHaveClass('needs-practice') // confidence < 3

    const hotelCaliforniaCard = screen.getByTestId('song-card-song-3')
    expect(hotelCaliforniaCard).toHaveClass('ready') // confidence > 4

    // Drag song to setlist
    const setlistDropZone = screen.getByTestId('setlist-drop-zone')

    // Simulate drag and drop (using mouse events for testing)
    fireEvent.mouseDown(wonderwallCard)
    fireEvent.dragStart(wonderwallCard)
    fireEvent.dragEnter(setlistDropZone)
    fireEvent.dragOver(setlistDropZone)
    fireEvent.drop(setlistDropZone)
    fireEvent.dragEnd(wonderwallCard)

    // Should add song to setlist
    await waitFor(() => {
      expect(SetlistService.addSong).toHaveBeenCalledWith('setlist-1', 'song-1', 1)
    })
  })

  it('should reorder songs within setlist using drag and drop', async () => {
    vi.mocked(SetlistService.getById).mockResolvedValue(mockSetlists[0])

    render(<Setlists />, { wrapper: TestWrapper })

    // Navigate to setlist builder
    const setlistCard = await screen.findByText('Coffee Shop Gig')
    await user.click(setlistCard)

    const editButton = await screen.findByRole('button', { name: /edit setlist/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByText(/setlist builder/i)).toBeInTheDocument()
    })

    // Should show current setlist
    const setlistItems = screen.getAllByTestId(/setlist-item-/)
    expect(setlistItems).toHaveLength(2)

    // First song should be Wonderwall
    expect(setlistItems[0]).toHaveTextContent('Wonderwall')
    expect(setlistItems[1]).toHaveTextContent('Hotel California')

    // Drag second song to first position
    const hotelCaliforniaItem = setlistItems[1]
    const wonderwallItem = setlistItems[0]

    fireEvent.mouseDown(hotelCaliforniaItem)
    fireEvent.dragStart(hotelCaliforniaItem)
    fireEvent.dragEnter(wonderwallItem)
    fireEvent.dragOver(wonderwallItem)
    fireEvent.drop(wonderwallItem)
    fireEvent.dragEnd(hotelCaliforniaItem)

    // Should reorder songs
    await waitFor(() => {
      expect(SetlistService.reorderSongs).toHaveBeenCalledWith('setlist-1', ['song-3', 'song-1'])
    })
  })

  it('should add transition notes and special instructions', async () => {
    vi.mocked(SetlistService.getById).mockResolvedValue(mockSetlists[0])

    render(<Setlists />, { wrapper: TestWrapper })

    const setlistCard = await screen.findByText('Coffee Shop Gig')
    await user.click(setlistCard)

    const editButton = await screen.findByRole('button', { name: /edit setlist/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByTestId('setlist-item-song-1')).toBeInTheDocument()
    })

    // Click on first song to edit details
    const wonderwallItem = screen.getByTestId('setlist-item-song-1')
    const editSongButton = wonderwallItem.querySelector('[data-action="edit"]')
    await user.click(editSongButton!)

    // Should show song editing modal
    await waitFor(() => {
      expect(screen.getByText(/edit song in setlist/i)).toBeInTheDocument()
    })

    // Update transition notes
    const transitionNotesInput = screen.getByLabelText(/transition notes/i)
    await user.clear(transitionNotesInput)
    await user.type(transitionNotesInput, 'Slow fade into next song with guitar arpeggios')

    // Change key for this performance
    const keyChangeSelect = screen.getByLabelText(/key change/i)
    await user.selectOptions(keyChangeSelect, 'Dm')

    // Adjust tempo
    const tempoChangeInput = screen.getByLabelText(/tempo change/i)
    await user.type(tempoChangeInput, '-10') // 10% slower

    // Add special instructions
    const specialInstructionsInput = screen.getByLabelText(/special instructions/i)
    await user.type(specialInstructionsInput, 'Add extra verse for extended version')

    // Save changes
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    // Should update song in setlist
    await waitFor(() => {
      expect(SetlistService.updateSong).toHaveBeenCalledWith('setlist-1', 'song-1', {
        transitionNotes: 'Slow fade into next song with guitar arpeggios',
        keyChange: 'Dm',
        tempoChange: -10,
        specialInstructions: 'Add extra verse for extended version'
      })
    })
  })

  it('should show readiness warnings for unprepared songs', async () => {
    vi.mocked(SetlistService.getById).mockResolvedValue(mockSetlists[0])

    render(<Setlists />, { wrapper: TestWrapper })

    const setlistCard = await screen.findByText('Coffee Shop Gig')
    await user.click(setlistCard)

    // Should show readiness report
    await waitFor(() => {
      expect(screen.getByText(/readiness report/i)).toBeInTheDocument()
    })

    const readinessButton = screen.getByRole('button', { name: /readiness report/i })
    await user.click(readinessButton)

    // Should show detailed readiness analysis
    await waitFor(() => {
      expect(screen.getByText(/setlist readiness: 50%/i)).toBeInTheDocument()
    })

    // Should show warnings for songs that need practice
    expect(screen.getByText(/hotel california: ready/i)).toBeInTheDocument()
    expect(screen.getByText(/wonderwall: ready/i)).toBeInTheDocument()

    // Should show recommendations
    expect(screen.getByText(/recommendations/i)).toBeInTheDocument()
    expect(screen.getByText(/practice songs with confidence below 3/i)).toBeInTheDocument()

    // Should show estimated practice time needed
    expect(screen.getByText(/estimated practice time: 2 hours/i)).toBeInTheDocument()
  })

  it('should calculate total setlist duration accurately', async () => {
    vi.mocked(SetlistService.getById).mockResolvedValue(mockSetlists[0])

    render(<Setlists />, { wrapper: TestWrapper })

    const setlistCard = await screen.findByText('Coffee Shop Gig')
    await user.click(setlistCard)

    // Should show total duration
    await waitFor(() => {
      expect(screen.getByText(/total duration: 10:49/i)).toBeInTheDocument()
    })

    // Should account for tempo changes
    const editButton = screen.getByRole('button', { name: /edit setlist/i })
    await user.click(editButton)

    const wonderwallItem = await screen.findByTestId('setlist-item-song-1')
    const editSongButton = wonderwallItem.querySelector('[data-action="edit"]')
    await user.click(editSongButton!)

    // Set tempo change to +20%
    const tempoChangeInput = await screen.findByLabelText(/tempo change/i)
    await user.type(tempoChangeInput, '20')

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    // Duration should be recalculated (Wonderwall becomes shorter with faster tempo)
    await waitFor(() => {
      expect(screen.getByText(/total duration: 10:34/i)).toBeInTheDocument()
    })
  })

  it('should support different setlist templates and quick creation', async () => {
    render(<Setlists />, { wrapper: TestWrapper })

    const createButton = await screen.findByRole('button', { name: /create setlist/i })
    await user.click(createButton)

    // Should show template options
    await waitFor(() => {
      expect(screen.getByText(/choose template/i)).toBeInTheDocument()
    })

    // Should have preset templates
    expect(screen.getByRole('button', { name: /acoustic set/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /full band rock/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /covers medley/i })).toBeInTheDocument()

    // Select acoustic template
    const acousticTemplate = screen.getByRole('button', { name: /acoustic set/i })
    await user.click(acousticTemplate)

    // Should filter songs by suitability for acoustic performance
    await waitFor(() => {
      expect(screen.getByText(/suggested songs for acoustic set/i)).toBeInTheDocument()
    })

    // Should pre-populate with suitable songs
    const suggestedSongs = screen.getAllByTestId(/suggested-song-/)
    expect(suggestedSongs.length).toBeGreaterThan(0)

    // Should allow quick addition of all suggested songs
    const addAllButton = screen.getByRole('button', { name: /add all suggested/i })
    await user.click(addAllButton)

    // Should create setlist with suggested songs
    await waitFor(() => {
      expect(SetlistService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          songs: expect.arrayContaining([
            expect.any(String)
          ])
        })
      )
    })
  })

  it('should handle mobile touch interactions for setlist building', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    fireEvent(window, new Event('resize'))

    vi.mocked(SetlistService.getById).mockResolvedValue(mockSetlists[0])

    render(<Setlists />, { wrapper: TestWrapper })

    const setlistCard = await screen.findByText('Coffee Shop Gig')
    await user.click(setlistCard)

    const editButton = await screen.findByRole('button', { name: /edit setlist/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByTestId('mobile-setlist-builder')).toBeInTheDocument()
    })

    // Should show mobile-optimized interface
    expect(screen.getByTestId('mobile-song-selector')).toBeInTheDocument()

    // Should support touch drag and drop
    const availableSong = screen.getByTestId('song-card-song-2')
    const setlistDropZone = screen.getByTestId('setlist-drop-zone')

    // Simulate touch drag
    fireEvent.touchStart(availableSong, {
      touches: [{ clientX: 100, clientY: 100 }]
    })
    fireEvent.touchMove(availableSong, {
      touches: [{ clientX: 200, clientY: 300 }]
    })
    fireEvent.touchEnd(setlistDropZone)

    await waitFor(() => {
      expect(SetlistService.addSong).toHaveBeenCalledWith('setlist-1', 'song-2', expect.any(Number))
    })

    // Should support long press for song options
    const setlistItem = screen.getByTestId('setlist-item-song-1')

    // Simulate long press
    fireEvent.touchStart(setlistItem)
    await new Promise(resolve => setTimeout(resolve, 600)) // Long press threshold
    fireEvent.touchEnd(setlistItem)

    // Should show context menu
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit song/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /remove from setlist/i })).toBeInTheDocument()
    })
  })

  it('should validate setlist constraints and show warnings', async () => {
    render(<Setlists />, { wrapper: TestWrapper })

    const createButton = await screen.findByRole('button', { name: /create setlist/i })
    await user.click(createButton)

    // Fill minimal required info
    const nameInput = await screen.findByLabelText(/setlist name/i)
    await user.type(nameInput, 'Test Setlist')

    const submitButton = screen.getByRole('button', { name: /create setlist/i })
    await user.click(submitButton)

    // Navigate to builder and add too many songs
    await waitFor(() => {
      expect(screen.getByText(/setlist builder/i)).toBeInTheDocument()
    })

    // Add multiple long songs
    const longSongs = ['song-2', 'song-3'] // These are long songs
    for (const songId of longSongs) {
      const songCard = screen.getByTestId(`song-card-${songId}`)
      const setlistDropZone = screen.getByTestId('setlist-drop-zone')

      fireEvent.mouseDown(songCard)
      fireEvent.drop(setlistDropZone)
    }

    // Should show duration warning
    await waitFor(() => {
      expect(screen.getByText(/setlist duration exceeds recommended/i)).toBeInTheDocument()
    })

    // Should show key compatibility warnings
    expect(screen.getByText(/key transitions may be difficult/i)).toBeInTheDocument()

    // Should show tempo flow warnings
    expect(screen.getByText(/consider tempo flow between songs/i)).toBeInTheDocument()
  })
})