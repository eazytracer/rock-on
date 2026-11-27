import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChordCard } from '../../../../src/components/chart/ChordCard'
import { ChordDiagram } from '../../../../src/components/chart/ChordDiagram'
import { ChordPicker } from '../../../../src/components/chart/ChordPicker'
import { ChordLookup } from '../../../../src/components/tools/ChordLookup'
import { chordShape } from '../../../../src/domain/chords'

describe('ChordDiagram', () => {
  it('draws muted, open, fretted strings and the nut for an open shape', () => {
    const { container } = render(
      <ChordDiagram shape={chordShape('C')} label="C" />
    )
    const svg = screen.getByRole('img', { name: 'C chord diagram' })
    expect(svg).toBeInTheDocument()
    expect(
      within(svg as unknown as HTMLElement).getAllByText('×')
    ).toHaveLength(1)
    // 2 open circles + 3 dots.
    expect(container.querySelectorAll('circle')).toHaveLength(5)
    expect(container.querySelector('rect')).toBeNull()
    expect(container.querySelector('line[stroke-width="5"]')).not.toBeNull()
    expect(screen.queryByText(/fr$/)).toBeNull()
  })
  it('draws a barre and the base fret above the nut', () => {
    const { container } = render(
      <ChordDiagram shape={chordShape('Gm')} label="Gm" />
    )
    expect(container.querySelector('rect')).not.toBeNull()
    expect(screen.getByText('3fr')).toBeInTheDocument()
    expect(container.querySelector('line[stroke-width="5"]')).toBeNull()
    // Barre across all six at 3; dots on the two at 5.
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })
  it('says so when there is no shape', () => {
    render(<ChordDiagram shape={null} label="Cdim" />)
    expect(screen.getByText('No diagram yet')).toBeInTheDocument()
  })
})

describe('ChordCard', () => {
  it('shows the name with glyphs, the fingering and plays the shape', async () => {
    const onPlay = vi.fn()
    render(<ChordCard chord="C" onPlay={onPlay} />)
    expect(screen.getByTestId('chord-card-name')).toHaveTextContent('C')
    expect(screen.getByTestId('chord-card-fingering')).toHaveTextContent(
      'x 3 2 0 1 0'
    )
    await userEvent.click(screen.getByTestId('chord-play'))
    expect(onPlay).toHaveBeenCalledWith([48, 52, 55, 60, 64])
  })
  it('still plays a chord without a diagram', async () => {
    const onPlay = vi.fn()
    render(<ChordCard chord="Bbdim" onPlay={onPlay} />)
    expect(screen.getByTestId('chord-card-name')).toHaveTextContent('B♭dim')
    expect(screen.getByText('No diagram yet')).toBeInTheDocument()
    expect(screen.queryByTestId('chord-card-fingering')).toBeNull()
    await userEvent.click(screen.getByTestId('chord-play'))
    expect(onPlay.mock.calls[0][0].length).toBeGreaterThanOrEqual(3)
  })
  it('renders the viewer stepping and slots when asked', async () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(
      <ChordCard
        chord="G"
        onPlay={() => {}}
        onPrev={onPrev}
        onNext={onNext}
        header={<small>CHORD 1 OF 3</small>}
      >
        <span>chips</span>
      </ChordCard>
    )
    expect(screen.getByText('CHORD 1 OF 3')).toBeInTheDocument()
    expect(screen.getByText('chips')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('chord-viewer-prev'))
    await userEvent.click(screen.getByTestId('chord-viewer-next'))
    expect(onPrev).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
  })
})

describe('ChordPicker', () => {
  it('builds root → type → bass and returns the name', async () => {
    const onUse = vi.fn()
    render(<ChordPicker onUse={onUse} />)
    expect(screen.getByTestId('chord-picker-use')).toBeDisabled()
    await userEvent.click(screen.getByTestId('chord-picker-root-F'))
    await userEvent.click(screen.getByTestId('chord-picker-quality-maj7'))
    await userEvent.click(screen.getByTestId('chord-picker-bass-A'))
    expect(screen.getByTestId('chord-picker-name')).toHaveTextContent('Fmaj7/A')
    await userEvent.click(screen.getByTestId('chord-picker-use'))
    expect(onUse).toHaveBeenCalledWith('Fmaj7/A')
  })
  it('starts from a chord, maj clears the type, — clears the bass', async () => {
    const onUse = vi.fn()
    render(<ChordPicker initial="Bbm7/F" onUse={onUse} />)
    expect(screen.getByTestId('chord-picker-root-Bb')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByTestId('chord-picker-quality-maj'))
    await userEvent.click(screen.getByTestId('chord-picker-bass-none'))
    expect(screen.getByTestId('chord-picker-name')).toHaveTextContent('B♭')
    await userEvent.click(screen.getByTestId('chord-picker-use'))
    expect(onUse).toHaveBeenCalledWith('Bb')
  })
  it('accepts typed text and tidies it', async () => {
    const onUse = vi.fn()
    render(<ChordPicker onUse={onUse} />)
    await userEvent.click(screen.getByTestId('chord-picker-mode'))
    const input = screen.getByTestId('chord-picker-text-input')
    await userEvent.type(input, 'nope')
    expect(screen.getByTestId('chord-picker-use')).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, 'f#M7/a{Enter}')
    expect(onUse).toHaveBeenCalledWith('F#maj7/A')
  })
})

describe('ChordLookup', () => {
  it('changes root and quality and shows the card', async () => {
    const onChange = vi.fn()
    render(<ChordLookup chord="G" onChange={onChange} onPlay={() => {}} />)
    expect(screen.getByTestId('chords-root-G')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByTestId('chords-quality-major')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByTestId('chords-root-Bb'))
    expect(onChange).toHaveBeenLastCalledWith('Bb')
    await userEvent.click(screen.getByTestId('chords-quality-m7'))
    expect(onChange).toHaveBeenLastCalledWith('Gm7')
    expect(screen.getByTestId('chord-card')).toHaveTextContent('Play G')
  })
})
