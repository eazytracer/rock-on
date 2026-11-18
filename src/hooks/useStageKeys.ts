import { useEffect, useRef } from 'react'

/**
 * Keys on stage screens (docs/redesign/12 · 2.5; PLATFORM-NOTES Stage
 * screens): page-turn pedals pair as a keyboard. `keys` maps
 * `KeyboardEvent.key` values to actions (e.g. `ArrowDown`, `PageDown`, `' '`,
 * `Escape`, `n`). Ignored while typing in a field, with a modifier held, or
 * when `enabled` is false (a sheet or layer above has the keys).
 */
export function useStageKeys(
  keys: Partial<Record<string, () => void>>,
  enabled = true
) {
  const ref = useRef(keys)
  ref.current = keys
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return
      const run = ref.current[e.key]
      if (!run) return
      e.preventDefault()
      run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

/** Chart reader page keys (decision 5: every arrow, PgUp / PgDn, Space). */
export const NEXT_PAGE_KEYS = ['ArrowDown', 'ArrowRight', 'PageDown', ' ']
export const BACK_PAGE_KEYS = ['ArrowUp', 'ArrowLeft', 'PageUp']
