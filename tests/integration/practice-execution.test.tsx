import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { PracticeTimer } from '../../src/components/sessions/PracticeTimer'
import { PracticeSessionService } from '../../src/services/PracticeSessionService'
import { SongService } from '../../src/services/SongService'

// Mock the services
vi.mock('../../src/services/PracticeSessionService')
vi.mock('../../src/services/SongService')

// Mock timers
vi.useFakeTimers()

const mockSession = {
  id: 'session-1',
  bandId: 'band-1',
  scheduledDate: new Date('2023-12-15T19:00:00'),
  duration: 120,
  location: 'Mike\'s Garage',
  type: 'rehearsal' as const,
  status: 'scheduled' as const,
  songs: [
    {
      songId: 'song-1',
      status: 'not-started' as const,
      timeSpent: 0,
      notes: '',
      sectionsWorked: [],
      improvements: [],
      needsWork: [],
      memberRatings: []
    },
    {
      songId: 'song-2',
      status: 'not-started' as const,
      timeSpent: 0,
      notes: '',
      sectionsWorked: [],
      improvements: [],
      needsWork: [],
      memberRatings: []
    }
  ],
  attendees: [
    { memberId: 'member-1', confirmed: true, attended: true },
    { memberId: 'member-2', confirmed: true, attended: true }
  ],
  objectives: ['Work on transitions between songs', 'Practice solos'],
  completedObjectives: [],
  notes: '',
  sessionRating: null
}

const mockSongs = [
  {
    id: 'song-1',
    title: 'Wonderwall',
    artist: 'Oasis',
    duration: 258,
    key: 'Em',
    bpm: 87,
    difficulty: 3,
    structure: [
      { type: 'verse', name: 'Verse 1' },
      { type: 'chorus', name: 'Chorus' },
      { type: 'verse', name: 'Verse 2' }
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
    structure: [
      { type: 'intro', name: 'Guitar Intro' },
      { type: 'verse', name: 'Verse 1' },
      { type: 'chorus', name: 'Chorus' },
      { type: 'solo', name: 'Guitar Solo' }
    ]
  }
]

// Wrapper component with router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('Practice Execution Workflow - Integration Test', () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()

    // Mock practice session service
    vi.mocked(PracticeSessionService.getById).mockResolvedValue(mockSession)
    vi.mocked(PracticeSessionService.start).mockImplementation(async (id) => ({
      ...mockSession,
      status: 'in-progress' as const,
      startTime: new Date()
    }))
    vi.mocked(PracticeSessionService.end).mockImplementation(async (id, data) => ({
      ...mockSession,
      status: 'completed' as const,
      endTime: new Date(),
      ...data
    }))
    vi.mocked(PracticeSessionService.updateSessionSong).mockImplementation(async (sessionId, songId, updates) => ({
      songId,
      status: 'not-started' as const,
      timeSpent: 0,
      notes: '',
      sectionsWorked: [],
      improvements: [],
      needsWork: [],
      memberRatings: [],
      ...updates
    }))

    // Mock song service
    vi.mocked(SongService.getById).mockImplementation(async (id) =>
      mockSongs.find(song => song.id === id) || null
    )
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should start a practice session and display timer', async () => {
    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    // Should show session details
    await waitFor(() => {
      expect(screen.getByText('Mike\'s Garage')).toBeInTheDocument()
    })

    expect(screen.getByText('rehearsal')).toBeInTheDocument()
    expect(screen.getByText('2 hours planned')).toBeInTheDocument()

    // Should show start button
    const startButton = screen.getByRole('button', { name: /start practice/i })
    expect(startButton).toBeInTheDocument()

    await user.click(startButton)

    // Should start the session
    await waitFor(() => {
      expect(PracticeSessionService.start).toHaveBeenCalledWith('session-1')
    })

    // Should show running timer
    expect(screen.getByTestId('practice-timer')).toBeInTheDocument()
    expect(screen.getByText('00:00:00')).toBeInTheDocument()

    // Should show session songs
    expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    expect(screen.getByText('Sweet Child O\' Mine')).toBeInTheDocument()
  })

  it('should track time accurately during practice session', async () => {
    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start practice/i })).toBeInTheDocument()
    })

    const startButton = screen.getByRole('button', { name: /start practice/i })
    await user.click(startButton)

    // Wait for timer to start
    await waitFor(() => {
      expect(screen.getByTestId('practice-timer')).toBeInTheDocument()
    })

    // Advance time by 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000)

    // Should show updated time
    await waitFor(() => {
      expect(screen.getByText('00:05:00')).toBeInTheDocument()
    })

    // Advance time by another 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000)

    // Should show total time
    await waitFor(() => {
      expect(screen.getByText('00:15:00')).toBeInTheDocument()
    })
  })

  it('should allow practicing individual songs with time tracking', async () => {
    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    // Start the session
    const startButton = await screen.findByRole('button', { name: /start practice/i })
    await user.click(startButton)

    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
    })

    // Click on first song to start practicing
    const wonderwallCard = screen.getByText('Wonderwall').closest('[data-testid="song-practice-card"]')
    await user.click(wonderwallCard!)

    // Should show song practice interface
    await waitFor(() => {
      expect(screen.getByText(/practicing: wonderwall/i)).toBeInTheDocument()
    })

    // Should show song details
    expect(screen.getByText('Em')).toBeInTheDocument()
    expect(screen.getByText('87 BPM')).toBeInTheDocument()

    // Should show song structure sections
    expect(screen.getByText('Verse 1')).toBeInTheDocument()
    expect(screen.getByText('Chorus')).toBeInTheDocument()

    // Start practicing song
    const startSongButton = screen.getByRole('button', { name: /start practicing/i })
    await user.click(startSongButton)

    // Should show song timer
    expect(screen.getByTestId('song-timer')).toBeInTheDocument()
    expect(screen.getByText('00:00')).toBeInTheDocument()

    // Advance time by 15 minutes
    vi.advanceTimersByTime(15 * 60 * 1000)

    // Should show song practice time
    await waitFor(() => {
      expect(screen.getByText('15:00')).toBeInTheDocument()
    })

    // Mark sections as worked on
    const verse1Checkbox = screen.getByRole('checkbox', { name: /verse 1/i })
    await user.click(verse1Checkbox)

    const chorusCheckbox = screen.getByRole('checkbox', { name: /chorus/i })
    await user.click(chorusCheckbox)

    // Add practice notes
    const notesInput = screen.getByLabelText(/practice notes/i)
    await user.type(notesInput, 'Worked on G-D transition')

    // Add improvements
    const improvementsInput = screen.getByLabelText(/what improved/i)
    await user.type(improvementsInput, 'Timing between chord changes')

    // Add areas needing work
    const needsWorkInput = screen.getByLabelText(/needs more work/i)
    await user.type(needsWorkInput, 'Strumming pattern consistency')

    // Stop practicing this song
    const stopSongButton = screen.getByRole('button', { name: /stop practicing/i })
    await user.click(stopSongButton)

    // Should update song practice data
    await waitFor(() => {
      expect(PracticeSessionService.updateSessionSong).toHaveBeenCalledWith(
        'session-1',
        'song-1',
        {
          timeSpent: 15,
          status: 'completed',
          notes: 'Worked on G-D transition',
          sectionsWorked: ['Verse 1', 'Chorus'],
          improvements: ['Timing between chord changes'],
          needsWork: ['Strumming pattern consistency']
        }
      )
    })
  })

  it('should support member confidence ratings during practice', async () => {
    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    // Start session and practice a song
    const startButton = await screen.findByRole('button', { name: /start practice/i })
    await user.click(startButton)

    const wonderwallCard = await screen.findByText('Wonderwall')
    await user.click(wonderwallCard.closest('[data-testid="song-practice-card"]')!)

    const startSongButton = await screen.findByRole('button', { name: /start practicing/i })
    await user.click(startSongButton)

    // Rate confidence for each member
    const memberRatingSection = screen.getByTestId('member-ratings')
    expect(memberRatingSection).toBeInTheDocument()

    // Rate confidence for member 1
    const member1Rating = screen.getByTestId('rating-member-1')
    const star4 = member1Rating.querySelector('[data-rating="4"]')
    await user.click(star4!)

    // Add feedback
    const feedbackInput = screen.getByLabelText(/confidence feedback/i)
    await user.type(feedbackInput, 'Feel confident with most parts, need work on solo')

    // Rate confidence for member 2
    const member2Rating = screen.getByTestId('rating-member-2')
    const star2 = member2Rating.querySelector('[data-rating="2"]')
    await user.click(star2!)

    // Ratings should be saved when stopping the song
    const stopSongButton = screen.getByRole('button', { name: /stop practicing/i })
    await user.click(stopSongButton)

    await waitFor(() => {
      expect(PracticeSessionService.updateSessionSong).toHaveBeenCalledWith(
        'session-1',
        'song-1',
        expect.objectContaining({
          memberRatings: [
            { memberId: 'member-1', confidence: 4, feedback: 'Feel confident with most parts, need work on solo' },
            { memberId: 'member-2', confidence: 2 }
          ]
        })
      )
    })
  })

  it('should track session objectives completion', async () => {
    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    const startButton = await screen.findByRole('button', { name: /start practice/i })
    await user.click(startButton)

    // Should show session objectives
    await waitFor(() => {
      expect(screen.getByText('Session Objectives')).toBeInTheDocument()
    })

    expect(screen.getByText('Work on transitions between songs')).toBeInTheDocument()
    expect(screen.getByText('Practice solos')).toBeInTheDocument()

    // Mark first objective as completed
    const objective1Checkbox = screen.getByRole('checkbox', { name: /work on transitions/i })
    await user.click(objective1Checkbox)

    // Should show objective as completed
    expect(objective1Checkbox).toBeChecked()

    // Add session notes
    const sessionNotesInput = screen.getByLabelText(/session notes/i)
    await user.type(sessionNotesInput, 'Good session, made progress on timing')

    // End the session
    const endSessionButton = screen.getByRole('button', { name: /end session/i })
    await user.click(endSessionButton)

    // Should show session rating dialog
    await waitFor(() => {
      expect(screen.getByText(/rate this session/i)).toBeInTheDocument()
    })

    // Rate the session
    const sessionRatingStars = screen.getByTestId('session-rating')
    const star4 = sessionRatingStars.querySelector('[data-rating="4"]')
    await user.click(star4!)

    // Confirm ending session
    const confirmEndButton = screen.getByRole('button', { name: /finish session/i })
    await user.click(confirmEndButton)

    // Should end session with data
    await waitFor(() => {
      expect(PracticeSessionService.end).toHaveBeenCalledWith('session-1', {
        notes: 'Good session, made progress on timing',
        completedObjectives: ['Work on transitions between songs'],
        sessionRating: 4
      })
    })
  })

  it('should handle session pause and resume functionality', async () => {
    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    const startButton = await screen.findByRole('button', { name: /start practice/i })
    await user.click(startButton)

    // Let timer run for 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000)

    await waitFor(() => {
      expect(screen.getByText('00:10:00')).toBeInTheDocument()
    })

    // Pause the session
    const pauseButton = screen.getByRole('button', { name: /pause session/i })
    await user.click(pauseButton)

    // Timer should show paused state
    expect(screen.getByText(/session paused/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume session/i })).toBeInTheDocument()

    // Advance time while paused
    vi.advanceTimersByTime(5 * 60 * 1000)

    // Time should not have changed
    expect(screen.getByText('00:10:00')).toBeInTheDocument()

    // Resume session
    const resumeButton = screen.getByRole('button', { name: /resume session/i })
    await user.click(resumeButton)

    // Timer should continue from where it paused
    vi.advanceTimersByTime(5 * 60 * 1000)

    await waitFor(() => {
      expect(screen.getByText('00:15:00')).toBeInTheDocument()
    })
  })

  it('should provide mobile-optimized practice interface', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    fireEvent(window, new Event('resize'))

    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    const startButton = await screen.findByRole('button', { name: /start practice/i })
    await user.click(startButton)

    // Timer should be prominently displayed for mobile
    const timer = screen.getByTestId('practice-timer')
    expect(timer).toHaveClass('mobile-timer-large')

    // Touch targets should be appropriately sized
    const pauseButton = screen.getByRole('button', { name: /pause session/i })
    const buttonRect = pauseButton.getBoundingClientRect()
    expect(buttonRect.height).toBeGreaterThanOrEqual(44)

    // Should support swipe navigation between songs
    const songsContainer = screen.getByTestId('songs-container')

    // Simulate swipe left to next song
    fireEvent.touchStart(songsContainer, {
      touches: [{ clientX: 200, clientY: 200 }]
    })
    fireEvent.touchMove(songsContainer, {
      touches: [{ clientX: 50, clientY: 200 }]
    })
    fireEvent.touchEnd(songsContainer)

    // Should switch to next song
    await waitFor(() => {
      expect(screen.getByText(/sweet child o' mine/i)).toBeInTheDocument()
    })
  })

  it('should handle extended practice sessions reliably', async () => {
    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    const startButton = await screen.findByRole('button', { name: /start practice/i })
    await user.click(startButton)

    // Simulate a 3-hour practice session
    const threeHours = 3 * 60 * 60 * 1000
    vi.advanceTimersByTime(threeHours)

    // Should still display correct time
    await waitFor(() => {
      expect(screen.getByText('03:00:00')).toBeInTheDocument()
    })

    // Should show warning when approaching planned session end
    expect(screen.getByText(/session running longer than planned/i)).toBeInTheDocument()

    // Timer should continue to work accurately
    vi.advanceTimersByTime(30 * 60 * 1000) // Additional 30 minutes

    await waitFor(() => {
      expect(screen.getByText('03:30:00')).toBeInTheDocument()
    })
  })

  it('should save practice data even if session ends abruptly', async () => {
    render(
      <PracticeTimer sessionId="session-1" />,
      { wrapper: TestWrapper }
    )

    const startButton = await screen.findByRole('button', { name: /start practice/i })
    await user.click(startButton)

    // Practice a song for some time
    const wonderwallCard = await screen.findByText('Wonderwall')
    await user.click(wonderwallCard.closest('[data-testid="song-practice-card"]')!)

    const startSongButton = await screen.findByRole('button', { name: /start practicing/i })
    await user.click(startSongButton)

    vi.advanceTimersByTime(10 * 60 * 1000) // 10 minutes

    // Add some notes
    const notesInput = screen.getByLabelText(/practice notes/i)
    await user.type(notesInput, 'Working on chord progression')

    // Simulate browser/app close (beforeunload event)
    const beforeUnloadEvent = new Event('beforeunload')
    window.dispatchEvent(beforeUnloadEvent)

    // Should attempt to save session data
    await waitFor(() => {
      expect(PracticeSessionService.updateSessionSong).toHaveBeenCalledWith(
        'session-1',
        'song-1',
        expect.objectContaining({
          timeSpent: 10,
          notes: 'Working on chord progression'
        })
      )
    })
  })
})