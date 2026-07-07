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
      isManager
      selected={false}
      sourcePill={{ tone: 'accent', label: 'Mine' }}
      onSelect={onSelect}
      {...over}
    />
  )
  return { onSelect }
}

describe('LineupCard', () => {
  it('renders the song, artist, and source pill', () => {
    renderCard()
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveTextContent('Seven Nation Army')
    expect(card).toHaveTextContent('The White Stripes')
    expect(screen.getByTestId('lineup-source-li1')).toHaveTextContent('Mine')
  })

  it('summarises all-open parts for a host as "Cast N open parts" with a 0/N pill', () => {
    renderCard()
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveTextContent('Cast 3 open parts')
    expect(screen.getByTestId('lineup-cast-count-li1')).toHaveTextContent('0/3')
  })

  it('drops "Cast " prefix for a guest and pluralises correctly', () => {
    renderCard({
      isManager: false,
      casting: [cast('guitar', 'Dave'), cast('bass', 'Mo')],
    })
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveTextContent('1 open part')
    expect(card).not.toHaveTextContent('Cast 1 open part')
    expect(screen.getByTestId('lineup-cast-count-li1')).toHaveTextContent('2/3')
  })

  it('surfaces the raised-hand tally as a chip', () => {
    renderCard({ casting: [cast('guitar', 'Dave R.')], hands: [hand('bass')] })
    expect(screen.getByTestId('lineup-cast-count-li1')).toHaveTextContent('1/3')
    expect(screen.getByTestId('lineup-hands-li1')).toHaveTextContent('1')
  })

  it('shows "Fully cast" (and no hands chip) when every part has a primary', () => {
    renderCard({
      casting: [cast('guitar', 'A'), cast('bass', 'B'), cast('drums', 'C')],
    })
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveTextContent('Fully cast')
    expect(card).not.toHaveTextContent('open part')
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
})
