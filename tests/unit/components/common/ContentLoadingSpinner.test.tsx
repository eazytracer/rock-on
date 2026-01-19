import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ContentLoadingSpinner } from '../../../../src/components/common/ContentLoadingSpinner'

describe('ContentLoadingSpinner', () => {
  describe('Loading State', () => {
    it('shows content-loading-spinner when isLoading is true', () => {
      render(
        <ContentLoadingSpinner isLoading={true}>
          <div data-testid="child-content">Child Content</div>
        </ContentLoadingSpinner>
      )

      expect(screen.getByTestId('content-loading-spinner')).toBeInTheDocument()
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
    })

    it('has dark theme background when loading', () => {
      render(
        <ContentLoadingSpinner isLoading={true}>
          <div>Child Content</div>
        </ContentLoadingSpinner>
      )

      const spinner = screen.getByTestId('content-loading-spinner')
      // Check that the spinner has the dark background class
      expect(spinner.className).toContain('bg-[#0a0a0a]')
    })
  })

  describe('Loaded State', () => {
    it('renders children when isLoading is false', () => {
      render(
        <ContentLoadingSpinner isLoading={false}>
          <div data-testid="child-content">Child Content</div>
        </ContentLoadingSpinner>
      )

      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      expect(
        screen.queryByTestId('content-loading-spinner')
      ).not.toBeInTheDocument()
    })
  })
})
