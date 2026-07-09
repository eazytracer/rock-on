import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BackLink } from '../../../../src/components/common/BackLink'

// Mock react-router's useNavigate so we can assert navigate(-1) calls.
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock useGoBack so we can assert it is used (with its fallback) when `to` is set.
const mockGoBack = vi.fn()
vi.mock('../../../../src/hooks/useGoBack', () => ({
  useGoBack: (fallback: string) => {
    mockUseGoBackArg(fallback)
    return mockGoBack
  },
}))
const mockUseGoBackArg = vi.fn()

const renderBackLink = (props: React.ComponentProps<typeof BackLink> = {}) =>
  render(
    <MemoryRouter>
      <BackLink {...props} />
    </MemoryRouter>
  )

describe('BackLink', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockGoBack.mockClear()
    mockUseGoBackArg.mockClear()
  })

  it('renders "Back" with no label', () => {
    renderBackLink()
    const btn = screen.getByTestId('back-link')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Back')
    expect(btn).not.toHaveTextContent('Back to')
  })

  it('renders "Back to Setlists" when label is provided', () => {
    renderBackLink({ label: 'Setlists' })
    expect(screen.getByTestId('back-link')).toHaveTextContent(
      'Back to Setlists'
    )
  })

  it('applies a passed className alongside the base classes', () => {
    renderBackLink({ className: 'mb-4' })
    const btn = screen.getByTestId('back-link')
    expect(btn.className).toContain('mb-4')
    expect(btn.className).toContain('inline-flex')
  })

  it('supports a custom data-testid', () => {
    renderBackLink({ 'data-testid': 'event-back' })
    expect(screen.getByTestId('event-back')).toBeInTheDocument()
  })

  it('navigates via useGoBack (with `to` as fallback) when `to` is provided', () => {
    renderBackLink({ to: '/calendar?filter=events' })
    expect(mockUseGoBackArg).toHaveBeenCalledWith('/calendar?filter=events')
    fireEvent.click(screen.getByTestId('back-link'))
    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('calls navigate(-1) when `to` is omitted', () => {
    renderBackLink()
    fireEvent.click(screen.getByTestId('back-link'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
