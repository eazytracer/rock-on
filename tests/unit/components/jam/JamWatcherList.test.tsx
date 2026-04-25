/**
 * Unit tests for JamWatcherList — the host-side anonymous-viewer roster.
 *
 * Pure render component, so the test surface is just: given an array of
 * watchers, what shows up? Importantly:
 *   - Empty roster collapses (returns null) so the section doesn't reserve
 *     vertical space when nobody is watching.
 *   - Lurkers (empty-string name) render with a placeholder so the host
 *     still sees the audience size, just not a name.
 *   - Each watcher entry has a stable testid (`jam-watcher-<key>`) so E2E
 *     specs can assert on individual rows.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JamWatcherList } from '../../../../src/components/jam/JamWatcherList'
import type { JamWatcher } from '../../../../src/hooks/useJamPresence'

function makeWatcher(overrides: Partial<JamWatcher> = {}): JamWatcher {
  return {
    key: 'key-default',
    name: 'Default',
    joinedAt: 1_000,
    ...overrides,
  }
}

describe('JamWatcherList', () => {
  it('renders nothing when the roster is empty', () => {
    const { container } = render(<JamWatcherList watchers={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('jam-watcher-list')).not.toBeInTheDocument()
  })

  it('renders a watcher with their name', () => {
    render(
      <JamWatcherList
        watchers={[makeWatcher({ key: 'key-alice', name: 'Alice' })]}
      />
    )
    expect(screen.getByTestId('jam-watcher-list')).toBeInTheDocument()
    expect(screen.getByTestId('jam-watcher-key-alice')).toHaveTextContent(
      'Alice'
    )
  })

  it('renders a lurker (empty name) as "Someone watching"', () => {
    // The host still needs to see the audience size — just without a
    // specific name attached. Distinct from "no watchers" (which
    // collapses the whole section) and from a named watcher.
    render(
      <JamWatcherList
        watchers={[makeWatcher({ key: 'key-lurker', name: '' })]}
      />
    )
    expect(screen.getByTestId('jam-watcher-key-lurker')).toHaveTextContent(
      'Someone watching'
    )
  })

  it('renders a watcher with whitespace-only name as a lurker', () => {
    // Whitespace alone is functionally indistinguishable from empty —
    // surface as a lurker rather than rendering a blank line.
    render(
      <JamWatcherList
        watchers={[makeWatcher({ key: 'key-ws', name: '   ' })]}
      />
    )
    expect(screen.getByTestId('jam-watcher-key-ws')).toHaveTextContent(
      'Someone watching'
    )
  })

  it('renders the audience count in the section header', () => {
    render(
      <JamWatcherList
        watchers={[
          makeWatcher({ key: 'k1', name: 'Alice' }),
          makeWatcher({ key: 'k2', name: 'Bob' }),
          makeWatcher({ key: 'k3', name: '' }),
        ]}
      />
    )
    expect(screen.getByTestId('jam-watcher-list')).toHaveTextContent(
      'Watching (3)'
    )
  })

  it('renders watchers in the order they appear in the array', () => {
    // The hook is responsible for sorting (oldest joinedAt first); the
    // component just renders what it's given. This test pins the
    // contract so a future "alphabetical sort" idea inside the
    // component is caught explicitly rather than silently breaking the
    // hook's ordering.
    render(
      <JamWatcherList
        watchers={[
          makeWatcher({ key: 'k1', name: 'Charlie' }),
          makeWatcher({ key: 'k2', name: 'Alice' }),
          makeWatcher({ key: 'k3', name: 'Bob' }),
        ]}
      />
    )
    const items = screen.getAllByText(/^(Alice|Bob|Charlie)$/)
    expect(items.map(el => el.textContent)).toEqual(['Charlie', 'Alice', 'Bob'])
  })
})
