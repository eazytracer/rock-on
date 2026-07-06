import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Dropdown,
  DropdownGroup,
} from '../../../../src/components/common/Dropdown'

const groups: DropdownGroup[] = [
  {
    label: 'Built-in',
    options: [
      { value: 'standard', label: 'Standard', color: '#60a5fa' },
      { value: 'drop-d', label: 'Drop D', color: '#f97316' },
    ],
  },
  {
    label: 'Your tunings',
    options: [
      { value: 'mine', label: 'My Tuning', tag: 'custom' },
      { value: 'locked', label: 'Locked', disabled: true },
    ],
  },
]

function setup(props: Partial<React.ComponentProps<typeof Dropdown>> = {}) {
  const onChange = vi.fn()
  render(
    <Dropdown
      value={props.value ?? null}
      onChange={props.onChange ?? onChange}
      groups={groups}
      data-testid="dd"
      {...props}
    />
  )
  return { onChange }
}

describe('Dropdown', () => {
  it('shows the placeholder when no value is selected', () => {
    setup({ placeholder: 'Pick one' })
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('shows the selected option label on the trigger', () => {
    setup({ value: 'drop-d' })
    expect(screen.getByTestId('dd-trigger')).toHaveTextContent('Drop D')
  })

  it('opens on trigger click and renders grouped options + eyebrows', () => {
    setup()
    fireEvent.click(screen.getByTestId('dd-trigger'))
    expect(screen.getByTestId('dd-menu')).toBeInTheDocument()
    expect(screen.getByText('Built-in')).toBeInTheDocument()
    expect(screen.getByText('Your tunings')).toBeInTheDocument()
    expect(screen.getByTestId('dd-option-standard')).toBeInTheDocument()
  })

  it('selects an option on click and closes the menu', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByTestId('dd-trigger'))
    fireEvent.click(screen.getByTestId('dd-option-drop-d'))
    expect(onChange).toHaveBeenCalledWith('drop-d')
    expect(screen.queryByTestId('dd-menu')).not.toBeInTheDocument()
  })

  it('marks the active value as aria-selected', () => {
    setup({ value: 'standard' })
    fireEvent.click(screen.getByTestId('dd-trigger'))
    expect(screen.getByTestId('dd-option-standard')).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('does not fire onChange for a disabled option', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByTestId('dd-trigger'))
    fireEvent.click(screen.getByTestId('dd-option-locked'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('dd-menu')).toBeInTheDocument() // stays open
  })

  it('fires a footer action', () => {
    const onNew = vi.fn()
    setup({ footerActions: [{ label: '+ New tuning', onClick: onNew }] })
    fireEvent.click(screen.getByTestId('dd-trigger'))
    fireEvent.click(screen.getByTestId('dd-action-0'))
    expect(onNew).toHaveBeenCalledOnce()
  })

  it('closes on Escape', () => {
    setup()
    const trigger = screen.getByTestId('dd-trigger')
    fireEvent.click(trigger)
    expect(screen.getByTestId('dd-menu')).toBeInTheDocument()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByTestId('dd-menu')).not.toBeInTheDocument()
  })

  it('supports keyboard: ArrowDown then Enter selects', () => {
    const { onChange } = setup()
    const trigger = screen.getByTestId('dd-trigger')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // opens, highlights first (standard)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // → drop-d
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('drop-d')
  })

  it('keyboard navigation skips disabled options', () => {
    const { onChange } = setup()
    const trigger = screen.getByTestId('dd-trigger')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // standard
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // drop-d
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // mine (skips nothing yet)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // would be 'locked' (disabled) → wraps to standard
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('standard')
  })
})
