// Mobile performance testing and optimization utilities

export interface MobilePerformanceMetrics {
  batteryLevel?: number
  batteryCharging?: boolean
  batteryChargingTime?: number
  batteryDischargingTime?: number
  deviceMemory?: number
  effectiveConnectionType?: string
  networkDownlink?: number
  networkRTT?: number
  orientationAngle?: number
  screenWidth: number
  screenHeight: number
  devicePixelRatio: number
  touchPoints: number
  hardwareConcurrency: number
  platform: string
  userAgent: string
}

export interface MobileOptimizations {
  reducedAnimations: boolean
  prefersReducedMotion: boolean
  lowBatteryMode: boolean
  slowConnection: boolean
  lowMemoryDevice: boolean
  orientationOptimization: 'portrait' | 'landscape' | 'auto'
}

export class MobilePerformanceOptimizer {
  private static instance: MobilePerformanceOptimizer | null = null
  private metrics: MobilePerformanceMetrics
  private optimizations: MobileOptimizations
  private observers: Array<() => void> = []

  private constructor() {
    this.metrics = this.collectInitialMetrics()
    this.optimizations = this.determineOptimizations()
    this.setupMonitoring()
  }

  static getInstance(): MobilePerformanceOptimizer {
    if (!MobilePerformanceOptimizer.instance) {
      MobilePerformanceOptimizer.instance = new MobilePerformanceOptimizer()
    }
    return MobilePerformanceOptimizer.instance
  }

  /**
   * Collect initial mobile performance metrics
   */
  private collectInitialMetrics(): MobilePerformanceMetrics {
    const metrics: MobilePerformanceMetrics = {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      touchPoints: navigator.maxTouchPoints || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 1,
      platform: navigator.platform,
      userAgent: navigator.userAgent
    }

    // Battery API (experimental)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        metrics.batteryLevel = battery.level * 100
        metrics.batteryCharging = battery.charging
        metrics.batteryChargingTime = battery.chargingTime
        metrics.batteryDischargingTime = battery.dischargingTime

        // Listen for battery changes
        battery.addEventListener('levelchange', () => {
          this.metrics.batteryLevel = battery.level * 100
          this.updateOptimizations()
        })

        battery.addEventListener('chargingchange', () => {
          this.metrics.batteryCharging = battery.charging
          this.updateOptimizations()
        })
      }).catch(() => {
        console.warn('[MobilePerf] Battery API not available')
      })
    }

    // Device Memory API (experimental)
    if ('deviceMemory' in navigator) {
      metrics.deviceMemory = (navigator as any).deviceMemory
    }

    // Network Information API (experimental)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      metrics.effectiveConnectionType = connection.effectiveType
      metrics.networkDownlink = connection.downlink
      metrics.networkRTT = connection.rtt

      // Listen for network changes
      connection.addEventListener('change', () => {
        this.metrics.effectiveConnectionType = connection.effectiveType
        this.metrics.networkDownlink = connection.downlink
        this.metrics.networkRTT = connection.rtt
        this.updateOptimizations()
      })
    }

    // Screen orientation
    if ('orientation' in screen) {
      metrics.orientationAngle = (screen.orientation as any).angle
    }

    return metrics
  }

  /**
   * Determine performance optimizations based on device capabilities
   */
  private determineOptimizations(): MobileOptimizations {
    const optimizations: MobileOptimizations = {
      reducedAnimations: false,
      prefersReducedMotion: false,
      lowBatteryMode: false,
      slowConnection: false,
      lowMemoryDevice: false,
      orientationOptimization: 'auto'
    }

    // Check for reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      optimizations.prefersReducedMotion = true
      optimizations.reducedAnimations = true
    }

    // Low battery optimization
    if (this.metrics.batteryLevel && this.metrics.batteryLevel < 20 && !this.metrics.batteryCharging) {
      optimizations.lowBatteryMode = true
      optimizations.reducedAnimations = true
    }

    // Slow connection optimization
    if (this.metrics.effectiveConnectionType === 'slow-2g' || this.metrics.effectiveConnectionType === '2g') {
      optimizations.slowConnection = true
      optimizations.reducedAnimations = true
    }

    // Low memory device optimization
    if (this.metrics.deviceMemory && this.metrics.deviceMemory <= 1) {
      optimizations.lowMemoryDevice = true
      optimizations.reducedAnimations = true
    }

    // Hardware concurrency optimization
    if (this.metrics.hardwareConcurrency <= 2) {
      optimizations.reducedAnimations = true
    }

    return optimizations
  }

  /**
   * Setup continuous monitoring
   */
  private setupMonitoring(): void {
    // Monitor orientation changes
    const handleOrientationChange = () => {
      if ('orientation' in screen) {
        this.metrics.orientationAngle = (screen.orientation as any).angle
      }
      this.updateOptimizations()
    }

    if ('orientation' in screen) {
      screen.orientation.addEventListener('change', handleOrientationChange)
      this.observers.push(() => {
        screen.orientation.removeEventListener('change', handleOrientationChange)
      })
    }

    // Monitor resize events for responsive optimization
    const handleResize = () => {
      this.metrics.screenWidth = window.screen.width
      this.metrics.screenHeight = window.screen.height
      this.updateOptimizations()
    }

    window.addEventListener('resize', handleResize)
    this.observers.push(() => {
      window.removeEventListener('resize', handleResize)
    })

    // Monitor page visibility for battery optimization
    const handleVisibilityChange = () => {
      if (document.hidden && this.optimizations.lowBatteryMode) {
        // Pause non-essential operations when page is hidden
        this.pauseNonEssentialOperations()
      } else if (!document.hidden) {
        // Resume operations when page becomes visible
        this.resumeOperations()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    this.observers.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
  }

  /**
   * Update optimizations based on current metrics
   */
  private updateOptimizations(): void {
    const previousOptimizations = { ...this.optimizations }
    this.optimizations = this.determineOptimizations()

    // Notify if optimizations changed
    if (JSON.stringify(previousOptimizations) !== JSON.stringify(this.optimizations)) {
      console.log('[MobilePerf] Optimizations updated:', this.optimizations)
      this.dispatchOptimizationChange()
    }
  }

  /**
   * Dispatch custom event when optimizations change
   */
  private dispatchOptimizationChange(): void {
    window.dispatchEvent(new CustomEvent('mobile-optimization-change', {
      detail: {
        metrics: this.metrics,
        optimizations: this.optimizations
      }
    }))
  }

  /**
   * Pause non-essential operations for battery savings
   */
  private pauseNonEssentialOperations(): void {
    console.log('[MobilePerf] Pausing non-essential operations for battery savings')

    // Reduce animation frame rate
    window.dispatchEvent(new CustomEvent('reduce-animations', {
      detail: { reason: 'battery-saving' }
    }))

    // Pause background sync
    window.dispatchEvent(new CustomEvent('pause-background-operations', {
      detail: { reason: 'battery-saving' }
    }))
  }

  /**
   * Resume normal operations
   */
  private resumeOperations(): void {
    console.log('[MobilePerf] Resuming normal operations')

    window.dispatchEvent(new CustomEvent('resume-animations', {
      detail: { reason: 'page-visible' }
    }))

    window.dispatchEvent(new CustomEvent('resume-background-operations', {
      detail: { reason: 'page-visible' }
    }))
  }

  /**
   * Get current mobile performance metrics
   */
  getMetrics(): MobilePerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get current optimizations
   */
  getOptimizations(): MobileOptimizations {
    return { ...this.optimizations }
  }

  /**
   * Check if device is likely a mobile device
   */
  isMobileDevice(): boolean {
    return this.metrics.touchPoints > 0 &&
           this.metrics.screenWidth <= 768 &&
           /Mobi|Android/i.test(this.metrics.userAgent)
  }

  /**
   * Check if device has low performance characteristics
   */
  isLowPerformanceDevice(): boolean {
    return this.optimizations.lowMemoryDevice ||
           this.metrics.hardwareConcurrency <= 2 ||
           this.optimizations.slowConnection
  }

  /**
   * Get device classification
   */
  getDeviceClass(): 'high' | 'medium' | 'low' {
    if (this.isLowPerformanceDevice()) {
      return 'low'
    }

    if (this.metrics.deviceMemory && this.metrics.deviceMemory >= 4 &&
        this.metrics.hardwareConcurrency >= 4) {
      return 'high'
    }

    return 'medium'
  }

  /**
   * Get recommended practice session timer interval based on device performance
   */
  getRecommendedTimerInterval(): number {
    const deviceClass = this.getDeviceClass()

    switch (deviceClass) {
      case 'low':
        return 1000 // Update every second for low-end devices
      case 'medium':
        return 500  // Update every 500ms for medium devices
      case 'high':
        return 100  // Update every 100ms for high-end devices
      default:
        return 500
    }
  }

  /**
   * Get recommended virtual list item height for performance
   */
  getRecommendedVirtualListHeight(): number {
    const deviceClass = this.getDeviceClass()

    switch (deviceClass) {
      case 'low':
        return 20   // Render fewer items for low-end devices
      case 'medium':
        return 30   // Medium list size
      case 'high':
        return 50   // Larger lists for high-end devices
      default:
        return 30
    }
  }

  /**
   * Generate mobile performance report
   */
  generateReport(): object {
    return {
      timestamp: new Date().toISOString(),
      deviceClass: this.getDeviceClass(),
      isMobile: this.isMobileDevice(),
      isLowPerformance: this.isLowPerformanceDevice(),
      metrics: this.metrics,
      optimizations: this.optimizations,
      recommendations: this.generateRecommendations()
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.optimizations.lowBatteryMode) {
      recommendations.push('Device is in low battery mode - reduce background operations')
    }

    if (this.optimizations.slowConnection) {
      recommendations.push('Slow network detected - optimize data usage and enable offline mode')
    }

    if (this.optimizations.lowMemoryDevice) {
      recommendations.push('Low memory device - limit concurrent operations and use virtual scrolling')
    }

    if (this.optimizations.reducedAnimations) {
      recommendations.push('Animations reduced for better performance - use simple transitions')
    }

    if (this.metrics.touchPoints === 0 && this.metrics.screenWidth > 768) {
      recommendations.push('Desktop device detected - enable hover interactions and keyboard shortcuts')
    }

    if (this.isMobileDevice() && this.metrics.orientationAngle !== undefined) {
      recommendations.push('Mobile device - optimize for touch interactions and orientation changes')
    }

    return recommendations
  }

  /**
   * Apply CSS custom properties for performance optimizations
   */
  applyCSSOptimizations(): void {
    const root = document.documentElement

    // Animation duration based on performance
    if (this.optimizations.reducedAnimations) {
      root.style.setProperty('--animation-duration', '0ms')
      root.style.setProperty('--transition-duration', '150ms')
    } else {
      root.style.setProperty('--animation-duration', '300ms')
      root.style.setProperty('--transition-duration', '250ms')
    }

    // Transform performance hint
    if (this.getDeviceClass() === 'low') {
      root.style.setProperty('--will-change', 'auto')
    } else {
      root.style.setProperty('--will-change', 'transform')
    }
  }

  /**
   * Cleanup observers and resources
   */
  destroy(): void {
    this.observers.forEach(cleanup => cleanup())
    this.observers = []
    MobilePerformanceOptimizer.instance = null
  }
}

// Export singleton instance
export const mobilePerformanceOptimizer = MobilePerformanceOptimizer.getInstance()

// Initialize mobile performance optimizations
export function initializeMobilePerformance(): MobilePerformanceOptimizer {
  const optimizer = MobilePerformanceOptimizer.getInstance()
  optimizer.applyCSSOptimizations()

  console.log('[MobilePerf] Mobile performance optimization initialized')
  console.log('[MobilePerf] Device class:', optimizer.getDeviceClass())
  console.log('[MobilePerf] Is mobile:', optimizer.isMobileDevice())
  console.log('[MobilePerf] Optimizations:', optimizer.getOptimizations())

  return optimizer
}