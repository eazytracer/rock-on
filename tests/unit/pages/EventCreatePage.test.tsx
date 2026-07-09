import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  createEvent: vi.fn(() => Promise.resolve<string | null>('new-id')),
  showToast: vi.fn(),
  navigate: vi.fn(),
}))
const { createEvent, showToast, navigate } = m

vi.mock('react-router-dom', () => ({
  useNavigate: () => m.navigate,
}))
vi.mock('../../../src/services/EventService', () => ({
  EventService: {
    createEvent: m.createEvent,
  },
}))
vi.mock('../../../src/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: m.showToast }),
}))
vi.mock('../../../src/hooks/useGoBack', () => ({ useGoBack: () => vi.fn() }))

import { EventCreatePage } from '../../../src/pages/EventCreatePage'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EventCreatePage — create-only', () => {
  it('combines date + the default 7:00 PM time into scheduledDate', async () => {
    render(<EventCreatePage />)
    fireEvent.change(screen.getByTestId('event-create-name'), {
      target: { value: 'Backyard Jam' },
    })
    fireEvent.click(screen.getByTestId('event-create-submit'))
    await waitFor(() => expect(createEvent).toHaveBeenCalledOnce())
    const arg = createEvent.mock.calls[0][0] as {
      name: string
      scheduledDate: Date
    }
    expect(arg.name).toBe('Backyard Jam')
    // Default start time is 7:00 PM → 19:00 local, carried on the date.
    expect(arg.scheduledDate.getHours()).toBe(19)
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/events/new-id', {
        replace: true,
      })
    )
  })

  it('renders the create heading and CTA (no edit mode)', () => {
    render(<EventCreatePage />)
    expect(screen.getByText('Host an event')).toBeInTheDocument()
    expect(screen.getByTestId('event-create-submit')).toHaveTextContent(
      'Create event'
    )
  })

  it('carries an optional end time into createEvent', async () => {
    render(<EventCreatePage />)
    fireEvent.change(screen.getByTestId('event-create-name'), {
      target: { value: 'Backyard Jam' },
    })
    fireEvent.click(screen.getByTestId('event-create-submit'))
    await waitFor(() => expect(createEvent).toHaveBeenCalledOnce())
    // No end time entered → endTime is undefined by default.
    const arg = createEvent.mock.calls[0][0] as { endTime?: Date }
    expect(arg.endTime).toBeUndefined()
  })
})
