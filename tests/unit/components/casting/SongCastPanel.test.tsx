import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SongCastPanel } from '../../../../src/components/casting/SongCastPanel'
import type {
  BandRole,
  CastingAssignment,
} from '../../../../src/models/Casting'

// ── Hook + service mocks ────────────────────────────────────────────────────
const assign = vi.fn(() => Promise.resolve({ ok: true }))
const unassign = vi.fn()
const update = vi.fn()
const castingState: { casting: CastingAssignment[] } = { casting: [] }

const PARTS: BandRole[] = [
  {
    id: 'default:guitar',
    bandId: '',
    key: 'guitar',
    label: 'Guitar',
    sort: 1,
    isDefaultPart: true,
  },
  {
    id: 'default:bass',
    bandId: '',
    key: 'bass',
    label: 'Bass',
    sort: 2,
    isDefaultPart: true,
  },
]

vi.mock('../../../../src/hooks/useCasting', () => ({
  useCasting: () => ({
    defaultParts: PARTS,
    casting: castingState.casting,
    loading: false,
    assign,
    unassign,
    update,
  }),
}))

vi.mock('../../../../src/hooks/useBands', () => ({
  useBandMembers: () => ({ members: [] }),
}))
vi.mock('../../../../src/hooks/useEvents', () => ({
  useEventParticipants: () => ({ participants: [] }),
}))
vi.mock('../../../../src/services/CastingAssignmentService', () => ({
  CastingAssignmentService: { getSongHistory: () => Promise.resolve([]) },
}))

beforeEach(() => {
  castingState.casting = []
  vi.clearAllMocks()
})

function renderPanel() {
  render(
    <SongCastPanel
      embedded
      contextType="event"
      contextId="ev1"
      bandId={undefined}
      slotId="li1"
      canEdit
    />
  )
}

describe('SongCastPanel write-in (director-cast, no account)', () => {
  it('persists a typed name as memberName with no memberId', async () => {
    renderPanel()
    // Open the assign sheet for Guitar, then type a free-text name.
    fireEvent.click(screen.getByTestId('cast-assign-guitar'))
    fireEvent.change(screen.getByTestId('cast-sheet-freetext-input'), {
      target: { value: '  Jane Doe  ' },
    })
    fireEvent.click(screen.getByTestId('cast-sheet-freetext-add'))

    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    const arg = assign.mock.calls[0][0] as {
      memberName: string
      memberId?: string
      roleKey: string
    }
    expect(arg.memberName).toBe('Jane Doe')
    expect(arg.memberId).toBeUndefined()
    expect(arg.roleKey).toBe('guitar')
  })

  it('does not submit a whitespace-only name', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId('cast-assign-guitar'))
    fireEvent.change(screen.getByTestId('cast-sheet-freetext-input'), {
      target: { value: '   ' },
    })
    const addBtn = screen.getByTestId(
      'cast-sheet-freetext-add'
    ) as HTMLButtonElement
    expect(addBtn.disabled).toBe(true)
    fireEvent.click(addBtn)
    expect(assign).not.toHaveBeenCalled()
  })

  it('displays a write-in assignment by its typed name', () => {
    castingState.casting = [
      {
        id: 'c1',
        contextType: 'event',
        contextId: 'ev1',
        slotId: 'li1',
        roleKey: 'guitar',
        memberName: 'Jane Doe',
        isPrimary: true,
        createdBy: 'me',
        createdDate: new Date(),
      } as CastingAssignment,
    ]
    renderPanel()
    expect(screen.getByTestId('cast-assigned-c1')).toHaveTextContent('Jane Doe')
  })
})
