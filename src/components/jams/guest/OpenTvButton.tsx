/**
 * Show on TV: opens the bar TV (`/j/CODE/tv`) in a new tab, for a cast or a
 * browser on the bar's screen. `variant="item"` for a ⋯ menu.
 */
import React from 'react'
import { Tv } from 'lucide-react'
import { Button, SheetItem } from '../../ui'
import { tvPath } from './helpers'

export const OpenTvButton: React.FC<{
  code: string
  variant?: 'item' | 'button'
  onOpened?: () => void
}> = ({ code, variant = 'button', onOpened }) => {
  const open = () => {
    window.open(tvPath(code), '_blank', 'noopener')
    onOpened?.()
  }
  return variant === 'item' ? (
    <SheetItem
      icon={<Tv />}
      label="Show on TV"
      hint="New tab"
      onClick={open}
      data-testid="jam-open-tv"
    />
  ) : (
    <Button icon={<Tv size={18} />} onClick={open} data-testid="jam-open-tv">
      Show on TV
    </Button>
  )
}

export default OpenTvButton
