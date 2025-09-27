import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { ReadinessReport } from '../../src/components/setlists/ReadinessReport'
import { SetlistService } from '../../src/services/SetlistService'
import { SongService } from '../../src/services/SongService'
import { PracticeSessionService } from '../../src/services/PracticeSessionService'

// Mock the services
vi.mock('../../src/services/SetlistService')
vi.mock('../../src/services/SongService')
vi.mock('../../src/services/PracticeSessionService')

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
    lastPracticed: new Date('2023-12-10'), // 5 days ago
    practiceHistory: [
      { date: new Date('2023-12-10'), confidence: 4, timeSpent: 20 },
      { date: new Date('2023-12-05'), confidence: 3, timeSpent: 15 }
    ]
  },
  {
    id: 'song-2',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    duration: 356,
    key: 'D',
    bpm: 125,
    difficulty: 4,
    confidenceLevel: 2.1,
    lastPracticed: new Date('2023-11-20'), // 25 days ago
    practiceHistory: [
      { date: new Date('2023-11-20'), confidence: 2, timeSpent: 30 }
    ]
  },
  {
    id: 'song-3',
    title: 'Hotel California',
    artist: 'Eagles',
    duration: 391,
    key: 'Bm',
    bpm: 75,
    difficulty: 5,
    confidenceLevel: 4.8,
    lastPracticed: new Date('2023-12-12'), // 3 days ago
    practiceHistory: [
      { date: new Date('2023-12-12'), confidence: 5, timeSpent: 45 },
      { date: new Date('2023-12-08'), confidence: 4, timeSpent: 40 }
    ]
  },
  {
    id: 'song-4',
    title: 'Blackbird',
    artist: 'The Beatles',
    duration: 136,
    key: 'G',
    bpm: 95,
    difficulty: 2,
    confidenceLevel: 1.5,
    lastPracticed: null, // Never practiced
    practiceHistory: []
  }
]

const mockSetlist = {
  id: 'setlist-1',
  name: 'Coffee Shop Gig',
  bandId: 'band-1',
  showDate: new Date('2023-12-20T20:00:00'), // 5 days from now
  venue: 'Downtown Coffee',
  songs: [
    { songId: 'song-1', order: 1 },
    { songId: 'song-2', order: 2 },
    { songId: 'song-3', order: 3 },
    { songId: 'song-4', order: 4 }
  ],
  totalDuration: 1141, // Sum of all song durations
  status: 'draft' as const
}

const mockBandMembers = [
  {
    id: 'member-1',
    name: 'John Doe',
    primaryInstrument: 'Guitar'
  },
  {
    id: 'member-2',
    name: 'Jane Smith',
    primaryInstrument: 'Bass'
  }
]

// Mock current date to be 2023-12-15 for consistent testing
const mockCurrentDate = new Date('2023-12-15T10:00:00')
vi.setSystemTime(mockCurrentDate)

// Wrapper component with router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('Readiness Check Workflow - Integration Test', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock setlist service
    vi.mocked(SetlistService.getById).mockResolvedValue(mockSetlist)
    vi.mocked(SetlistService.getReadinessReport).mockResolvedValue({
      setlistId: 'setlist-1',
      overallReadiness: 3.15, // Weighted average
      totalSongs: 4,
      readySongs: 2, // Songs with confidence >= 4
      needsPracticeSongs: 2, // Songs with confidence < 3
      songReadiness: [
        {
          songId: 'song-1',
          title: 'Wonderwall',
          artist: 'Oasis',
          confidenceLevel: 4.2,
          lastPracticed: new Date('2023-12-10'),
          daysSincePractice: 5,
          status: 'ready' as const,
          warnings: []
        },
        {
          songId: 'song-2',
          title: 'Sweet Child O\' Mine',
          artist: 'Guns N\' Roses',
          confidenceLevel: 2.1,
          lastPracticed: new Date('2023-11-20'),
          daysSincePractice: 25,
          status: 'needs-practice' as const,
          warnings: ['Not practiced in over 3 weeks', 'Low confidence rating']
        },
        {
          songId: 'song-3',
          title: 'Hotel California',
          artist: 'Eagles',
          confidenceLevel: 4.8,
          lastPracticed: new Date('2023-12-12'),
          daysSincePractice: 3,
          status: 'ready' as const,
          warnings: []
        },
        {
          songId: 'song-4',
          title: 'Blackbird',
          artist: 'The Beatles',
          confidenceLevel: 1.5,
          lastPracticed: null,
          daysSincePractice: null,
          status: 'not-practiced' as const,
          warnings: ['Never practiced', 'Very low confidence']
        }
      ],
      recommendations: [
        'Schedule practice session for Sweet Child O\' Mine',
        'First-time practice needed for Blackbird',
        'Consider replacing difficult songs if show is soon'
      ],
      estimatedPracticeTime: 120 // 2 hours
    })

    // Mock song service
    vi.mocked(SongService.getById).mockImplementation(async (id) =>
      mockSongs.find(song => song.id === id) || null
    )

    // Mock practice session service
    vi.mocked(PracticeSessionService.create).mockResolvedValue({
      id: 'new-session-id',
      bandId: 'band-1',
      scheduledDate: new Date(),
      type: 'rehearsal',
      status: 'scheduled',
      songs: [],
      attendees: [],
      objectives: []
    })
  })

  it('should display comprehensive readiness report for upcoming show', async () => {
    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    // Should show overall readiness score
    await waitFor(() => {
      expect(screen.getByText(/overall readiness: 63%/i)).toBeInTheDocument()
    })

    // Should show show information
    expect(screen.getByText('Coffee Shop Gig')).toBeInTheDocument()
    expect(screen.getByText('Downtown Coffee')).toBeInTheDocument()
    expect(screen.getByText(/dec 20, 2023/i)).toBeInTheDocument()
    expect(screen.getByText(/5 days away/i)).toBeInTheDocument()

    // Should show summary statistics
    expect(screen.getByText(/2 of 4 songs ready/i)).toBeInTheDocument()
    expect(screen.getByText(/2 songs need practice/i)).toBeInTheDocument()
    expect(screen.getByText(/estimated practice time: 2 hours/i)).toBeInTheDocument()
  })

  it('should display individual song readiness with detailed status', async () => {
    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('Song Readiness Details')).toBeInTheDocument()
    })

    // Should show ready songs with green indicators
    const wonderwallStatus = screen.getByTestId('song-status-song-1')
    expect(wonderwallStatus).toHaveClass('status-ready')
    expect(wonderwallStatus).toHaveTextContent('Ready')

    const hotelCaliforniaStatus = screen.getByTestId('song-status-song-3')
    expect(hotelCaliforniaStatus).toHaveClass('status-ready')

    // Should show songs needing practice with warning indicators
    const sweetChildStatus = screen.getByTestId('song-status-song-2')
    expect(sweetChildStatus).toHaveClass('status-needs-practice')
    expect(sweetChildStatus).toHaveTextContent('Needs Practice')

    // Should show unpracticed songs with critical indicators
    const blackbirdStatus = screen.getByTestId('song-status-song-4')
    expect(blackbirdStatus).toHaveClass('status-not-practiced')
    expect(blackbirdStatus).toHaveTextContent('Not Practiced')

    // Should show confidence levels
    expect(screen.getByText('4.2/5')).toBeInTheDocument() // Wonderwall
    expect(screen.getByText('2.1/5')).toBeInTheDocument() // Sweet Child
    expect(screen.getByText('4.8/5')).toBeInTheDocument() // Hotel California
    expect(screen.getByText('1.5/5')).toBeInTheDocument() // Blackbird

    // Should show last practiced dates
    expect(screen.getByText('5 days ago')).toBeInTheDocument() // Wonderwall
    expect(screen.getByText('25 days ago')).toBeInTheDocument() // Sweet Child
    expect(screen.getByText('Never')).toBeInTheDocument() // Blackbird
  })

  it('should show specific warnings and recommendations', async () => {
    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('Recommendations')).toBeInTheDocument()
    })

    // Should show specific recommendations
    expect(screen.getByText(/schedule practice session for sweet child/i)).toBeInTheDocument()
    expect(screen.getByText(/first-time practice needed for blackbird/i)).toBeInTheDocument()
    expect(screen.getByText(/consider replacing difficult songs/i)).toBeInTheDocument()

    // Should show individual song warnings
    const sweetChildWarnings = screen.getByTestId('warnings-song-2')
    expect(sweetChildWarnings).toHaveTextContent('Not practiced in over 3 weeks')
    expect(sweetChildWarnings).toHaveTextContent('Low confidence rating')

    const blackbirdWarnings = screen.getByTestId('warnings-song-4')
    expect(blackbirdWarnings).toHaveTextContent('Never practiced')
    expect(blackbirdWarnings).toHaveTextContent('Very low confidence')
  })

  it('should allow quick scheduling of practice sessions for problematic songs', async () => {
    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByText(/schedule practice session for sweet child/i)).toBeInTheDocument()
    })

    // Click on quick schedule button for Sweet Child O\\' Mine
    const scheduleButton = screen.getByRole('button', { name: /schedule practice for sweet child/i })
    await user.click(scheduleButton)

    // Should show quick scheduling modal
    await waitFor(() => {
      expect(screen.getByText(/schedule focused practice/i)).toBeInTheDocument()
    })

    // Should pre-populate with suggested songs
    expect(screen.getByText('Sweet Child O\' Mine')).toBeInTheDocument()
    expect(screen.getByText('Blackbird')).toBeInTheDocument() // Other song needing practice

    // Should suggest appropriate session duration
    const durationInput = screen.getByLabelText(/session duration/i)
    expect(durationInput).toHaveValue('90') // 1.5 hours for focused practice

    // Should suggest session date before show
    const dateInput = screen.getByLabelText(/practice date/i)
    expect(dateInput).toHaveValue('2023-12-17') // 3 days before show

    // Add practice objectives
    const objectivesTextarea = screen.getByLabelText(/practice objectives/i)
    expect(objectivesTextarea).toHaveValue('Focus on Sweet Child O\' Mine guitar solo and timing')

    // Schedule the session
    const confirmButton = screen.getByRole('button', { name: /schedule session/i })
    await user.click(confirmButton)

    // Should create practice session
    await waitFor(() => {
      expect(PracticeSessionService.create).toHaveBeenCalledWith({
        bandId: 'band-1',
        scheduledDate: new Date('2023-12-17T19:00:00'),
        duration: 90,
        type: 'rehearsal',
        songs: ['song-2', 'song-4'],
        objectives: ['Focus on Sweet Child O\' Mine guitar solo and timing'],
        notes: 'Practice session scheduled from readiness report'
      })
    })
  })

  it('should provide actionable insights based on show timeline', async () => {
    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByText(/5 days away/i)).toBeInTheDocument()
    })

    // Should show timeline-based recommendations
    expect(screen.getByText(/urgent: limited time before show/i)).toBeInTheDocument()

    // Should suggest focusing on most critical songs
    const prioritySection = screen.getByTestId('priority-recommendations')
    expect(prioritySection).toHaveTextContent('Focus on songs with lowest confidence')

    // Should show time allocation suggestions
    expect(screen.getByText(/dedicate 60% of practice time to problem songs/i)).toBeInTheDocument()

    // Should warn about insufficient practice time
    expect(screen.getByText(/may not be enough time to perfect all songs/i)).toBeInTheDocument()
  })

  it('should adapt recommendations for different show distances', async () => {
    // Mock a show that's further away
    const futureSetlist = {
      ...mockSetlist,
      showDate: new Date('2024-01-15T20:00:00') // 1 month away
    }
    vi.mocked(SetlistService.getById).mockResolvedValue(futureSetlist)

    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByText(/31 days away/i)).toBeInTheDocument()
    })

    // Should show more relaxed recommendations
    expect(screen.getByText(/plenty of time to prepare/i)).toBeInTheDocument()
    expect(screen.getByText(/schedule regular practice sessions/i)).toBeInTheDocument()

    // Should suggest comprehensive practice approach
    expect(screen.getByText(/work on all songs systematically/i)).toBeInTheDocument()
  })

  it('should show confidence trends and practice history insights', async () => {
    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('Practice History')).toBeInTheDocument()
    })

    // Should show practice frequency analysis
    expect(screen.getByText(/wonderwall: practiced 2 times/i)).toBeInTheDocument()
    expect(screen.getByText(/sweet child: practiced 1 time/i)).toBeInTheDocument()
    expect(screen.getByText(/hotel california: practiced 2 times/i)).toBeInTheDocument()

    // Should show confidence trends
    const wonderwallTrend = screen.getByTestId('confidence-trend-song-1')
    expect(wonderwallTrend).toHaveClass('trend-improving') // 3 → 4

    const sweetChildTrend = screen.getByTestId('confidence-trend-song-2')
    expect(sweetChildTrend).toHaveClass('trend-declining') // Not practiced recently

    // Should show practice efficiency insights
    expect(screen.getByText(/hotel california shows consistent improvement/i)).toBeInTheDocument()
    expect(screen.getByText(/sweet child needs more frequent practice/i)).toBeInTheDocument()
  })

  it('should provide band-wide readiness assessment', async () => {
    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('Band Readiness')).toBeInTheDocument()
    })

    // Should show member-specific readiness (if available)
    expect(screen.getByText(/overall band confidence/i)).toBeInTheDocument()

    // Should identify which members need extra practice
    expect(screen.getByText(/focus areas by instrument/i)).toBeInTheDocument()

    // Should suggest practice allocation
    expect(screen.getByText(/guitar parts need most attention/i)).toBeInTheDocument()
  })

  it('should support mobile-optimized readiness visualization', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    fireEvent(window, new Event('resize'))

    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByTestId('mobile-readiness-view')).toBeInTheDocument()
    })

    // Should use simplified visualization for mobile
    const readinessChart = screen.getByTestId('readiness-chart-mobile')
    expect(readinessChart).toBeInTheDocument()

    // Should use large, touch-friendly action buttons
    const scheduleButtons = screen.getAllByRole('button', { name: /schedule practice/i })
    scheduleButtons.forEach(button => {
      const rect = button.getBoundingClientRect()
      expect(rect.height).toBeGreaterThanOrEqual(44)
    })

    // Should support swipe navigation between songs
    const songsList = screen.getByTestId('songs-readiness-list')

    // Simulate swipe left to see next song details
    fireEvent.touchStart(songsList, {
      touches: [{ clientX: 200, clientY: 200 }]
    })
    fireEvent.touchMove(songsList, {
      touches: [{ clientX: 50, clientY: 200 }]
    })
    fireEvent.touchEnd(songsList)

    // Should navigate to next song
    await waitFor(() => {
      expect(screen.getByTestId('focused-song-song-2')).toBeInTheDocument()
    })
  })

  it('should export readiness report for sharing with band members', async () => {
    render(
      <ReadinessReport setlistId="setlist-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export report/i })).toBeInTheDocument()
    })

    const exportButton = screen.getByRole('button', { name: /export report/i })
    await user.click(exportButton)

    // Should show export options
    await waitFor(() => {
      expect(screen.getByText(/choose export format/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /share via email/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy shareable link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument()

    // Test copy shareable link
    const copyLinkButton = screen.getByRole('button', { name: /copy shareable link/i })

    // Mock clipboard API
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
    Object.assign(navigator, { clipboard: mockClipboard })

    await user.click(copyLinkButton)

    // Should copy link to clipboard
    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/readiness-report/setlist-1')
      )
    })

    // Should show confirmation
    expect(screen.getByText(/link copied to clipboard/i)).toBeInTheDocument()
  })
})