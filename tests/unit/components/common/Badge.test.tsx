import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '../../../../src/components/common/Badge'
import { BADGE_TONE } from '../../../../src/utils/tokens'

describe('Badge', () => {
  it('renders children with the default testid', () => {
    render(<Badge>Active</Badge>)
    const el = screen.getByTestId('badge')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('Active')
  })

  it('applies the tone color from the token map', () => {
    render(<Badge tone="success">Confirmed</Badge>)
    const el = screen.getByTestId('badge')
    expect(el).toHaveStyle({ color: BADGE_TONE.success.color })
    expect(el).toHaveStyle({ backgroundColor: BADGE_TONE.success.bg })
  })

  it('defaults to the neutral tone', () => {
    render(<Badge>Draft</Badge>)
    expect(screen.getByTestId('badge')).toHaveStyle({
      color: BADGE_TONE.neutral.color,
    })
  })

  it('hides the leading dot when dot={false}', () => {
    const { container } = render(<Badge dot={false}>None</Badge>)
    // Only the text node — no dot span
    const spans = container.querySelectorAll('span')
    expect(spans.length).toBe(1) // the badge root only
  })

  it('honors a custom data-testid', () => {
    render(<Badge data-testid="status-pill">Live</Badge>)
    expect(screen.getByTestId('status-pill')).toBeInTheDocument()
  })
})
