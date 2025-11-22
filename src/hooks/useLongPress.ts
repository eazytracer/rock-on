import { useCallback, useRef, useState } from 'react'
import { useGesture } from '@use-gesture/react'

export interface LongPressOptions {
  threshold?: number // Duration in milliseconds to trigger long press
  onLongPress?: () => void
  onLongPressStart?: () => void
  onLongPressEnd?: () => void
  preventDefault?: boolean
  enableHaptics?: boolean
  visualFeedback?: boolean
}

export interface LongPressState {
  isLongPressing: boolean
  progress: number // 0 to 1, indicates progress to threshold
  startTime: number | null
}

export function useLongPress(options: LongPressOptions = {}) {
  const {
    threshold = 500,
    onLongPress,
    onLongPressStart,
    onLongPressEnd,
    preventDefault = true,
    enableHaptics = true,
    visualFeedback = true,
  } = options

  const [longPressState, setLongPressState] = useState<LongPressState>({
    isLongPressing: false,
    progress: 0,
    startTime: null,
  })

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const elementRef = useRef<HTMLElement>(null)

  const triggerHapticFeedback = useCallback(
    (intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
      if (enableHaptics && 'vibrate' in navigator) {
        const vibrationPattern = {
          light: 10,
          medium: 25,
          heavy: 50,
        }
        navigator.vibrate(vibrationPattern[intensity])
      }
    },
    [enableHaptics]
  )

  const startLongPress = useCallback(() => {
    const startTime = Date.now()

    setLongPressState({
      isLongPressing: true,
      progress: 0,
      startTime,
    })

    onLongPressStart?.()
    triggerHapticFeedback('light')

    // Progress tracking timer
    if (visualFeedback) {
      const updateProgress = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / threshold, 1)

        setLongPressState(prev => ({
          ...prev,
          progress,
        }))

        if (progress < 1) {
          progressTimerRef.current = setTimeout(updateProgress, 16) // ~60fps
        }
      }
      updateProgress()
    }

    // Long press trigger timer
    timerRef.current = setTimeout(() => {
      triggerHapticFeedback('heavy')
      onLongPress?.()

      setLongPressState(prev => ({
        ...prev,
        progress: 1,
      }))
    }, threshold)
  }, [
    threshold,
    onLongPress,
    onLongPressStart,
    triggerHapticFeedback,
    visualFeedback,
  ])

  const cancelLongPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current)
      progressTimerRef.current = null
    }

    const wasLongPressing = longPressState.isLongPressing

    setLongPressState({
      isLongPressing: false,
      progress: 0,
      startTime: null,
    })

    if (wasLongPressing) {
      onLongPressEnd?.()
    }
  }, [longPressState.isLongPressing, onLongPressEnd])

  const bind = useGesture(
    {
      onPointerDown: state => {
        if (preventDefault) {
          state.event.preventDefault()
        }
        startLongPress()
      },
      onPointerUp: () => {
        cancelLongPress()
      },
      onPointerLeave: () => {
        cancelLongPress()
      },
      onPointerCancel: () => {
        cancelLongPress()
      },
      // Handle drag to cancel long press if user moves too far
      onDrag: ({ movement: [mx, my] }) => {
        const distance = Math.sqrt(mx * mx + my * my)
        if (distance > 10) {
          // Cancel if moved more than 10px
          cancelLongPress()
        }
      },
    },
    {
      drag: {
        threshold: 10,
        filterTaps: false,
      },
    }
  )

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current)
    }
  }, [])

  return {
    bind,
    longPressState,
    ref: elementRef,
    cleanup,
  }
}

// Specialized hook for context menus
export function useLongPressContextMenu(
  menuItems: Array<{
    label: string
    action: () => void
    icon?: string
    destructive?: boolean
  }>,
  options: Omit<LongPressOptions, 'onLongPress'> = {}
) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition] = useState({ x: 0, y: 0 })

  const handleLongPress = useCallback(() => {
    setShowMenu(true)
  }, [])

  const handleMenuItemClick = useCallback((action: () => void) => {
    action()
    setShowMenu(false)
  }, [])

  const closeMenu = useCallback(() => {
    setShowMenu(false)
  }, [])

  const longPress = useLongPress({
    ...options,
    onLongPress: handleLongPress,
  })

  return {
    ...longPress,
    showMenu,
    menuItems,
    menuPosition,
    onMenuItemClick: handleMenuItemClick,
    onCloseMenu: closeMenu,
  }
}

// Hook for quick action buttons (like favorite, delete, etc.)
export function useLongPressQuickAction(
  actions: {
    primary: () => void
    secondary?: () => void
  },
  options: Omit<LongPressOptions, 'onLongPress'> = {}
) {
  const [showSecondaryAction, setShowSecondaryAction] = useState(false)

  const handleLongPress = useCallback(() => {
    if (actions.secondary) {
      setShowSecondaryAction(true)
      actions.secondary()
    }
  }, [actions])

  const handleClick = useCallback(() => {
    if (!showSecondaryAction) {
      actions.primary()
    }
    setShowSecondaryAction(false)
  }, [actions, showSecondaryAction])

  const longPress = useLongPress({
    ...options,
    onLongPress: handleLongPress,
    onLongPressEnd: () => {
      setShowSecondaryAction(false)
      options.onLongPressEnd?.()
    },
  })

  return {
    ...longPress,
    onClick: handleClick,
    showSecondaryAction,
  }
}

// Hook for long press with visual progress indicator
export function useLongPressProgress(
  onComplete: () => void,
  options: Omit<LongPressOptions, 'onLongPress' | 'visualFeedback'> = {}
) {
  const longPress = useLongPress({
    ...options,
    onLongPress: onComplete,
    visualFeedback: true,
  })

  const getProgressStyle = useCallback(() => {
    const { progress } = longPress.longPressState
    return {
      background: `conic-gradient(#3b82f6 ${progress * 360}deg, #e5e7eb 0deg)`,
      opacity: longPress.longPressState.isLongPressing ? 1 : 0,
      transition: 'opacity 0.2s ease-in-out',
    }
  }, [longPress.longPressState])

  return {
    ...longPress,
    getProgressStyle,
  }
}
