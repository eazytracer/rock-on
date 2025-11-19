import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { OfflineIndicator } from '../../../src/components/sync/OfflineIndicator'

describe('OfflineIndicator', () => {
  let onlineGetter: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Mock navigator.onLine
    onlineGetter = vi.fn()
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: onlineGetter
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Online/Offline Detection', () => {
    it('should not render when online', () => {
      onlineGetter.mockReturnValue(true)
      const { container } = render(<OfflineIndicator />)
      expect(container.firstChild).toBeNull()
    })

    it('should render when offline', () => {
      onlineGetter.mockReturnValue(false)
      render(<OfflineIndicator />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should show when going offline', async () => {
      onlineGetter.mockReturnValue(true)
      render(<OfflineIndicator />)

      // Should not be visible initially
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      // Simulate going offline
      onlineGetter.mockReturnValue(false)
      await act(async () => {
        window.dispatchEvent(new Event('offline'))
      })

      // Should now be visible
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })
    })

    it('should hide when going online', async () => {
      onlineGetter.mockReturnValue(false)
      render(<OfflineIndicator />)

      // Should be visible initially
      expect(screen.getByRole('alert')).toBeInTheDocument()

      // Simulate going online
      onlineGetter.mockReturnValue(true)
      await act(async () => {
        window.dispatchEvent(new Event('online'))
      })

      // Should now be hidden
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      })
    })
  })

  describe('Content and Messaging', () => {
    it('should display offline message', () => {
      onlineGetter.mockReturnValue(false)
      render(<OfflineIndicator />)
      expect(screen.getByText(/you are offline/i)).toBeInTheDocument()
    })

    it('should include warning icon', () => {
      onlineGetter.mockReturnValue(false)
      render(<OfflineIndicator />)
      const alert = screen.getByRole('alert')
      // Check for SVG or icon element
      expect(alert.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have role="alert" for screen readers', () => {
      onlineGetter.mockReturnValue(false)
      render(<OfflineIndicator />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should have aria-live="polite" for non-intrusive announcements', () => {
      onlineGetter.mockReturnValue(false)
      render(<OfflineIndicator />)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Event Listener Cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      onlineGetter.mockReturnValue(true)
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(<OfflineIndicator />)
      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    })
  })
})
