import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ScheduleMetaRow } from '../../../../src/components/common/ScheduleMetaRow'

describe('ScheduleMetaRow', () => {
  it('renders date, time, and venue values', () => {
    render(
      <ScheduleMetaRow
        testId="meta"
        date="2026-08-01"
        dateLabel="Aug 1, 2026"
        time="7:00 PM"
        timeLabel="7:00 PM"
        venue="The Garage"
      />
    )
    expect(screen.getByText('Aug 1, 2026')).toBeInTheDocument()
    expect(screen.getByText('7:00 PM')).toBeInTheDocument()
    expect(screen.getByText('The Garage')).toBeInTheDocument()
  })

  it('renders an end-time range when endTime is given', () => {
    render(
      <ScheduleMetaRow
        testId="meta"
        time="7:00 PM"
        timeLabel="7:00 PM"
        endTime="10:00 PM"
        endTimeLabel="10:00 PM"
      />
    )
    expect(screen.getByText('7:00 PM')).toBeInTheDocument()
    expect(screen.getByText('–')).toBeInTheDocument()
    expect(screen.getByText('10:00 PM')).toBeInTheDocument()
  })

  it('renders inline editors only when the matching onSave is supplied', () => {
    render(
      <ScheduleMetaRow
        testId="meta"
        date="2026-08-01"
        dateLabel="Aug 1, 2026"
        onDateSave={vi.fn()}
        time="7:00 PM"
        timeLabel="7:00 PM"
        onTimeSave={vi.fn()}
        venue="The Garage"
        onVenueSave={vi.fn()}
      />
    )
    // InlineEditableField renders a clickable `${testId}-display` node.
    expect(screen.getByTestId('meta-date-display')).toBeInTheDocument()
    expect(screen.getByTestId('meta-time-display')).toBeInTheDocument()
    expect(screen.getByTestId('meta-venue-display')).toBeInTheDocument()
  })

  it('renders static spans (no inline editor) when no onSave is supplied', () => {
    render(
      <ScheduleMetaRow
        testId="meta"
        date="2026-08-01"
        dateLabel="Aug 1, 2026"
        time="7:00 PM"
        timeLabel="7:00 PM"
        venue="The Garage"
      />
    )
    expect(screen.queryByTestId('meta-date-display')).toBeNull()
    expect(screen.queryByTestId('meta-time-display')).toBeNull()
    expect(screen.queryByTestId('meta-venue-display')).toBeNull()
  })

  it('renders an inline end-time editor when onEndTimeSave is supplied', () => {
    render(
      <ScheduleMetaRow
        testId="meta"
        time="7:00 PM"
        timeLabel="7:00 PM"
        endTime="10:00 PM"
        endTimeLabel="10:00 PM"
        onEndTimeSave={vi.fn()}
      />
    )
    expect(screen.getByTestId('meta-end-time-display')).toBeInTheDocument()
  })

  it('renders nothing when no fields are provided', () => {
    const { container } = render(<ScheduleMetaRow testId="meta" />)
    expect(container.firstChild).toBeNull()
  })
})
