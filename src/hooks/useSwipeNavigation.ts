import { useGesture } from '@use-gesture/react'
import { useRef, useState, useCallback } from 'react'

export interface SwipeNavigationOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number
  velocity?: number
  enableHaptics?: boolean
}

export interface SwipeState {
  isSwipeActive: boolean
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null
  swipeProgress: number
}

export function useSwipeNavigation(options: SwipeNavigationOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocity = 0.5,
    enableHaptics = true,
  } = options

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwipeActive: false,
    swipeDirection: null,
    swipeProgress: 0,
  })

  const elementRef = useRef<HTMLElement>(null)

  const triggerHapticFeedback = useCallback(() => {
    if (enableHaptics && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }, [enableHaptics])

  const resetSwipeState = useCallback(() => {
    setSwipeState({
      isSwipeActive: false,
      swipeDirection: null,
      swipeProgress: 0,
    })
  }, [])

  const bind = useGesture(
    {
      onDrag: ({
        movement: [mx, my],
        velocity: [vx, vy],
        cancel,
        canceled,
      }) => {
        if (canceled) {
          resetSwipeState()
          return
        }

        const absMx = Math.abs(mx)
        const absMy = Math.abs(my)
        const absVx = Math.abs(vx)
        const absVy = Math.abs(vy)

        // Determine if this is a horizontal or vertical swipe
        const isHorizontal = absMx > absMy
        const isVertical = absMy > absMx

        if (isHorizontal) {
          const progress = Math.min(absMx / threshold, 1)
          const direction = mx > 0 ? 'right' : 'left'

          setSwipeState({
            isSwipeActive: absMx > 10,
            swipeDirection: direction,
            swipeProgress: progress,
          })

          // Trigger swipe action if threshold or velocity is met
          if ((absMx > threshold || absVx > velocity) && progress > 0.5) {
            if (direction === 'left' && onSwipeLeft) {
              triggerHapticFeedback()
              onSwipeLeft()
              cancel()
            } else if (direction === 'right' && onSwipeRight) {
              triggerHapticFeedback()
              onSwipeRight()
              cancel()
            }
          }
        } else if (isVertical) {
          const progress = Math.min(absMy / threshold, 1)
          const direction = my > 0 ? 'down' : 'up'

          setSwipeState({
            isSwipeActive: absMy > 10,
            swipeDirection: direction,
            swipeProgress: progress,
          })

          // Trigger swipe action if threshold or velocity is met
          if ((absMy > threshold || absVy > velocity) && progress > 0.5) {
            if (direction === 'up' && onSwipeUp) {
              triggerHapticFeedback()
              onSwipeUp()
              cancel()
            } else if (direction === 'down' && onSwipeDown) {
              triggerHapticFeedback()
              onSwipeDown()
              cancel()
            }
          }
        }
      },
      onDragEnd: () => {
        resetSwipeState()
      },
    },
    {
      drag: {
        filterTaps: true,
        rubberband: true,
        axis: undefined, // Allow both directions
        threshold: 5,
      },
    }
  )

  return {
    bind,
    swipeState,
    ref: elementRef,
  }
}

// Specialized hook for horizontal navigation (e.g., between songs)
export function useHorizontalSwipe(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  options: Omit<
    SwipeNavigationOptions,
    'onSwipeLeft' | 'onSwipeRight' | 'onSwipeUp' | 'onSwipeDown'
  > = {}
) {
  return useSwipeNavigation({
    ...options,
    onSwipeLeft,
    onSwipeRight,
  })
}

// Specialized hook for vertical navigation (e.g., scrolling through lists)
export function useVerticalSwipe(
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  options: Omit<
    SwipeNavigationOptions,
    'onSwipeLeft' | 'onSwipeRight' | 'onSwipeUp' | 'onSwipeDown'
  > = {}
) {
  return useSwipeNavigation({
    ...options,
    onSwipeUp,
    onSwipeDown,
  })
}

// Hook for pagination with swipe
export function useSwipePagination(
  currentPage: number,
  totalPages: number,
  onPageChange: (page: number) => void,
  options: Omit<SwipeNavigationOptions, 'onSwipeLeft' | 'onSwipeRight'> = {}
) {
  const onSwipeLeft = useCallback(() => {
    if (currentPage < totalPages - 1) {
      onPageChange(currentPage + 1)
    }
  }, [currentPage, totalPages, onPageChange])

  const onSwipeRight = useCallback(() => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1)
    }
  }, [currentPage, onPageChange])

  return useHorizontalSwipe(onSwipeLeft, onSwipeRight, options)
}
