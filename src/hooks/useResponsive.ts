import { useState, useEffect, useCallback, useMemo } from 'react'

// Tailwind CSS breakpoints
export const BREAKPOINTS = {
  xs: 320,   // Extra small devices
  sm: 640,   // Small devices (landscape phones)
  md: 768,   // Medium devices (tablets)
  lg: 1024,  // Large devices (desktops)
  xl: 1280,  // Extra large devices
  '2xl': 1536 // 2X Extra large devices
} as const

export type Breakpoint = keyof typeof BREAKPOINTS
export type BreakpointValue = typeof BREAKPOINTS[Breakpoint]

export interface ViewportInfo {
  width: number
  height: number
  breakpoint: Breakpoint
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isLandscape: boolean
  isPortrait: boolean
  pixelRatio: number
  isRetina: boolean
}

export interface ResponsiveValue<T> {
  xs?: T
  sm?: T
  md?: T
  lg?: T
  xl?: T
  '2xl'?: T
}

export function useViewport(): ViewportInfo {
  const [viewport, setViewport] = useState<ViewportInfo>(() => {
    if (typeof window === 'undefined') {
      // SSR fallback
      return {
        width: 1024,
        height: 768,
        breakpoint: 'lg' as Breakpoint,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLandscape: true,
        isPortrait: false,
        pixelRatio: 1,
        isRetina: false
      }
    }

    const width = window.innerWidth
    const height = window.innerHeight
    const pixelRatio = window.devicePixelRatio || 1

    return {
      width,
      height,
      breakpoint: getBreakpoint(width),
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isLandscape: width > height,
      isPortrait: height >= width,
      pixelRatio,
      isRetina: pixelRatio > 1
    }
  })

  const updateViewport = useCallback(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    const pixelRatio = window.devicePixelRatio || 1

    setViewport({
      width,
      height,
      breakpoint: getBreakpoint(width),
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isLandscape: width > height,
      isPortrait: height >= width,
      pixelRatio,
      isRetina: pixelRatio > 1
    })
  }, [])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateViewport, 100) // Debounce for performance
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      clearTimeout(timeoutId)
    }
  }, [updateViewport])

  return viewport
}

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['2xl']) return '2xl'
  if (width >= BREAKPOINTS.xl) return 'xl'
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  if (width >= BREAKPOINTS.sm) return 'sm'
  return 'xs'
}

// Hook for responsive values
export function useResponsiveValue<T>(values: ResponsiveValue<T> | T): T {
  const { breakpoint } = useViewport()

  return useMemo(() => {
    if (typeof values !== 'object' || values === null) {
      return values as T
    }

    const responsiveValues = values as ResponsiveValue<T>

    // Find the largest matching breakpoint
    const breakpointOrder: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs']
    const currentBreakpointIndex = breakpointOrder.indexOf(breakpoint)

    for (let i = currentBreakpointIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i]
      if (responsiveValues[bp] !== undefined) {
        return responsiveValues[bp]!
      }
    }

    // Fallback to the smallest defined breakpoint
    for (const bp of breakpointOrder.reverse()) {
      if (responsiveValues[bp] !== undefined) {
        return responsiveValues[bp]!
      }
    }

    throw new Error('No responsive value found')
  }, [values, breakpoint])
}

// Hook for breakpoint matching
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const { width } = useViewport()
  return width >= BREAKPOINTS[breakpoint]
}

// Hook for breakpoint range matching
export function useBreakpointRange(min: Breakpoint, max?: Breakpoint): boolean {
  const { width } = useViewport()
  const minWidth = BREAKPOINTS[min]
  const maxWidth = max ? BREAKPOINTS[max] : Infinity

  return width >= minWidth && width < maxWidth
}

// Hook for mobile-specific features
export function useMobile() {
  const viewport = useViewport()

  return {
    ...viewport,
    isTouchDevice: useMemo(() => {
      if (typeof window === 'undefined') return false
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0
    }, []),
    hasHover: useMemo(() => {
      if (typeof window === 'undefined') return true
      return window.matchMedia('(hover: hover)').matches
    }, []),
    canHover: useMemo(() => {
      if (typeof window === 'undefined') return true
      return window.matchMedia('(any-hover: hover)').matches
    }, []),
    prefersReducedMotion: useMemo(() => {
      if (typeof window === 'undefined') return false
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }, [])
  }
}

// Hook for container queries simulation
export function useContainerSize(containerRef: React.RefObject<HTMLElement>) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContainerSize({ width, height })
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef])

  return containerSize
}

// Hook for media queries
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    setMatches(mediaQuery.matches)

    return () => {
      mediaQuery.removeEventListener('change', handler)
    }
  }, [query])

  return matches
}

// Hook for device orientation
export function useOrientation() {
  type OrientationType = 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary'

  const [orientation, setOrientation] = useState<{
    angle: number
    type: OrientationType
  }>(() => {
    if (typeof window === 'undefined' || !window.screen?.orientation) {
      return { angle: 0, type: 'portrait-primary' }
    }

    return {
      angle: window.screen.orientation.angle,
      type: window.screen.orientation.type as OrientationType
    }
  })

  useEffect(() => {
    const handleOrientationChange = () => {
      if (window.screen?.orientation) {
        setOrientation({
          angle: window.screen.orientation.angle,
          type: window.screen.orientation.type as OrientationType
        })
      }
    }

    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  return orientation
}

// Hook for grid columns based on screen size
export function useResponsiveGrid(
  columns: ResponsiveValue<number> = {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
    '2xl': 6
  }
): number {
  return useResponsiveValue(columns)
}

// Hook for safe area insets (for mobile devices with notches)
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  })

  useEffect(() => {
    const updateSafeArea = () => {
      const computedStyle = getComputedStyle(document.documentElement)

      setSafeArea({
        top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0'),
        right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
        left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0')
      })
    }

    updateSafeArea()

    // Update on viewport changes
    window.addEventListener('resize', updateSafeArea)
    window.addEventListener('orientationchange', updateSafeArea)

    return () => {
      window.removeEventListener('resize', updateSafeArea)
      window.removeEventListener('orientationchange', updateSafeArea)
    }
  }, [])

  return safeArea
}

// Utility functions for responsive design
export const responsive = {
  // Generate responsive classes for Tailwind
  classes: <T extends string>(
    values: ResponsiveValue<T>
  ): string => {
    return Object.entries(values)
      .map(([breakpoint, value]) => {
        const prefix = breakpoint === 'xs' ? '' : `${breakpoint}:`
        return `${prefix}${value}`
      })
      .join(' ')
  },

  // Check if current breakpoint matches
  matches: (breakpoint: Breakpoint, width: number): boolean => {
    return width >= BREAKPOINTS[breakpoint]
  },

  // Get current breakpoint from width
  getBreakpoint: (width: number): Breakpoint => {
    return getBreakpoint(width)
  }
}