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

  it('summarises all-open parts for a host as "Cast N open parts"', () => {
    renderCard()
    expect(screen.getByTestId('lineup-card-li1')).toHaveTextContent(
      'Cast 3 open parts'
    )
    // Each part chip is in the open state.
    for (const k of ['guitar', 'bass', 'drums']) {
      expect(screen.getByTestId(`card-part-li1-${k}`)).toHaveAttribute(
        'data-state',
        'open'
      )
    }
  })

  it('drops "Cast " prefix for a guest and pluralises correctly', () => {
    renderCard({
      isManager: false,
      casting: [cast('guitar', 'Dave'), cast('bass', 'Mo')],
    })
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveTextContent('1 open part')
    expect(card).not.toHaveTextContent('Cast 1 open part')
  })

  it('marks a cast part and a hand-up part distinctly', () => {
    renderCard({ casting: [cast('guitar', 'Dave R.')], hands: [hand('bass')] })
    expect(screen.getByTestId('card-part-li1-guitar')).toHaveAttribute(
      'data-state',
      'cast'
    )
    const bass = screen.getByTestId('card-part-li1-bass')
    expect(bass).toHaveAttribute('data-state', 'hand')
    expect(bass).toHaveTextContent('1')
    // Footer surfaces the raised-hand tally.
    expect(screen.getByTestId('lineup-card-li1')).toHaveTextContent('1 up')
  })

  it('shows "Fully cast" when every part has a primary', () => {
    renderCard({
      casting: [cast('guitar', 'A'), cast('bass', 'B'), cast('drums', 'C')],
    })
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveTextContent('Fully cast')
    expect(card).not.toHaveTextContent('open part')
  })

  it('fires onSelect when clicked and reflects the selected state', () => {
    const { onSelect } = renderCard({ selected: true })
    const card = screen.getByTestId('lineup-card-li1')
    expect(card).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledOnce()
  })
})
