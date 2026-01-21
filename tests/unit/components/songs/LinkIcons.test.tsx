import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkIcons, LinkIcon } from '../../../../src/components/songs/LinkIcons'
import type { ReferenceLink } from '../../../../src/types'

describe('LinkIcons', () => {
  describe('rendering', () => {
    it('should render nothing when links array is empty', () => {
      const { container } = render(<LinkIcons links={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render icons for each link', () => {
      const links: ReferenceLink[] = [
        { icon: 'spotify', url: 'https://spotify.com/track/1' },
        { icon: 'youtube', url: 'https://youtube.com/watch?v=1' },
      ]

      render(<LinkIcons links={links} />)

      const linkElements = screen.getAllByRole('link')
      expect(linkElements).toHaveLength(2)
    })

    it('should render all link types correctly', () => {
      const links: ReferenceLink[] = [
        { icon: 'spotify', url: 'https://spotify.com/1' },
        { icon: 'youtube', url: 'https://youtube.com/1' },
        { icon: 'tabs', url: 'https://tabs.com/1' },
        { icon: 'lyrics', url: 'https://lyrics.com/1' },
        { icon: 'other', url: 'https://example.com/1' },
      ]

      render(<LinkIcons links={links} maxVisible={5} />)

      const linkElements = screen.getAllByRole('link')
      expect(linkElements).toHaveLength(5)
    })
  })

  describe('link behavior', () => {
    it('should set href to link URL', () => {
      const links: ReferenceLink[] = [
        {
          type: 'spotify',
          url: 'https://open.spotify.com/track/test123',
        },
      ]

      render(<LinkIcons links={links} />)

      const linkElement = screen.getByRole('link')
      expect(linkElement).toHaveAttribute(
        'href',
        'https://open.spotify.com/track/test123'
      )
    })

    it('should open links in new tab', () => {
      const links: ReferenceLink[] = [
        { icon: 'spotify', url: 'https://spotify.com/1' },
      ]

      render(<LinkIcons links={links} />)

      const linkElement = screen.getByRole('link')
      expect(linkElement).toHaveAttribute('target', '_blank')
      expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  describe('tooltips', () => {
    it('should show description in title if provided', () => {
      const links: ReferenceLink[] = [
        {
          type: 'spotify',
          url: 'https://spotify.com/1',
          description: 'Listen on Spotify',
        },
      ]

      render(<LinkIcons links={links} />)

      const linkElement = screen.getByRole('link')
      expect(linkElement).toHaveAttribute('title', 'Listen on Spotify')
    })

    it('should show type name in title if no description', () => {
      const links: ReferenceLink[] = [
        { icon: 'youtube', url: 'https://youtube.com/1' },
      ]

      render(<LinkIcons links={links} />)

      const linkElement = screen.getByRole('link')
      expect(linkElement).toHaveAttribute('title', 'YouTube')
    })
  })

  describe('sizes', () => {
    it('should apply small size styles by default', () => {
      const links: ReferenceLink[] = [
        { icon: 'spotify', url: 'https://spotify.com/1' },
      ]

      render(<LinkIcons links={links} />)

      const linkElement = screen.getByRole('link')
      // Small size should have smaller padding and icon size
      expect(linkElement.className).toContain('p-1')
    })

    it('should apply medium size styles when specified', () => {
      const links: ReferenceLink[] = [
        { icon: 'spotify', url: 'https://spotify.com/1' },
      ]

      render(<LinkIcons links={links} size="md" />)

      const linkElement = screen.getByRole('link')
      // Medium size should have larger padding
      expect(linkElement.className).toContain('p-2')
    })
  })

  describe('empty state', () => {
    it('should not show placeholder when showEmpty is false (default)', () => {
      const { container } = render(<LinkIcons links={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should show placeholder when showEmpty is true and no links', () => {
      render(<LinkIcons links={[]} showEmpty />)

      // Should show some placeholder indicator
      const placeholder = screen.getByText('No links')
      expect(placeholder).toBeInTheDocument()
    })
  })

  describe('click prevention', () => {
    it('should stop propagation on click', async () => {
      const user = userEvent.setup()
      const parentClickHandler = vi.fn()
      const links: ReferenceLink[] = [
        { icon: 'spotify', url: 'https://spotify.com/1' },
      ]

      render(
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={parentClickHandler}>
          <LinkIcons links={links} />
        </div>
      )

      const linkElement = screen.getByRole('link')
      await user.click(linkElement)

      // Parent click should not be triggered (would select the song row)
      expect(parentClickHandler).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have accessible name via title', () => {
      const links: ReferenceLink[] = [
        { icon: 'spotify', url: 'https://spotify.com/1' },
      ]

      render(<LinkIcons links={links} />)

      const linkElement = screen.getByRole('link')
      expect(linkElement).toHaveAttribute('title')
    })
  })
})

describe('LinkIcon', () => {
  it('should render the correct icon for spotify type', () => {
    render(<LinkIcon type="spotify" />)

    // Should render without error
    const icon = document.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should render the correct icon for youtube type', () => {
    render(<LinkIcon type="youtube" />)

    const icon = document.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should render the correct icon for tabs type', () => {
    render(<LinkIcon type="tabs" />)

    const icon = document.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should render the correct icon for lyrics type', () => {
    render(<LinkIcon type="lyrics" />)

    const icon = document.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should render the correct icon for other type', () => {
    render(<LinkIcon type="other" />)

    const icon = document.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should apply small size by default', () => {
    render(<LinkIcon type="spotify" />)

    const icon = document.querySelector('svg')
    // Small icons should be 16x16
    expect(icon).toHaveAttribute('width', '16')
    expect(icon).toHaveAttribute('height', '16')
  })

  it('should apply medium size when specified', () => {
    render(<LinkIcon type="spotify" size="md" />)

    const icon = document.querySelector('svg')
    // Medium icons should be 20x20
    expect(icon).toHaveAttribute('width', '20')
    expect(icon).toHaveAttribute('height', '20')
  })

  it('should apply brand color for the type', () => {
    render(<LinkIcon type="spotify" />)

    const icon = document.querySelector('svg')
    // Spotify should have its brand green
    // className.baseVal is used for SVGAnimatedString
    expect(icon?.className.baseVal).toContain('#1DB954')
  })
})
