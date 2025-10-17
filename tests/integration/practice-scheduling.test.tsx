import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Sessions } from '../../src/pages/Sessions/Sessions'
import { PracticeSessionService } from '../../src/services/PracticeSessionService'
import { SongService } from '../../src/services/SongService'
import { DatabaseService } from '../../src/services/DatabaseService'

// Mock the services
vi.mock('../../src/services/PracticeSessionService')
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
    confidenceLevel: 2
  },
  {
    id: 'song-2',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    duration: 356,
    key: 'D',
    bpm: 125,
    difficulty: 4,
    confidenceLevel: 1
  }
]

const mockMembers = [
  {
    id: 'member-1',
    name: 'John Doe',
    email: 'john@example.com',
    instruments: ['Guitar'],
    primaryInstrument: 'Guitar',
    role: 'Admin' as const
  },
  {
    id: 'member-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    instruments: ['Bass'],
    primaryInstrument: 'Bass',
    role: 'Member' as const
  }
]

const mockBand = {
  id: 'band-1',
  name: 'Test Band',
  memberIds: ['member-1', 'member-2']
}

const mockSessions = [
  {
    id: 'session-1',
    bandId: 'band-1',
    scheduledDate: new Date('2023-12-15T19:00:00'),
    duration: 120,
    location: 'Mike\'s Garage',
    type: 'rehearsal' as const,
    status: 'scheduled' as const,
    songs: [
      { songId: 'song-1', status: 'not-started' as const, timeSpent: 0 }
    ],
    attendees: [
      { memberId: 'member-1', confirmed: true, attended: false },
      { memberId: 'member-2', confirmed: false, attended: false }
    ],
    objectives: ['Work on transitions between songs'],
    notes: 'Focus on timing'
  }
]

// Wrapper component with router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('Practice Scheduling Workflow - Integration Test', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock database service
    vi.mocked(DatabaseService.isInitialized).mockReturnValue(true)
    vi.mocked(DatabaseService.getCurrentBand).mockResolvedValue(mockBand)

    // Mock practice session service
    vi.mocked(PracticeSessionService.getAll).mockResolvedValue(mockSessions)
    vi.mocked(PracticeSessionService.create).mockImplementation(async (sessionData) => ({
      id: 'new-session-id',
      createdDate: new Date(),
      lastModified: new Date(),
      status: 'scheduled' as const,
      songs: [],
      attendees: [],
      objectives: [],
      completedObjectives: [],
      ...sessionData
    }))
    vi.mocked(PracticeSessionService.update).mockImplementation(async (id, updates) => ({
      ...mockSessions.find(s => s.id === id)!,
      ...updates,
      lastModified: new Date()
    }))
    vi.mocked(PracticeSessionService.delete).mockResolvedValue(undefined)

    // Mock song service
    vi.mocked(SongService.getAll).mockResolvedValue(mockSongs)

    // Mock getting band members
    vi.mocked(DatabaseService.getBandMembers).mockResolvedValue(mockMembers)
  })

  it('should display practice sessions calendar view', async () => {
    render(<Sessions />, { wrapper: TestWrapper })

    // Should show calendar view
    await waitFor(() => {
      expect(screen.getByText(/practice sessions/i)).toBeInTheDocument()
    })

    // Should show existing session
    expect(screen.getByText('Mike\'s Garage')).toBeInTheDocument()
    expect(screen.getByText('rehearsal')).toBeInTheDocument()

    // Should show session date
    expect(screen.getByText(/dec 15/i)).toBeInTheDocument()

    // Should show RSVP status
    expect(screen.getByText(/1 confirmed/i)).toBeInTheDocument()
  })

  it('should allow scheduling a new practice session', async () => {
    render(<Sessions />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /schedule session/i })).toBeInTheDocument()
    })

    // Click schedule session button
    const scheduleButton = screen.getByRole('button', { name: /schedule session/i })
    await user.click(scheduleButton)

    // Should show scheduling form
    await waitFor(() => {
      expect(screen.getByLabelText(/session date/i)).toBeInTheDocument()
    })

    // Fill in session details
    const dateInput = screen.getByLabelText(/session date/i)
    await user.type(dateInput, '2023-12-20')

    const timeInput = screen.getByLabelText(/start time/i)
    await user.type(timeInput, '19:00')

    const durationInput = screen.getByLabelText(/duration/i)
    await user.clear(durationInput)
    await user.type(durationInput, '180') // 3 hours

    const locationInput = screen.getByLabelText(/location/i)
    await user.type(locationInput, 'Downtown Studio')

    // Select session type
    const typeSelect = screen.getByLabelText(/session type/i)
    await user.selectOptions(typeSelect, 'recording')

    // Add songs to practice
    const addSongsButton = screen.getByRole('button', { name: /add songs/i })
    await user.click(addSongsButton)

    // Should show song selection modal
    await waitFor(() => {
      expect(screen.getByText('Wonderwall')).toBeInTheDocument()
      expect(screen.getByText('Sweet Child O\' Mine')).toBeInTheDocument()
    })

    // Select songs
    const wonderwallCheckbox = screen.getByRole('checkbox', { name: /wonderwall/i })
    const sweetChildCheckbox = screen.getByRole('checkbox', { name: /sweet child/i })

    await user.click(wonderwallCheckbox)
    await user.click(sweetChildCheckbox)

    const confirmSongsButton = screen.getByRole('button', { name: /confirm selection/i })
    await user.click(confirmSongsButton)

    // Add objectives
    const objectivesInput = screen.getByLabelText(/session objectives/i)
    await user.type(objectivesInput, 'Perfect the guitar solos')

    // Add additional objective
    const addObjectiveButton = screen.getByRole('button', { name: /add objective/i })
    await user.click(addObjectiveButton)

    const secondObjectiveInput = screen.getAllByLabelText(/objective/i)[1]
    await user.type(secondObjectiveInput, 'Work on vocal harmonies')

    // Add session notes
    const notesInput = screen.getByLabelText(/session notes/i)
    await user.type(notesInput, 'Recording session for demo')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /schedule session/i })
    await user.click(submitButton)

    // Verify session creation was called
    await waitFor(() => {
      expect(PracticeSessionService.create).toHaveBeenCalledWith({
        bandId: 'band-1',
        scheduledDate: new Date('2023-12-20T19:00:00'),
        duration: 180,
        location: 'Downtown Studio',
        type: 'recording',
        songs: ['song-1', 'song-2'],
        invitees: ['member-1', 'member-2'],
        objectives: ['Perfect the guitar solos', 'Work on vocal harmonies'],
        notes: 'Recording session for demo'
      })
    })
  })

  it('should allow editing existing practice sessions', async () => {
    render(<Sessions />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Mike\'s Garage')).toBeInTheDocument()
    })

    // Click on existing session
    const sessionCard = screen.getByText('Mike\'s Garage').closest('[data-testid="session-card"]')
    await user.click(sessionCard!)

    // Should show session details
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit session/i })).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit session/i })
    await user.click(editButton)

    // Should show edit form with current values
    await waitFor(() => {
      expect(screen.getByDisplayValue('Mike\'s Garage')).toBeInTheDocument()
      expect(screen.getByDisplayValue('120')).toBeInTheDocument()
    })

    // Update location
    const locationInput = screen.getByDisplayValue('Mike\'s Garage')
    await user.clear(locationInput)
    await user.type(locationInput, 'New Practice Space')

    // Update duration
    const durationInput = screen.getByDisplayValue('120')
    await user.clear(durationInput)
    await user.type(durationInput, '150')

    // Save changes
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    // Verify update was called
    await waitFor(() => {
      expect(PracticeSessionService.update).toHaveBeenCalledWith('session-1', {
        location: 'New Practice Space',
        duration: 150
      })
    })
  })

  it('should handle RSVP functionality for band members', async () => {
    render(<Sessions />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Mike\'s Garage')).toBeInTheDocument()
    })

    // Click on session to view details
    const sessionCard = screen.getByText('Mike\'s Garage').closest('[data-testid="session-card"]')
    await user.click(sessionCard!)

    // Should show RSVP section
    await waitFor(() => {
      expect(screen.getByText(/rsvp status/i)).toBeInTheDocument()
    })

    // Should show member RSVP statuses
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()

    // John should be confirmed
    const johnStatus = screen.getByTestId('rsvp-member-1')
    expect(johnStatus).toHaveTextContent('Confirmed')

    // Jane should be pending
    const janeStatus = screen.getByTestId('rsvp-member-2')
    expect(janeStatus).toHaveTextContent('Pending')

    // As current user (assuming member-1), should be able to change RSVP
    const rsvpButton = screen.getByRole('button', { name: /change rsvp/i })
    await user.click(rsvpButton)

    // Should show RSVP options
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /can't attend/i })).toBeInTheDocument()
    })

    const cantAttendButton = screen.getByRole('button', { name: /can't attend/i })
    await user.click(cantAttendButton)

    // Should update RSVP status
    await waitFor(() => {
      expect(PracticeSessionService.updateAttendance).toHaveBeenCalledWith('session-1', 'member-1', {
        confirmed: false,
        attended: false
      })
    })
  })

  it('should show session conflicts and warnings', async () => {
    // Mock a conflict - another session at the same time
    const conflictingSessions = [
      ...mockSessions,
      {
        id: 'session-2',
        bandId: 'band-1',
        scheduledDate: new Date('2023-12-15T19:00:00'), // Same time as session-1
        duration: 90,
        location: 'Another Location',
        type: 'rehearsal' as const,
        status: 'scheduled' as const
      }
    ]

    vi.mocked(PracticeSessionService.getAll).mockResolvedValue(conflictingSessions)

    render(<Sessions />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText(/schedule conflict/i)).toBeInTheDocument()
    })

    // Should show warning indicator
    expect(screen.getByTestId('conflict-warning')).toBeInTheDocument()

    // Click on conflict warning to see details
    const conflictWarning = screen.getByTestId('conflict-warning')
    await user.click(conflictWarning)

    // Should show conflict details
    await waitFor(() => {
      expect(screen.getByText(/multiple sessions scheduled at the same time/i)).toBeInTheDocument()
    })
  })

  it('should support different calendar views (month, week, day)', async () => {
    render(<Sessions />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText(/practice sessions/i)).toBeInTheDocument()
    })

    // Should show view switcher
    expect(screen.getByRole('button', { name: /month view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /week view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /day view/i })).toBeInTheDocument()

    // Switch to week view
    const weekViewButton = screen.getByRole('button', { name: /week view/i })
    await user.click(weekViewButton)

    // Should show week layout
    await waitFor(() => {
      expect(screen.getByTestId('week-view')).toBeInTheDocument()
    })

    // Switch to day view
    const dayViewButton = screen.getByRole('button', { name: /day view/i })
    await user.click(dayViewButton)

    // Should show day layout
    await waitFor(() => {
      expect(screen.getByTestId('day-view')).toBeInTheDocument()
    })
  })

  it('should handle session cancellation with notifications', async () => {
    render(<Sessions />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Mike\'s Garage')).toBeInTheDocument()
    })

    // Click on session
    const sessionCard = screen.getByText('Mike\'s Garage').closest('[data-testid="session-card"]')
    await user.click(sessionCard!)

    // Should show cancel option for session organizer
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel session/i })).toBeInTheDocument()
    })

    const cancelButton = screen.getByRole('button', { name: /cancel session/i })
    await user.click(cancelButton)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to cancel/i)).toBeInTheDocument()
    })

    // Add cancellation reason
    const reasonInput = screen.getByLabelText(/cancellation reason/i)
    await user.type(reasonInput, 'Equipment issues at venue')

    // Confirm cancellation
    const confirmCancelButton = screen.getByRole('button', { name: /confirm cancellation/i })
    await user.click(confirmCancelButton)

    // Verify session status update
    await waitFor(() => {
      expect(PracticeSessionService.update).toHaveBeenCalledWith('session-1', {
        status: 'cancelled',
        notes: 'Equipment issues at venue'
      })
    })
  })

  it('should adapt to mobile layout with touch-friendly controls', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    fireEvent(window, new Event('resize'))

    render(<Sessions />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText(/practice sessions/i)).toBeInTheDocument()
    })

    // Should show mobile-optimized calendar
    const calendar = screen.getByTestId('sessions-calendar')
    expect(calendar).toHaveClass('mobile-calendar')

    // Touch targets should be large enough (minimum 44px)
    const scheduleButton = screen.getByRole('button', { name: /schedule session/i })
    const buttonRect = scheduleButton.getBoundingClientRect()
    expect(buttonRect.height).toBeGreaterThanOrEqual(44)

    // Should support swipe navigation between months
    const calendarContainer = screen.getByTestId('calendar-container')

    // Simulate swipe left (next month)
    fireEvent.touchStart(calendarContainer, {
      touches: [{ clientX: 200, clientY: 200 }]
    })
    fireEvent.touchMove(calendarContainer, {
      touches: [{ clientX: 50, clientY: 200 }]
    })
    fireEvent.touchEnd(calendarContainer)

    // Should navigate to next month
    await waitFor(() => {
      expect(screen.getByText(/january 2024/i)).toBeInTheDocument()
    })
  })

  it('should validate scheduling form inputs', async () => {
    render(<Sessions />, { wrapper: TestWrapper })

    const scheduleButton = screen.getByRole('button', { name: /schedule session/i })
    await user.click(scheduleButton)

    // Try to submit without required fields
    const submitButton = screen.getByRole('button', { name: /schedule session/i })
    await user.click(submitButton)

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/session date is required/i)).toBeInTheDocument()
      expect(screen.getByText(/start time is required/i)).toBeInTheDocument()
    })

    // Fill with invalid data
    const dateInput = screen.getByLabelText(/session date/i)
    await user.type(dateInput, '2023-01-01') // Past date

    const durationInput = screen.getByLabelText(/duration/i)
    await user.clear(durationInput)
    await user.type(durationInput, '600') // Unrealistic duration

    await user.click(submitButton)

    // Should show specific validation errors
    await waitFor(() => {
      expect(screen.getByText(/session date cannot be in the past/i)).toBeInTheDocument()
      expect(screen.getByText(/duration should be reasonable/i)).toBeInTheDocument()
    })
  })
})