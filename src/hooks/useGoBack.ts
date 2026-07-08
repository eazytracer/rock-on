import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * History-aware back navigation.
 *
 * If the user reached the current page via in-app navigation (e.g. tapped an
 * item on the Calendar), "back" returns to wherever they actually came from.
 * On a direct load / first history entry (nothing to go back to in-app), it
 * falls back to a sensible route instead of leaving the app.
 *
 * This fixes the "open an event from the Calendar, hit Back, land somewhere
 * else" problem — a hardcoded back path can't know the real referrer; browser
 * history does.
 */
export function useGoBack(fallback = '/calendar'): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    // React Router sets location.key to 'default' only on the very first entry
    // (a direct load). Any other value means there's in-app history to pop.
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      navigate(fallback)
    }
  }, [navigate, location.key, fallback])
}
