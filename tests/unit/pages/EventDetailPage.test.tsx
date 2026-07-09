import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  EventSummary,
  EventParticipant,
  LineupRequest,
} from '../../../src/models/Event'

// ── Mutable hook state (reset per test) ─────────────────────────────────────
const addRequest = vi.fn(() => Promise.resolve({ ok: true }))
const addLineupItem = vi.fn(() => Promise.resolve({ ok: true }))
const updateLineupItem = vi.fn(() => Promise.resolve({ ok: true }))
const removeLineupItem = vi.fn(() => Promise.resolve({ ok: true }))
const reorderLineup = vi.fn(() => Promise.resolve({ ok: true }))
const updateEvent = vi.fn(() => Promise.resolve({ ok: true }))
const cancelEvent = vi.fn(() => Promise.resolve({ ok: true }))
const removeParticipant = vi.fn(() => Promise.resolve({ ok: true }))
const leaveEvent = vi.fn(() => Promise.resolve({ ok: true }))
const approve = vi.fn(() => Promise.resolve())
const showToast = vi.fn()
const navigate = vi.fn()

const baseEvent: EventSummary = {
  id: 'ev1',
  name: 'Backyard Jam',
  scheduledDate: new Date('2026-08-01T00:00:00Z'),
  status: 'scheduled',
  visibility: 'unlisted',
  hostUserId: 'me',
  allowSuggestions: true,
  autoApprove: false,
}

const detail: {
  event: EventSummary
  lineup: unknown[]
  requests: LineupRequest[]
  isManager: boolean
} = { event: baseEvent, lineup: [], requests: [], isManager: true }

const participantsState: { list: EventParticipant[] } = {
  list: [{ userId: 'u2', name: 'Tomás', accessTier: 'guest', rsvp: 'going' }],
}

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({}),
}))

vi.mock('../../../src/hooks/useEvents', () => ({
  useEventDetail: () => ({
    ...detail,
    loading: false,
    refetch: vi.fn(),
    addRequest,
    addLineupItem,
    updateLineupItem,
    removeLineupItem,
    reorderLineup,
    updateEvent,
    cancelEvent,
    approve,
    reject: vi.fn(),
  }),
  useEventHands: () => ({
    hands: [],
    raiseHand: vi.fn(),
    withdrawHand: vi.fn(),
    acceptHand: vi.fn(),
    declineHand: vi.fn(),
  }),
  useEventParticipants: () => ({
    participants: participantsState.list,
    refetch: vi.fn(),
    removeParticipant,
    leaveEvent,
  }),
}))
vi.mock('../../../src/hooks/useCasting', () => ({
  useCasting: () => ({
    casting: [],
    defaultParts: [],
    loading: false,
    assign: vi.fn(),
    unassign: vi.fn(),
    update: vi.fn(),
  }),
}))
vi.mock('../../../src/hooks/useResponsive', () => ({
  useViewport: () => ({ isMobile: false }),
}))
vi.mock('../../../src/hooks/useTunings', () => ({
  useTunings: () => ({
    builtins: [
      {
        id: 't-standard',
        slug: 'standard',
        name: 'Standard',
        color: '#60a5fa',
      },
      { id: 't-dropd', slug: 'drop-d', name: 'Drop D', color: '#f97316' },
    ],
    customs: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
vi.mock('../../../src/hooks/useGoBack', () => ({ useGoBack: () => vi.fn() }))
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Me' }, currentBandId: null }),
}))
vi.mock('../../../src/contexts/ToastContext', () => ({
  useToast: () => ({ showToast }),
}))
// Keep the render shallow — the casting/invite children have their own tests.
vi.mock('../../../src/components/casting/SongCastPanel', () => ({
  SongCastPanel: () => null,
}))
vi.mock('../../../src/components/casting/EventCastGrid', () => ({
  EventCastGrid: () => null,
}))
vi.mock('../../../src/components/casting/LineupCard', () => ({
  LineupCard: () => null,
}))
vi.mock('../../../src/components/events/InviteFriendsSheet', () => ({
  InviteFriendsSheet: () => null,
}))

import { EventDetailContent } from '../../../src/pages/EventDetailPage'

const pendingReq = (parts?: string[]): LineupRequest => ({
  id: 'r1',
  requesterId: 'u2',
  source: 'external',
  displayTitle: 'Wonderwall',
  displayArtist: 'Oasis',
  status: 'pending',
  createdDate: new Date(),
  parts,
})

beforeEach(() => {
  detail.event = baseEvent
  detail.lineup = []
  detail.requests = []
  detail.isManager = true
  participantsState.list = [
    { userId: 'u2', name: 'Tomás', accessTier: 'guest', rsvp: 'going' },
  ]
  vi.clearAllMocks()
})

describe('EventDetailPage — request "I\'d play" part chips (E)', () => {
  it('renders the fixed-five offer chips on the request form', () => {
    render(<EventDetailContent eventId="ev1" />)
    fireEvent.click(screen.getByTestId('event-tab-requests'))
    for (const key of ['guitar', 'bass', 'drums', 'vox', 'keys']) {
      expect(screen.getByTestId(`event-offer-part-${key}`)).toBeInTheDocument()
    }
  })

  it('threads selected parts into addRequest', async () => {
    render(<EventDetailContent eventId="ev1" />)
    fireEvent.click(screen.getByTestId('event-tab-requests'))
    fireEvent.change(screen.getByTestId('event-request-title'), {
      target: { value: 'Wonderwall' },
    })
    fireEvent.change(screen.getByTestId('event-request-artist'), {
      target: { value: 'Oasis' },
    })
    fireEvent.click(screen.getByTestId('event-offer-part-guitar'))
    fireEvent.click(screen.getByTestId('event-offer-part-vox'))
    fireEvent.click(screen.getByTestId('event-request-submit'))
    await waitFor(() => expect(addRequest).toHaveBeenCalledOnce())
    expect(addRequest).toHaveBeenCalledWith('Wonderwall', 'Oasis', [
      'guitar',
      'vox',
    ])
  })
})

describe('EventDetailPage — requests card offer + approve toast (E)', () => {
  it('shows "Offers to play" when the request carries parts', () => {
    detail.requests = [pendingReq(['guitar', 'vox'])]
    render(<EventDetailContent eventId="ev1" />)
    fireEvent.click(screen.getByTestId('event-tab-requests'))
    expect(screen.getByTestId('event-request-offer-r1')).toHaveTextContent(
      'Offers to play Guitar, Vox'
    )
  })

  it('surfaces "hand is up" toast after approving a request with parts', async () => {
    detail.requests = [pendingReq(['guitar'])]
    render(<EventDetailContent eventId="ev1" />)
    fireEvent.click(screen.getByTestId('event-tab-requests'))
    fireEvent.click(screen.getByTestId('event-approve-r1'))
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "Added — Tomás's hand is up",
        'success'
      )
    )
    expect(approve).toHaveBeenCalledWith('r1')
  })

  it('no hand toast when the approved request had no parts', async () => {
    detail.requests = [pendingReq()]
    render(<EventDetailContent eventId="ev1" />)
    fireEvent.click(screen.getByTestId('event-tab-requests'))
    fireEvent.click(screen.getByTestId('event-approve-r1'))
    await waitFor(() => expect(approve).toHaveBeenCalledWith('r1'))
    expect(showToast).not.toHaveBeenCalled()
  })
})

describe('EventDetailPage — host adds a song directly (D)', () => {
  it('shows the Add-song control to a host', () => {
    render(<EventDetailContent eventId="ev1" />)
    expect(screen.getByTestId('event-add-song-button')).toBeInTheDocument()
  })

  it('hides the Add-song control from a guest', () => {
    detail.isManager = false
    render(<EventDetailContent eventId="ev1" />)
    expect(screen.queryByTestId('event-add-song-button')).toBeNull()
  })

  it('adds a song straight to the lineup', async () => {
    render(<EventDetailContent eventId="ev1" />)
    fireEvent.change(screen.getByTestId('event-add-song-title'), {
      target: { value: 'Creep' },
    })
    fireEvent.change(screen.getByTestId('event-add-song-artist'), {
      target: { value: 'Radiohead' },
    })
    fireEvent.click(screen.getByTestId('event-add-song-submit'))
    await waitFor(() => expect(addLineupItem).toHaveBeenCalledOnce())
    expect(addLineupItem).toHaveBeenCalledWith({
      title: 'Creep',
      artist: 'Radiohead',
    })
  })
})

describe('EventDetailPage — inline header edits + status (K/6d)', () => {
  it('no longer offers an Edit-event kebab / edit-page navigation', () => {
    render(<EventDetailContent eventId="ev1" />)
    // The bespoke edit affordance and its route are gone (edit is inline now).
    expect(screen.queryByTestId('event-host-actions')).toBeNull()
    expect(screen.queryByTestId('event-edit-button')).toBeNull()
    expect(navigate).not.toHaveBeenCalledWith('/events/ev1/edit')
  })

  it('shows the inline title editor to the host and no status badge', () => {
    render(<EventDetailContent eventId="ev1" />)
    expect(screen.getByTestId('event-name')).toBeInTheDocument()
    // The editable status badge is gone (cancel now lives in the Access tab).
    expect(screen.queryByTestId('event-status')).toBeNull()
    // A non-cancelled event shows no "Cancelled" badge.
    expect(screen.queryByTestId('event-cancelled-badge')).toBeNull()
  })

  it('shows a "Cancelled" badge only when the event is cancelled', () => {
    detail.event = { ...baseEvent, status: 'cancelled' }
    render(<EventDetailContent eventId="ev1" />)
    expect(screen.getByTestId('event-cancelled-badge')).toBeInTheDocument()
  })

  it('hides host inline edit affordances from a guest', () => {
    detail.isManager = false
    detail.event = { ...baseEvent, hostUserId: 'host' }
    render(<EventDetailContent eventId="ev1" />)
    expect(screen.queryByTestId('event-name')).toBeNull()
    expect(screen.queryByTestId('event-status')).toBeNull()
    // Guest still sees the event name, read-only.
    expect(screen.getByText('Backyard Jam')).toBeInTheDocument()
  })

  it('saves an inline venue edit via updateEvent', async () => {
    detail.event = { ...baseEvent, venue: 'The Garage' }
    render(<EventDetailContent eventId="ev1" />)
    // Enter edit mode on the venue field, change the value, blur to save.
    fireEvent.click(screen.getByTestId('event-detail-venue-display'))
    const input = screen.getByTestId('event-detail-venue-input')
    fireEvent.change(input, { target: { value: 'The Barn' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() =>
      expect(updateEvent).toHaveBeenCalledWith({ venue: 'The Barn' })
    )
  })

  it('surfaces the start time in the header (inline time field)', () => {
    detail.event = {
      ...baseEvent,
      scheduledDate: new Date(2026, 7, 1, 19, 0, 0),
    }
    render(<EventDetailContent eventId="ev1" />)
    expect(screen.getByTestId('event-detail-time')).toHaveTextContent('7:00 PM')
  })
})

describe('EventDetailPage — People tab remove / leave (I)', () => {
  const openPeople = () =>
    fireEvent.click(screen.getByTestId('event-tab-people'))

  it('gives a manager a Remove action for a non-host participant', () => {
    participantsState.list = [
      { userId: 'me', name: 'Me', accessTier: 'host', rsvp: 'going' },
      { userId: 'u2', name: 'Tomás', accessTier: 'guest', rsvp: 'going' },
    ]
    render(<EventDetailContent eventId="ev1" />)
    openPeople()
    fireEvent.click(screen.getByTestId('event-person-actions-u2'))
    expect(screen.getByTestId('event-person-remove-u2')).toBeInTheDocument()
  })

  it('never offers a remove/leave action on the host row', () => {
    participantsState.list = [
      { userId: 'me', name: 'Me', accessTier: 'host', rsvp: 'going' },
      { userId: 'u2', name: 'Tomás', accessTier: 'guest', rsvp: 'going' },
    ]
    render(<EventDetailContent eventId="ev1" />)
    openPeople()
    // The host is the current user here → no kebab at all on their own row.
    expect(screen.queryByTestId('event-person-actions-me')).toBeNull()
  })

  it('confirms then calls removeParticipant for the target', async () => {
    participantsState.list = [
      { userId: 'me', name: 'Me', accessTier: 'host', rsvp: 'going' },
      { userId: 'u2', name: 'Tomás', accessTier: 'guest', rsvp: 'going' },
    ]
    render(<EventDetailContent eventId="ev1" />)
    openPeople()
    fireEvent.click(screen.getByTestId('event-person-actions-u2'))
    fireEvent.click(screen.getByTestId('event-person-remove-u2'))
    fireEvent.click(await screen.findByTestId('confirm-dialog-confirm'))
    await waitFor(() => expect(removeParticipant).toHaveBeenCalledWith('u2'))
  })

  it('shows a Leave action for a non-host current user (guest view)', () => {
    detail.isManager = false
    detail.event = { ...baseEvent, hostUserId: 'host' }
    participantsState.list = [
      { userId: 'host', name: 'Host', accessTier: 'host', rsvp: 'going' },
      { userId: 'me', name: 'Me', accessTier: 'guest', rsvp: 'going' },
    ]
    render(<EventDetailContent eventId="ev1" />)
    openPeople()
    fireEvent.click(screen.getByTestId('event-person-actions-me'))
    expect(screen.getByTestId('event-person-leave-me')).toBeInTheDocument()
    // A guest can't remove other people.
    expect(screen.queryByTestId('event-person-actions-host')).toBeNull()
  })

  it('leaves and navigates away after confirming', async () => {
    detail.isManager = false
    detail.event = { ...baseEvent, hostUserId: 'host' }
    participantsState.list = [
      { userId: 'host', name: 'Host', accessTier: 'host', rsvp: 'going' },
      { userId: 'me', name: 'Me', accessTier: 'guest', rsvp: 'going' },
    ]
    render(<EventDetailContent eventId="ev1" />)
    openPeople()
    fireEvent.click(screen.getByTestId('event-person-actions-me'))
    fireEvent.click(screen.getByTestId('event-person-leave-me'))
    fireEvent.click(await screen.findByTestId('confirm-dialog-confirm'))
    await waitFor(() => expect(leaveEvent).toHaveBeenCalled())
    expect(navigate).toHaveBeenCalledWith('/calendar?filter=events')
  })
})

describe('EventDetailPage — Cancel event lives in the Access tab (6g)', () => {
  const openAccess = () =>
    fireEvent.click(screen.getByTestId('event-tab-access'))

  it('confirms then calls cancelEvent from the Access tab', async () => {
    render(<EventDetailContent eventId="ev1" />)
    openAccess()
    fireEvent.click(screen.getByTestId('event-cancel-button'))
    fireEvent.click(await screen.findByTestId('confirm-dialog-confirm'))
    await waitFor(() => expect(cancelEvent).toHaveBeenCalled())
    expect(showToast).toHaveBeenCalledWith('Event cancelled', 'success')
  })

  it('hides the Cancel button once the event is cancelled', () => {
    detail.event = { ...baseEvent, status: 'cancelled' }
    render(<EventDetailContent eventId="ev1" />)
    openAccess()
    expect(screen.queryByTestId('event-cancel-button')).toBeNull()
  })
})

describe('EventDetailPage — list/grid toggle moved to the Lineup tab (6g)', () => {
  it('shows the toggle beside Add song on the Lineup tab (not a header row)', () => {
    detail.lineup = [
      {
        id: 'li1',
        position: 1,
        source: 'external',
        displayTitle: 'Creep',
        displayArtist: 'Radiohead',
      },
    ]
    render(<EventDetailContent eventId="ev1" />)
    // The old header cast-progress row is gone.
    expect(screen.queryByTestId('event-cast-progress')).toBeNull()
    // The toggle is present on the (default) Lineup tab.
    expect(screen.getByTestId('cast-view-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('cast-view-list')).toBeInTheDocument()
    expect(screen.getByTestId('cast-view-grid')).toBeInTheDocument()
  })

  it('does not render the toggle on the Requests tab', () => {
    detail.lineup = [
      {
        id: 'li1',
        position: 1,
        source: 'external',
        displayTitle: 'Creep',
        displayArtist: 'Radiohead',
      },
    ]
    render(<EventDetailContent eventId="ev1" />)
    fireEvent.click(screen.getByTestId('event-tab-requests'))
    expect(screen.queryByTestId('cast-view-toggle')).toBeNull()
  })
})

describe('EventDetailPage — tuning + key thread through Add song (6g)', () => {
  it('passes the selected tuning name + key to addLineupItem', async () => {
    render(<EventDetailContent eventId="ev1" />)
    fireEvent.change(screen.getByTestId('event-add-song-title'), {
      target: { value: 'Creep' },
    })
    fireEvent.change(screen.getByTestId('event-add-song-artist'), {
      target: { value: 'Radiohead' },
    })
    // Tuning via the reused Dropdown picker.
    fireEvent.click(screen.getByTestId('event-add-song-tuning-trigger'))
    fireEvent.click(screen.getByTestId('event-add-song-tuning-option-t-dropd'))
    // Key via the reused Circle of Fifths.
    fireEvent.click(screen.getByTestId('event-add-song-key'))
    fireEvent.click(screen.getByTestId('key-picker-C'))
    fireEvent.click(screen.getByTestId('key-picker-confirm'))
    fireEvent.click(screen.getByTestId('event-add-song-submit'))
    await waitFor(() => expect(addLineupItem).toHaveBeenCalledOnce())
    expect(addLineupItem).toHaveBeenCalledWith({
      title: 'Creep',
      artist: 'Radiohead',
      tuning: 'Drop D',
      key: 'C',
    })
  })
})
