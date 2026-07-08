import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Avatar } from '../../../../src/components/common/Avatar'
import {
  generateAvatarColor,
  generateInitials,
} from '../../../../src/utils/songAvatar'

describe('Avatar', () => {
  it('derives initials and a deterministic color from label', () => {
    render(<Avatar label="Eric Johnson" data-testid="av" />)
    const el = screen.getByTestId('av')
    expect(el).toHaveTextContent(generateInitials('Eric Johnson'))
    expect(el).toHaveStyle({
      backgroundColor: generateAvatarColor('Eric Johnson'),
    })
  })

  it('uses colorSeed for the color hash when provided', () => {
    render(<Avatar label="All Star" colorSeed="All Star" data-testid="av" />)
    expect(screen.getByTestId('av')).toHaveStyle({
      backgroundColor: generateAvatarColor('All Star'),
    })
  })

  it('honors explicit color and initials over derivation', () => {
    render(
      <Avatar label="ignored" color="#123456" initials="ZZ" data-testid="av" />
    )
    const el = screen.getByTestId('av')
    expect(el).toHaveTextContent('ZZ')
    expect(el).toHaveStyle({ backgroundColor: '#123456' })
  })

  it('renders a photo background and no initials when photo is given', () => {
    render(
      <Avatar label="Mike" photo="https://example.com/m.jpg" data-testid="av" />
    )
    const el = screen.getByTestId('av')
    expect(el).toHaveTextContent('')
    expect(el.getAttribute('style')).toContain('example.com/m.jpg')
  })

  it('is deterministic — same seed yields same color', () => {
    expect(generateAvatarColor('Sarah Chen')).toBe(
      generateAvatarColor('Sarah Chen')
    )
  })
})
