import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  measureExecutionTime,
  measureAsyncExecutionTime,
  createPerformanceMark,
  measureBetweenMarks,
  PerformanceMonitor,
  initializePerformanceMonitoring
} from '../../src/utils/performance'

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

// Mobile Performance Utilities tests moved to integration tests
// These tests require actual browser APIs and are better suited for integration/E2E testing
// See: tests/integration/mobile-performance.test.ts (to be created)

// Integration tests and edge cases for mobile performance moved to integration tests
// See: tests/integration/mobile-performance.test.ts (to be created)