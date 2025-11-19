import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SyncIcon } from '../../../../src/components/sync/SyncIcon'

describe('SyncIcon', () => {
  it('should render synced status with checkmark icon', () => {
    const { container } = render(<SyncIcon status="synced" />)
    const icon = container.querySelector('[data-icon="synced"]')
    expect(icon).toBeTruthy()
    expect(icon?.classList.contains('text-green-500')).toBe(true)
  })

  it('should render syncing status with loading animation', () => {
    const { container } = render(<SyncIcon status="syncing" />)
    const icon = container.querySelector('[data-icon="syncing"]')
    expect(icon).toBeTruthy()
    expect(icon?.classList.contains('text-blue-500')).toBe(true)
    expect(icon?.classList.contains('animate-spin')).toBe(true)
  })

  it('should render pending status with clock icon', () => {
    const { container } = render(<SyncIcon status="pending" />)
    const icon = container.querySelector('[data-icon="pending"]')
    expect(icon).toBeTruthy()
    expect(icon?.classList.contains('text-yellow-500')).toBe(true)
  })

  it('should render error status with X icon', () => {
    const { container } = render(<SyncIcon status="error" />)
    const icon = container.querySelector('[data-icon="error"]')
    expect(icon).toBeTruthy()
    expect(icon?.classList.contains('text-red-500')).toBe(true)
  })

  it('should render unread status with badge', () => {
    const { container } = render(<SyncIcon status="unread" />)
    const badge = container.querySelector('[data-testid="unread-badge"]')
    expect(badge).toBeTruthy()
    expect(badge?.className).toContain('bg-blue')
  })

  it('should render small size by default', () => {
    const { container } = render(<SyncIcon status="synced" />)
    const icon = container.querySelector('svg')
    expect(icon?.getAttribute('width')).toBe('16')
    expect(icon?.getAttribute('height')).toBe('16')
  })

  it('should render medium size when specified', () => {
    const { container } = render(<SyncIcon status="synced" size="md" />)
    const icon = container.querySelector('svg')
    expect(icon?.getAttribute('width')).toBe('20')
    expect(icon?.getAttribute('height')).toBe('20')
  })

  it('should have accessible title attribute', () => {
    const { container } = render(<SyncIcon status="synced" />)
    const svg = container.querySelector('svg')
    expect(svg?.querySelector('title')).toBeTruthy()
  })
})
