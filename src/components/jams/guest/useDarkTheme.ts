import { useEffect } from 'react'

/** The TV and the kiosk are dark always: force it while mounted. */
export function useDarkTheme() {
  useEffect(() => {
    const root = document.documentElement
    const was = root.dataset.theme
    root.dataset.theme = 'dark'
    return () => {
      if (was) root.dataset.theme = was
    }
  }, [])
}
