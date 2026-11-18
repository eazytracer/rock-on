import { useEffect } from 'react'

/**
 * Keeps the screen on while mounted (stage screens: the practice session, the
 * chart reader). Re-acquired when the tab comes back; fails silently where the
 * Screen Wake Lock API is missing.
 */
export function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> }
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<Sentinel> }
    }
    let lock: Sentinel | null = null
    const take = () => {
      if (document.visibilityState !== 'visible' || !nav.wakeLock) return
      nav.wakeLock
        .request('screen')
        .then(l => (lock = l))
        .catch(() => {})
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      document.removeEventListener('visibilitychange', take)
      void lock?.release().catch(() => {})
    }
  }, [])
}
