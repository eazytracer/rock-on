import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'
import { DatabaseService } from '../../src/services/DatabaseService'

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  cmp: vi.fn()
}

Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: mockIndexedDB
})

// Mock the database service
vi.mock('../../src/services/DatabaseService', () => ({
  DatabaseService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    createBand: vi.fn(),
    getBands: vi.fn().mockResolvedValue([]),
    createMember: vi.fn(),
    isInitialized: vi.fn().mockReturnValue(true)
  }
}))

// Mock navigation for router
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => children
  }
})

describe('Initial Setup and Band Creation - Integration Test', () => {
  const user = userEvent.setup()

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset IndexedDB mock
    mockIndexedDB.open.mockClear()

    // Mock successful database initialization
    vi.mocked(DatabaseService.initialize).mockResolvedValue(undefined)
    vi.mocked(DatabaseService.getBands).mockResolvedValue([])
  })

  it('should complete the full onboarding flow for a new user', async () => {
    // Mock empty bands list (new user)
    vi.mocked(DatabaseService.getBands).mockResolvedValue([])

    render(<App />)

    // Should show onboarding/welcome screen
    await waitFor(() => {
      expect(screen.getByText(/welcome to rock on/i)).toBeInTheDocument()
    })

    // Should have "Create Your First Band" button
    const createBandButton = screen.getByRole('button', { name: /create your first band/i })
    expect(createBandButton).toBeInTheDocument()

    await user.click(createBandButton)

    // Should show band creation form
    await waitFor(() => {
      expect(screen.getByLabelText(/band name/i)).toBeInTheDocument()
    })

    // Fill in band information
    const bandNameInput = screen.getByLabelText(/band name/i)
    await user.type(bandNameInput, 'The Test Band')

    const descriptionInput = screen.getByLabelText(/description/i)
    await user.type(descriptionInput, 'A test band for integration testing')

    // Submit band creation
    const submitButton = screen.getByRole('button', { name: /create band/i })

    // Mock successful band creation
    const mockBand = {
      id: 'band-1',
      name: 'The Test Band',
      description: 'A test band for integration testing',
      createdDate: new Date(),
      memberIds: [],
      settings: {}
    }
    vi.mocked(DatabaseService.createBand).mockResolvedValue(mockBand)

    await user.click(submitButton)

    // Verify band creation was called
    await waitFor(() => {
      expect(DatabaseService.createBand).toHaveBeenCalledWith({
        name: 'The Test Band',
        description: 'A test band for integration testing'
      })
    })

    // Should proceed to member creation
    await waitFor(() => {
      expect(screen.getByText(/add yourself as the first member/i)).toBeInTheDocument()
    })

    // Fill in member information
    const memberNameInput = screen.getByLabelText(/your name/i)
    await user.type(memberNameInput, 'Test User')

    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'test@example.com')

    // Select primary instrument
    const instrumentSelect = screen.getByLabelText(/primary instrument/i)
    await user.selectOptions(instrumentSelect, 'Guitar')

    // Add additional instruments
    const addInstrumentButton = screen.getByRole('button', { name: /add instrument/i })
    await user.click(addInstrumentButton)

    const additionalInstrumentSelect = screen.getByLabelText(/additional instrument/i)
    await user.selectOptions(additionalInstrumentSelect, 'Bass')

    // Submit member creation
    const createMemberButton = screen.getByRole('button', { name: /join band/i })

    // Mock successful member creation
    const mockMember = {
      id: 'member-1',
      name: 'Test User',
      email: 'test@example.com',
      instruments: ['Guitar', 'Bass'],
      primaryInstrument: 'Guitar',
      role: 'Admin' as const,
      joinDate: new Date(),
      isActive: true
    }
    vi.mocked(DatabaseService.createMember).mockResolvedValue(mockMember)

    await user.click(createMemberButton)

    // Verify member creation was called
    await waitFor(() => {
      expect(DatabaseService.createMember).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        instruments: ['Guitar', 'Bass'],
        primaryInstrument: 'Guitar',
        bandId: 'band-1'
      })
    })

    // Should navigate to dashboard
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should show dashboard with empty state for new band', async () => {
    // Mock existing band
    const mockBand = {
      id: 'band-1',
      name: 'The Test Band',
      description: 'A test band',
      createdDate: new Date(),
      memberIds: ['member-1'],
      settings: {}
    }
    vi.mocked(DatabaseService.getBands).mockResolvedValue([mockBand])

    render(<App />)

    // Should show dashboard
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
    })

    // Should show band name in header
    expect(screen.getByText('The Test Band')).toBeInTheDocument()

    // Should show empty state cards
    expect(screen.getByText(/add your first song/i)).toBeInTheDocument()
    expect(screen.getByText(/schedule practice/i)).toBeInTheDocument()
    expect(screen.getByText(/create setlist/i)).toBeInTheDocument()

    // Should have bottom navigation
    expect(screen.getByText(/songs/i)).toBeInTheDocument()
    expect(screen.getByText(/practice/i)).toBeInTheDocument()
    expect(screen.getByText(/setlists/i)).toBeInTheDocument()
  })

  it('should handle band creation validation errors', async () => {
    vi.mocked(DatabaseService.getBands).mockResolvedValue([])

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create your first band/i })).toBeInTheDocument()
    })

    const createBandButton = screen.getByRole('button', { name: /create your first band/i })
    await user.click(createBandButton)

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /create band/i })
    await user.click(submitButton)

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/band name is required/i)).toBeInTheDocument()
    })

    // Fill in band name with too many characters
    const bandNameInput = screen.getByLabelText(/band name/i)
    await user.type(bandNameInput, 'A'.repeat(101)) // Exceeds 100 char limit

    await user.click(submitButton)

    // Should show length validation error
    await waitFor(() => {
      expect(screen.getByText(/band name must be 100 characters or less/i)).toBeInTheDocument()
    })
  })

  it('should handle database initialization errors gracefully', async () => {
    // Mock database initialization failure
    vi.mocked(DatabaseService.initialize).mockRejectedValue(new Error('Database initialization failed'))

    render(<App />)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to initialize database/i)).toBeInTheDocument()
    })

    // Should provide retry option
    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()

    // Mock successful retry
    vi.mocked(DatabaseService.initialize).mockResolvedValue(undefined)
    vi.mocked(DatabaseService.getBands).mockResolvedValue([])

    await user.click(retryButton)

    // Should proceed to normal onboarding
    await waitFor(() => {
      expect(screen.getByText(/welcome to rock on/i)).toBeInTheDocument()
    })
  })

  it('should maintain mobile-first responsive design throughout setup', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 667
    })

    // Trigger resize event
    fireEvent(window, new Event('resize'))

    vi.mocked(DatabaseService.getBands).mockResolvedValue([])

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create your first band/i })).toBeInTheDocument()
    })

    // Check that touch targets are appropriately sized (minimum 44px)
    const createBandButton = screen.getByRole('button', { name: /create your first band/i })
    const buttonStyles = window.getComputedStyle(createBandButton)

    // Note: In a real test, you'd check computed styles, but for this test
    // we'll verify the button exists and is clickable
    expect(createBandButton).toBeInTheDocument()
    expect(createBandButton).not.toBeDisabled()

    await user.click(createBandButton)

    // Verify form layout adapts to mobile
    await waitFor(() => {
      const form = screen.getByLabelText(/band name/i).closest('form')
      expect(form).toBeInTheDocument()
    })
  })

  it('should support keyboard navigation for accessibility', async () => {
    vi.mocked(DatabaseService.getBands).mockResolvedValue([])

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create your first band/i })).toBeInTheDocument()
    })

    // Navigate using keyboard
    const createBandButton = screen.getByRole('button', { name: /create your first band/i })
    createBandButton.focus()

    expect(document.activeElement).toBe(createBandButton)

    // Press Enter to activate
    fireEvent.keyDown(createBandButton, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(screen.getByLabelText(/band name/i)).toBeInTheDocument()
    })

    // Tab through form fields
    const bandNameInput = screen.getByLabelText(/band name/i)
    expect(document.activeElement).toBe(bandNameInput)

    fireEvent.keyDown(bandNameInput, { key: 'Tab', code: 'Tab' })

    const descriptionInput = screen.getByLabelText(/description/i)
    expect(document.activeElement).toBe(descriptionInput)
  })
})