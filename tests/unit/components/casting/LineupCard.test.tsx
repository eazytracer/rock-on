import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LineupCard } from '../../../../src/components/casting/LineupCard'
import type {
  BandRole,
  CastingAssignment,
} from '../../../../src/models/Casting'
import type { LineupItem, RaisedHand } from '../../../../src/models/Event'

const PARTS: BandRole[] = [
  { key: 'guitar', label: 'Guitar', sort: 1, isDefaultPart: true },
  { key: 'bass', label: 'Bass', sort: 2, isDefaultPart: true },
  { key: 'drums', label: 'Drums', sort: 3, isDefaultPart: true },
]

const ITEM: LineupItem = {
  id: 'li1',
  position: 1,
  source: 'mine',
  songId: 's1',
  displayTitle: 'Seven Nation Army',
  displayArtist: 'The White Stripes',
}

const cast = (roleKey: string, memberName: string): CastingAssignment =>
  ({
    id: `c-${roleKey}`,
    slotId: 'li1',
    roleKey,
    memberName,
    isPrimary: true,
  }) as CastingAssignment

const hand = (roleKey: string): RaisedHand => ({
  id: `h-${roleKey}`,
  lineupItemId: 'li1',
  roleKey,
  userId: 'u1',
  userName: 'Tomás',
  status: 'raised',
})

function renderCard(over: Partial<Parameters<typeof LineupCard>[0]> = {}) {
  const onSelect = vi.fn()
  render(
    <LineupCard
      item={ITEM}
      defaultParts={PARTS}
      casting={[]}
      hands={[]}
      selected={false}
      onSelect={onSelect}
      {...over}
    />
  )
  return { onSelect }
}

describe('LineupCard', () => {
  it('renders the song and artist inline in one header row', () => {
    renderCard()
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveTextContent('Seven Nation Army')
    expect(card).toHaveTextContent('The White Stripes')
    // Source pills are retired on event surfaces (EC4 #5).
    expect(screen.queryByTestId('lineup-source-li1')).toBeNull()
  })

  it('shows an all-open cast count of 0/N', () => {
    renderCard()
    expect(screen.getByTestId('lineup-cast-count-li1')).toHaveTextContent('0/3')
  })

  it('reflects partial casting in the count (guest view)', () => {
    renderCard({
      casting: [cast('guitar', 'Dave'), cast('bass', 'Mo')],
    })
    expect(screen.getByTestId('lineup-cast-count-li1')).toHaveTextContent('2/3')
  })

  it('surfaces the raised-hand tally as a chip', () => {
    renderCard({ casting: [cast('guitar', 'Dave R.')], hands: [hand('bass')] })
    expect(screen.getByTestId('lineup-cast-count-li1')).toHaveTextContent('1/3')
    expect(screen.getByTestId('lineup-hands-li1')).toHaveTextContent('1')
  })

  it('reads N/N (and shows no hands chip) when every part has a primary', () => {
    renderCard({
      casting: [cast('guitar', 'A'), cast('bass', 'B'), cast('drums', 'C')],
    })
    expect(screen.getByTestId('lineup-cast-count-li1')).toHaveTextContent('3/3')
    expect(screen.queryByTestId('lineup-hands-li1')).toBeNull()
  })

  it('fires onSelect when clicked and reflects the selected state', () => {
    const { onSelect } = renderCard({ selected: true })
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('shows a drag handle only when dragHandleListeners are supplied (G)', () => {
    renderCard()
    expect(screen.queryByTestId('lineup-drag-li1')).toBeNull()
    renderCard({ dragHandleListeners: { onPointerDown: vi.fn() } })
    expect(screen.getByTestId('lineup-drag-li1')).toBeInTheDocument()
  })

  it('shows Edit + Remove actions in the expanded panel when supplied (H)', () => {
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    // Actions live in the expanded card body, so render it selected + open.
    renderCard({
      selected: true,
      children: <div>cast panel</div>,
      actions: [
        {
          label: 'Edit song',
          onClick: onEdit,
          'data-testid': 'lineup-edit-li1',
        },
        {
          label: 'Remove',
          variant: 'danger',
          onClick: onRemove,
          'data-testid': 'lineup-remove-li1',
        },
      ],
    })
    fireEvent.click(screen.getByTestId('lineup-edit-li1'))
    expect(onEdit).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('lineup-remove-li1'))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('renders no manager controls (grip/actions) when none are supplied (guest)', () => {
    renderCard({ selected: true, children: <div>cast panel</div> })
    expect(screen.queryByTestId('lineup-drag-li1')).toBeNull()
    expect(screen.queryByTestId('lineup-edit-li1')).toBeNull()
    expect(screen.queryByTestId('lineup-remove-li1')).toBeNull()
  })

  it('shows "Added by {name}" when an ownerName is supplied (6g)', () => {
    renderCard({ ownerName: 'Tomás' })
    expect(screen.getByTestId('lineup-owner-li1')).toHaveTextContent(
      'Added by Tomás'
    )
  })

  it('omits the added-by line when ownerName is unknown', () => {
    renderCard()
    expect(screen.queryByTestId('lineup-owner-li1')).toBeNull()
  })

  it('displays the per-song tuning (canonical label) + key when present (6g)', () => {
    renderCard({ item: { ...ITEM, tuning: 'Drop D', key: 'Am' } })
    expect(screen.getByTestId('lineup-tuning-li1')).toHaveTextContent('Drop D')
    expect(screen.getByTestId('lineup-key-li1')).toHaveTextContent('Am')
  })

  it('omits tuning/key chips when the item has neither', () => {
    renderCard()
    expect(screen.queryByTestId('lineup-tuning-li1')).toBeNull()
    expect(screen.queryByTestId('lineup-key-li1')).toBeNull()
  })

  it('shows a Casting affordance (people icon + label) by the expand arrow', () => {
    renderCard()
    expect(screen.getByTestId('lineup-casting-li1')).toHaveTextContent(
      'Casting'
    )
  })

  it('highlights the parts the logged-in user is cast on', () => {
    renderCard({
      currentUserId: 'me',
      casting: [
        {
          id: 'c1',
          slotId: 'li1',
          roleKey: 'guitar',
          memberId: 'me',
          memberName: 'Me',
          isPrimary: true,
        } as CastingAssignment,
      ],
    })
    const chip = screen.getByTestId('lineup-you-li1')
    expect(chip).toHaveTextContent('on')
    expect(chip).toHaveTextContent('Guitar')
  })

  it('omits the "You\'re on" chip when the user is cast on nothing', () => {
    renderCard({ currentUserId: 'me' })
    expect(screen.queryByTestId('lineup-you-li1')).toBeNull()
  })
})
