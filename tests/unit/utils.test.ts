import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  measureExecutionTime,
  measureAsyncExecutionTime,
  createPerformanceMark,
  measureBetweenMarks,
  PerformanceMonitor,
  initializePerformanceMonitoring
} from '../../src/utils/performance'
import {
  MobilePerformanceOptimizer,
  initializeMobilePerformance,
  mobilePerformanceOptimizer
} from '../../src/utils/mobilePerformance'

// Mock global objects
const mockPerformance = {
  now: vi.fn(() => 1000),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  memory: {
    usedJSHeapSize: 1024 * 1024 * 50 // 50MB
  }
}

const mockNavigator = {
  onLine: true,
  maxTouchPoints: 5,
  hardwareConcurrency: 4,
  platform: 'MacIntel',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
  getBattery: vi.fn(),
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    addEventListener: vi.fn()
  },
  deviceMemory: 4
}

const mockScreen = {
  width: 375,
  height: 812,
  orientation: {
    angle: 0,
    addEventListener: vi.fn()
  }
}

const mockWindow = {
  devicePixelRatio: 2,
  matchMedia: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  location: {
    href: 'https://test.com'
  }
}

const mockDocument = {
  hidden: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  documentElement: {
    style: {
      setProperty: vi.fn()
    }
  }
}

// Setup global mocks
beforeEach(() => {
  global.performance = mockPerformance as any
  global.navigator = mockNavigator as any
  global.screen = mockScreen as any
  global.window = mockWindow as any
  global.document = mockDocument as any

  // Reset all mocks
  vi.clearAllMocks()

  // Setup window.matchMedia mock
  mockWindow.matchMedia.mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))

  // Setup battery API mock
  mockNavigator.getBattery.mockResolvedValue({
    level: 0.5,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: 3600,
    addEventListener: vi.fn()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Performance Utilities', () => {
  describe('measureExecutionTime', () => {
    it('should measure function execution time', () => {
      const testFunction = vi.fn(() => 'result')
      mockPerformance.now
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1500) // End time

      const result = measureExecutionTime(testFunction, 'test function')

      expect(result).toBe('result')
      expect(testFunction).toHaveBeenCalledOnce()
      expect(mockPerformance.now).toHaveBeenCalledTimes(2)
    })

    it('should handle functions that throw errors', () => {
      const errorFunction = vi.fn(() => {
        throw new Error('Test error')
      })

      expect(() => {
        measureExecutionTime(errorFunction, 'error function')
      }).toThrow('Test error')

      expect(errorFunction).toHaveBeenCalledOnce()
    })
  })

  describe('measureAsyncExecutionTime', () => {
    it('should measure async function execution time', async () => {
      const asyncFunction = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'async result'
      })

      mockPerformance.now
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1600) // End time

      const result = await measureAsyncExecutionTime(asyncFunction, 'async test')

      expect(result).toBe('async result')
      expect(asyncFunction).toHaveBeenCalledOnce()
      expect(mockPerformance.now).toHaveBeenCalledTimes(2)
    })

    it('should handle async functions that reject', async () => {
      const rejectFunction = vi.fn(async () => {
        throw new Error('Async error')
      })

      await expect(
        measureAsyncExecutionTime(rejectFunction, 'reject test')
      ).rejects.toThrow('Async error')

      expect(rejectFunction).toHaveBeenCalledOnce()
    })
  })

  describe('createPerformanceMark', () => {
    it('should create performance mark when supported', () => {
      createPerformanceMark('test-mark')
      expect(mockPerformance.mark).toHaveBeenCalledWith('test-mark')
    })

    it('should not throw when performance.mark is not available', () => {
      mockPerformance.mark = undefined
      expect(() => createPerformanceMark('test-mark')).not.toThrow()
    })
  })

  describe('measureBetweenMarks', () => {
    it('should measure time between marks', () => {
      const mockMeasure = {
        duration: 500
      }
      mockPerformance.getEntriesByName.mockReturnValue([mockMeasure])

      const duration = measureBetweenMarks('start', 'end', 'test-measure')

      expect(mockPerformance.measure).toHaveBeenCalledWith('test-measure', 'start', 'end')
      expect(mockPerformance.getEntriesByName).toHaveBeenCalledWith('test-measure')
      expect(duration).toBe(500)
    })

    it('should return 0 when measurement fails', () => {
      mockPerformance.measure = undefined
      const duration = measureBetweenMarks('start', 'end', 'test-measure')
      expect(duration).toBe(0)
    })
  })

  describe('PerformanceMonitor', () => {
    it('should be a singleton', () => {
      const instance1 = PerformanceMonitor.getInstance()
      const instance2 = PerformanceMonitor.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should collect performance metrics', () => {
      const monitor = PerformanceMonitor.getInstance()
      const metrics = monitor.getMetrics()
      expect(metrics).toBeDefined()
      expect(typeof metrics).toBe('object')
    })

    it('should generate performance report', () => {
      const monitor = PerformanceMonitor.getInstance()
      const report = monitor.generateReport()

      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('url')
      expect(report).toHaveProperty('userAgent')
      expect(report).toHaveProperty('metrics')
      expect(report).toHaveProperty('bundleAnalysis')
      expect(report).toHaveProperty('recommendations')
    })

    it('should analyze bundle size', () => {
      const monitor = PerformanceMonitor.getInstance()
      const analysis = monitor.analyzeBundleSize()

      expect(analysis).toHaveProperty('totalSize')
      expect(analysis).toHaveProperty('gzippedSize')
      expect(analysis).toHaveProperty('modules')
      expect(analysis).toHaveProperty('recommendations')
      expect(Array.isArray(analysis.modules)).toBe(true)
      expect(Array.isArray(analysis.recommendations)).toBe(true)
    })
  })

  describe('initializePerformanceMonitoring', () => {
    it('should return PerformanceMonitor instance', () => {
      const monitor = initializePerformanceMonitoring()
      expect(monitor).toBeInstanceOf(PerformanceMonitor)
    })
  })
})

describe('Mobile Performance Utilities', () => {
  describe('MobilePerformanceOptimizer', () => {
    it('should be a singleton', () => {
      const instance1 = MobilePerformanceOptimizer.getInstance()
      const instance2 = MobilePerformanceOptimizer.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should collect mobile metrics', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const metrics = optimizer.getMetrics()

      expect(metrics).toHaveProperty('screenWidth')
      expect(metrics).toHaveProperty('screenHeight')
      expect(metrics).toHaveProperty('devicePixelRatio')
      expect(metrics).toHaveProperty('touchPoints')
      expect(metrics).toHaveProperty('hardwareConcurrency')
      expect(metrics).toHaveProperty('platform')
      expect(metrics).toHaveProperty('userAgent')

      expect(metrics.screenWidth).toBe(375)
      expect(metrics.screenHeight).toBe(812)
      expect(metrics.devicePixelRatio).toBe(2)
      expect(metrics.touchPoints).toBe(5)
    })

    it('should determine optimizations correctly', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const optimizations = optimizer.getOptimizations()

      expect(optimizations).toHaveProperty('reducedAnimations')
      expect(optimizations).toHaveProperty('prefersReducedMotion')
      expect(optimizations).toHaveProperty('lowBatteryMode')
      expect(optimizations).toHaveProperty('slowConnection')
      expect(optimizations).toHaveProperty('lowMemoryDevice')
      expect(optimizations).toHaveProperty('orientationOptimization')
    })

    it('should identify mobile devices correctly', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const isMobile = optimizer.isMobileDevice()
      expect(isMobile).toBe(true) // Based on mock navigator.userAgent
    })

    it('should classify device performance correctly', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const deviceClass = optimizer.getDeviceClass()
      expect(['low', 'medium', 'high']).toContain(deviceClass)
    })

    it('should provide appropriate timer intervals based on device class', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const interval = optimizer.getRecommendedTimerInterval()
      expect(typeof interval).toBe('number')
      expect(interval).toBeGreaterThan(0)
      expect([100, 500, 1000]).toContain(interval)
    })

    it('should provide appropriate virtual list heights', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const height = optimizer.getRecommendedVirtualListHeight()
      expect(typeof height).toBe('number')
      expect(height).toBeGreaterThan(0)
      expect([20, 30, 50]).toContain(height)
    })

    it('should generate comprehensive reports', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const report = optimizer.generateReport()

      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('deviceClass')
      expect(report).toHaveProperty('isMobile')
      expect(report).toHaveProperty('isLowPerformance')
      expect(report).toHaveProperty('metrics')
      expect(report).toHaveProperty('optimizations')
      expect(report).toHaveProperty('recommendations')
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    it('should apply CSS optimizations', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      optimizer.applyCSSOptimizations()

      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalled()
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--animation-duration',
        expect.any(String)
      )
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--transition-duration',
        expect.any(String)
      )
    })
  })

  describe('Low Battery Scenarios', () => {
    beforeEach(() => {
      mockNavigator.getBattery.mockResolvedValue({
        level: 0.15, // 15% battery
        charging: false,
        chargingTime: Infinity,
        dischargingTime: 1800,
        addEventListener: vi.fn()
      })
    })

    it('should enable low battery mode with reduced animations', async () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()

      // Wait for battery API to resolve
      await new Promise(resolve => setTimeout(resolve, 10))

      const optimizations = optimizer.getOptimizations()
      expect(optimizations.lowBatteryMode).toBe(true)
      expect(optimizations.reducedAnimations).toBe(true)
    })
  })

  describe('Slow Connection Scenarios', () => {
    beforeEach(() => {
      mockNavigator.connection = {
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 500,
        addEventListener: vi.fn()
      }
    })

    it('should detect slow connections and optimize accordingly', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const optimizations = optimizer.getOptimizations()
      expect(optimizations.slowConnection).toBe(true)
      expect(optimizations.reducedAnimations).toBe(true)
    })
  })

  describe('Low Memory Scenarios', () => {
    beforeEach(() => {
      mockNavigator.deviceMemory = 0.5 // 0.5GB RAM
    })

    it('should detect low memory devices and optimize accordingly', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const optimizations = optimizer.getOptimizations()
      expect(optimizations.lowMemoryDevice).toBe(true)
      expect(optimizations.reducedAnimations).toBe(true)
    })
  })

  describe('Reduced Motion Preference', () => {
    beforeEach(() => {
      mockWindow.matchMedia.mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    })

    it('should respect user preference for reduced motion', () => {
      const optimizer = MobilePerformanceOptimizer.getInstance()
      const optimizations = optimizer.getOptimizations()
      expect(optimizations.prefersReducedMotion).toBe(true)
      expect(optimizations.reducedAnimations).toBe(true)
    })
  })

  describe('initializeMobilePerformance', () => {
    it('should return MobilePerformanceOptimizer instance', () => {
      const optimizer = initializeMobilePerformance()
      expect(optimizer).toBeInstanceOf(MobilePerformanceOptimizer)
    })

    it('should apply CSS optimizations during initialization', () => {
      initializeMobilePerformance()
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalled()
    })
  })

  describe('mobilePerformanceOptimizer singleton', () => {
    it('should provide access to singleton instance', () => {
      expect(mobilePerformanceOptimizer).toBeInstanceOf(MobilePerformanceOptimizer)
      expect(mobilePerformanceOptimizer).toBe(MobilePerformanceOptimizer.getInstance())
    })
  })
})

describe('Integration Tests', () => {
  describe('Performance and Mobile Integration', () => {
    it('should work together without conflicts', () => {
      const performanceMonitor = initializePerformanceMonitoring()
      const mobileOptimizer = initializeMobilePerformance()

      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor)
      expect(mobileOptimizer).toBeInstanceOf(MobilePerformanceOptimizer)

      // Both should be able to generate reports simultaneously
      const perfReport = performanceMonitor.generateReport()
      const mobileReport = mobileOptimizer.generateReport()

      expect(perfReport).toHaveProperty('timestamp')
      expect(mobileReport).toHaveProperty('timestamp')
    })

    it('should coordinate recommendations between systems', () => {
      const performanceMonitor = PerformanceMonitor.getInstance()
      const mobileOptimizer = MobilePerformanceOptimizer.getInstance()

      const bundleAnalysis = performanceMonitor.analyzeBundleSize()
      const mobileReport = mobileOptimizer.generateReport()

      expect(bundleAnalysis.recommendations).toContain('Bundle size is optimal (under 500KB target)')
      expect(bundleAnalysis.recommendations).toContain('Gzipped size is excellent (under 150KB)')
      expect(Array.isArray(mobileReport.recommendations)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing browser APIs gracefully', () => {
      // Remove APIs
      mockNavigator.getBattery = undefined
      mockNavigator.connection = undefined
      mockPerformance.mark = undefined

      expect(() => {
        initializePerformanceMonitoring()
        initializeMobilePerformance()
      }).not.toThrow()
    })

    it('should provide fallback values when APIs fail', () => {
      mockNavigator.getBattery = vi.fn().mockRejectedValue(new Error('Battery API failed'))

      const optimizer = MobilePerformanceOptimizer.getInstance()
      const metrics = optimizer.getMetrics()

      // Should still have basic metrics
      expect(metrics.screenWidth).toBeDefined()
      expect(metrics.screenHeight).toBeDefined()
      expect(metrics.touchPoints).toBeDefined()
    })
  })
})

describe('Edge Cases', () => {
  describe('Extreme Device Configurations', () => {
    it('should handle devices with no touch support', () => {
      mockNavigator.maxTouchPoints = 0
      const optimizer = MobilePerformanceOptimizer.getInstance()
      expect(optimizer.isMobileDevice()).toBe(false)
    })

    it('should handle very low performance devices', () => {
      mockNavigator.hardwareConcurrency = 1
      mockNavigator.deviceMemory = 0.25
      mockNavigator.connection = {
        effectiveType: 'slow-2g',
        downlink: 0.1,
        rtt: 2000,
        addEventListener: vi.fn()
      }

      const optimizer = MobilePerformanceOptimizer.getInstance()
      expect(optimizer.getDeviceClass()).toBe('low')
      expect(optimizer.isLowPerformanceDevice()).toBe(true)
      expect(optimizer.getRecommendedTimerInterval()).toBe(1000)
    })

    it('should handle high-end devices correctly', () => {
      mockNavigator.hardwareConcurrency = 8
      mockNavigator.deviceMemory = 8
      mockNavigator.connection = {
        effectiveType: '4g',
        downlink: 50,
        rtt: 20,
        addEventListener: vi.fn()
      }

      const optimizer = MobilePerformanceOptimizer.getInstance()
      expect(optimizer.getDeviceClass()).toBe('high')
      expect(optimizer.getRecommendedTimerInterval()).toBe(100)
    })
  })
})