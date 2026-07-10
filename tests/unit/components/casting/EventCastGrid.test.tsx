import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EventCastGrid } from '../../../../src/components/casting/EventCastGrid'
import type { LineupItem } from '../../../../src/models/Event'

vi.mock('../../../../src/hooks/useCasting', () => ({
  useCasting: () => ({
    defaultParts: [
      { key: 'guitar', label: 'Guitar', sort: 1, isDefaultPart: true },
      { key: 'vox', label: 'Vox', sort: 2, isDefaultPart: true },
    ],
    casting: [],
    loading: false,
    assign: vi.fn(),
    unassign: vi.fn(),
  }),
}))
vi.mock('../../../../src/hooks/useEvents', () => ({
  useEventParticipants: () => ({ participants: [] }),
}))
vi.mock('../../../../src/hooks/useResponsive', () => ({
  useViewport: () => ({ isMobile: false }),
}))
vi.mock('../../../../src/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

const LINEUP: LineupItem[] = [
  {
    id: 'li1',
    position: 1,
    source: 'mine',
    displayTitle: 'Creep',
    displayArtist: 'Radiohead',
  },
]

function renderGrid(over: Partial<Parameters<typeof EventCastGrid>[0]> = {}) {
  return render(
    <EventCastGrid
      eventId="e1"
      lineup={LINEUP}
      hands={[]}
      isManager
      onReorder={vi.fn()}
      {...over}
    />
  )
}

describe('EventCastGrid', () => {
  it('renders instrument columns with an icon above a compact label', () => {
    const grid = renderGrid({ isManager: false, onReorder: undefined })
    expect(screen.getByText('Guitar')).toBeInTheDocument()
    expect(screen.getByText('Vox')).toBeInTheDocument()
    // Header instrument icons are back (svg present).
    expect(grid.container.querySelector('svg')).not.toBeNull()
  })

  it('shows a drag handle per row for a manager with onReorder (2+ songs)', () => {
    // Reorder needs at least two rows to swap, so a single-song lineup has no
    // handle; render two so the grip appears.
    renderGrid({
      lineup: [
        ...LINEUP,
        {
          id: 'li2',
          position: 2,
          source: 'mine',
          displayTitle: 'No Surprises',
          displayArtist: 'Radiohead',
        },
      ],
    })
    expect(screen.getByTestId('cast-grid-drag-li1')).toBeInTheDocument()
    expect(screen.getByTestId('cast-grid-drag-li2')).toBeInTheDocument()
  })

  it('hides the drag handle when onReorder is absent', () => {
    renderGrid({ onReorder: undefined })
    expect(screen.queryByTestId('cast-grid-drag-li1')).toBeNull()
  })

  it('hides the drag handle for a non-manager', () => {
    renderGrid({ isManager: false })
    expect(screen.queryByTestId('cast-grid-drag-li1')).toBeNull()
  })

  it('lets a guest raise a hand by tapping an open cell', () => {
    const onRaiseHand = vi.fn()
    renderGrid({
      isManager: false,
      onReorder: undefined,
      canRaiseHand: true,
      currentUserId: 'u1',
      onRaiseHand,
    })
    const cell = screen.getByTestId('cast-cell-li1-guitar')
    expect(cell.tagName).toBe('BUTTON')
    fireEvent.click(cell)
    expect(onRaiseHand).toHaveBeenCalledWith('li1', 'guitar')
  })

  it('does not make cells interactive for a guest who cannot raise a hand', () => {
    renderGrid({ isManager: false, onReorder: undefined, canRaiseHand: false })
    expect(screen.getByTestId('cast-cell-li1-guitar').tagName).toBe('DIV')
  })

  it('shows a raise-hand hint for guests who can raise a hand', () => {
    renderGrid({ isManager: false, onReorder: undefined, canRaiseHand: true })
    expect(screen.getByTestId('event-cast-grid-hint')).toHaveTextContent(
      'raise your hand'
    )
  })

  it('shows per-song tuning and key in the song column', () => {
    renderGrid({
      lineup: [{ ...LINEUP[0], tuning: 'Drop D', key: 'Am' }],
    })
    expect(screen.getByTestId('cast-grid-tuning-li1')).toHaveTextContent(
      'Drop D'
    )
    expect(screen.getByTestId('cast-grid-key-li1')).toHaveTextContent('Am')
  })
})
