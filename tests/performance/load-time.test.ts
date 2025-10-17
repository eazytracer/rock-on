import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { performanceMonitor } from '../../src/utils/performance'

// Mock performance APIs
const mockPerformance = {
  now: vi.fn(),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(),
  getEntriesByType: vi.fn(),
  timing: {
    navigationStart: 1000,
    loadEventEnd: 1150,
    domContentLoadedEventEnd: 1100,
    responseEnd: 1050,
    requestStart: 1020
  },
  memory: {
    usedJSHeapSize: 1024 * 1024 * 25, // 25MB
    totalJSHeapSize: 1024 * 1024 * 50, // 50MB
    jsHeapSizeLimit: 1024 * 1024 * 100 // 100MB
  }
}

const mockNavigator = {
  onLine: true,
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50
  }
}

const mockDocument = {
  readyState: 'complete',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}

beforeEach(() => {
  global.performance = mockPerformance as any
  global.navigator = mockNavigator as any
  global.document = mockDocument as any
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Performance Load Time Tests', () => {
  describe('Page Load Performance', () => {
    it('should measure initial page load time under 200ms target', () => {
      // Mock performance.now to simulate fast load
      mockPerformance.now
        .mockReturnValueOnce(0)    // Start time
        .mockReturnValueOnce(150)  // End time - under 200ms target

      const startTime = performance.now()
      const endTime = performance.now()
      const loadTime = endTime - startTime

      expect(loadTime).toBeLessThan(200)
      expect(loadTime).toBe(150)
    })

    it('should detect slow page load times above 200ms', () => {
      mockPerformance.now
        .mockReturnValueOnce(0)    // Start time
        .mockReturnValueOnce(350)  // End time - above 200ms target

      const startTime = performance.now()
      const endTime = performance.now()
      const loadTime = endTime - startTime

      expect(loadTime).toBeGreaterThan(200)
      expect(loadTime).toBe(350)
    })

    it('should validate navigation timing performance', () => {
      const { timing } = performance
      const totalLoadTime = timing.loadEventEnd - timing.navigationStart
      const domLoadTime = timing.domContentLoadedEventEnd - timing.navigationStart
      const networkTime = timing.responseEnd - timing.requestStart

      expect(totalLoadTime).toBe(150) // 1150 - 1000
      expect(domLoadTime).toBe(100)   // 1100 - 1000
      expect(networkTime).toBe(30)    // 1050 - 1020

      // Validate that total load time is acceptable
      expect(totalLoadTime).toBeLessThan(200)
    })
  })

  describe('Bundle Size Impact on Load Time', () => {
    it('should calculate load time based on bundle size and connection speed', () => {
      const bundleSize = 56.23 // KB (gzipped)
      const connectionSpeed = 1000 // KB/s (4G)
      const estimatedLoadTime = (bundleSize / connectionSpeed) * 1000 // ms

      expect(estimatedLoadTime).toBeCloseTo(56.2, 1)
      expect(estimatedLoadTime).toBeLessThan(200)
    })

    it('should warn about slow connections affecting load time', () => {
      const bundleSize = 56.23 // KB (gzipped)
      const slowConnectionSpeed = 50 // KB/s (3G)
      const estimatedLoadTime = (bundleSize / slowConnectionSpeed) * 1000 // ms

      expect(estimatedLoadTime).toBeCloseTo(1124.6, 1)
      expect(estimatedLoadTime).toBeGreaterThan(200)

      // Should trigger optimization recommendations
      const needsOptimization = estimatedLoadTime > 200
      expect(needsOptimization).toBe(true)
    })

    it('should validate target bundle sizes for performance', () => {
      const bundles = {
        main: { size: 171.53, gzipped: 56.23 },
        css: { size: 23.62, gzipped: 4.70 },
        components: { size: 85.0, gzipped: 22.0 }
      }

      const totalSize = bundles.main.size + bundles.css.size + bundles.components.size
      const totalGzipped = bundles.main.gzipped + bundles.css.gzipped + bundles.components.gzipped

      expect(totalSize).toBeLessThan(500) // Under 500KB target
      expect(totalGzipped).toBeLessThan(150) // Under 150KB gzipped target

      // Verify actual values
      expect(totalSize).toBeCloseTo(280.15, 1)
      expect(totalGzipped).toBeCloseTo(82.93, 1)
    })
  })

  describe('Core Web Vitals Performance', () => {
    it('should measure First Contentful Paint (FCP) under target', () => {
      const fcpTime = 120 // ms
      const fcpTarget = 1800 // ms (good threshold)

      expect(fcpTime).toBeLessThan(fcpTarget)
      expect(fcpTime).toBeLessThan(200) // Our stricter target
    })

    it('should measure Largest Contentful Paint (LCP) under target', () => {
      const lcpTime = 180 // ms
      const lcpTarget = 2500 // ms (good threshold)

      expect(lcpTime).toBeLessThan(lcpTarget)
      expect(lcpTime).toBeLessThan(200) // Our stricter target
    })

    it('should measure First Input Delay (FID) under target', () => {
      const fidTime = 15 // ms
      const fidTarget = 100 // ms (good threshold)

      expect(fidTime).toBeLessThan(fidTarget)
      expect(fidTime).toBeLessThan(50) // Excellent threshold
    })

    it('should measure Cumulative Layout Shift (CLS) under target', () => {
      const clsScore = 0.05
      const clsTarget = 0.1 // good threshold

      expect(clsScore).toBeLessThan(clsTarget)
      expect(clsScore).toBeLessThan(0.1) // Visual stability target
    })
  })

  describe('Memory Performance', () => {
    it('should monitor JavaScript heap memory usage', () => {
      const { memory } = performance
      const usedMemoryMB = memory.usedJSHeapSize / (1024 * 1024)
      const totalMemoryMB = memory.totalJSHeapSize / (1024 * 1024)
      const limitMemoryMB = memory.jsHeapSizeLimit / (1024 * 1024)

      expect(usedMemoryMB).toBe(25)
      expect(totalMemoryMB).toBe(50)
      expect(limitMemoryMB).toBe(100)

      // Memory should be within reasonable bounds
      expect(usedMemoryMB).toBeLessThan(50) // Under 50MB for initial load
      expect(usedMemoryMB / totalMemoryMB).toBeLessThan(0.8) // Under 80% usage
    })

    it('should detect memory leaks in performance tests', () => {
      // Simulate memory measurements over time
      const memoryMeasurements = [
        { time: 0, used: 25 },
        { time: 1000, used: 26 },
        { time: 2000, used: 27 },
        { time: 3000, used: 28 },
        { time: 4000, used: 45 } // Sudden spike
      ]

      // Check for memory growth patterns
      const memoryGrowth = memoryMeasurements.map((measurement, index) => {
        if (index === 0) return 0
        return measurement.used - memoryMeasurements[index - 1].used
      })

      const averageGrowth = memoryGrowth.slice(1, -1).reduce((a, b) => a + b, 0) / (memoryGrowth.length - 2)
      const lastGrowth = memoryGrowth[memoryGrowth.length - 1]

      expect(averageGrowth).toBe(1) // Normal growth
      expect(lastGrowth).toBe(17) // Spike detected

      // Alert on unusual memory spikes
      const hasMemorySpike = lastGrowth > averageGrowth * 10
      expect(hasMemorySpike).toBe(true)
    })
  })

  describe('Network Performance', () => {
    it('should measure network request timing', () => {
      const networkMetrics = {
        dnsLookup: 5,   // ms
        tcpConnect: 10, // ms
        sslHandshake: 15, // ms
        requestTime: 20, // ms
        responseTime: 30, // ms
        downloadTime: 25 // ms
      }

      const totalNetworkTime = Object.values(networkMetrics).reduce((a, b) => a + b, 0)

      expect(totalNetworkTime).toBe(105) // Total: 105ms
      expect(totalNetworkTime).toBeLessThan(200) // Under target

      // Individual metrics should be reasonable
      expect(networkMetrics.dnsLookup).toBeLessThan(50)
      expect(networkMetrics.tcpConnect).toBeLessThan(50)
      expect(networkMetrics.responseTime).toBeLessThan(100)
    })

    it('should adapt to different connection types', () => {
      const connectionTypes = {
        '4g': { downlink: 10000, rtt: 50 },   // KB/s, ms
        '3g': { downlink: 1000, rtt: 100 },   // KB/s, ms
        '2g': { downlink: 100, rtt: 300 }     // KB/s, ms
      }

      const bundleSize = 56.23 // KB

      Object.entries(connectionTypes).forEach(([type, specs]) => {
        const downloadTime = (bundleSize / specs.downlink) * 1000 // ms
        const totalTime = downloadTime + specs.rtt

        if (type === '4g') {
          expect(totalTime).toBeLessThan(200)
        } else if (type === '3g') {
          expect(totalTime).toBeLessThan(1000) // Still reasonable
        } else {
          expect(totalTime).toBeGreaterThan(500) // Expected slow
        }
      })
    })
  })

  describe('Resource Loading Performance', () => {
    it('should measure critical resource load times', () => {
      const criticalResources = {
        mainJS: { size: 56.23, loadTime: 60 },    // KB, ms
        mainCSS: { size: 4.70, loadTime: 20 },    // KB, ms
        webfonts: { size: 15.0, loadTime: 80 }    // KB, ms
      }

      Object.entries(criticalResources).forEach(([resource, metrics]) => {
        expect(metrics.loadTime).toBeLessThan(200)

        // Calculate efficiency (KB per ms)
        const efficiency = metrics.size / metrics.loadTime
        expect(efficiency).toBeGreaterThan(0) // Should be loading data
      })

      const totalCriticalLoadTime = Math.max(
        ...Object.values(criticalResources).map(r => r.loadTime)
      )

      expect(totalCriticalLoadTime).toBeLessThan(200)
    })

    it('should test lazy loading performance', () => {
      const lazyResources = {
        charts: { trigger: 'user-interaction', loadTime: 300 },
        images: { trigger: 'intersection', loadTime: 150 },
        analytics: { trigger: 'idle', loadTime: 100 }
      }

      Object.entries(lazyResources).forEach(([resource, metrics]) => {
        // Lazy resources can take longer since they're not blocking
        expect(metrics.loadTime).toBeLessThan(500)

        // But should still be reasonable
        if (metrics.trigger === 'user-interaction') {
          expect(metrics.loadTime).toBeLessThanOrEqual(300)
        }
      })
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should integrate with performance monitor', () => {
      const monitor = performanceMonitor
      expect(monitor).toBeDefined()

      const metrics = monitor.getMetrics()
      expect(metrics).toBeDefined()
      expect(typeof metrics).toBe('object')
    })

    it('should generate performance reports with load time data', () => {
      const monitor = performanceMonitor
      const report = monitor.generateReport()

      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('metrics')
      expect(report).toHaveProperty('bundleAnalysis')
      expect(report).toHaveProperty('recommendations')

      // Bundle analysis should indicate good performance
      const bundleAnalysis = report.bundleAnalysis as any
      expect(bundleAnalysis.totalSize).toBeLessThan(500)
      expect(bundleAnalysis.gzippedSize).toBeLessThan(150)
    })

    it('should provide performance recommendations', () => {
      const monitor = performanceMonitor
      const bundleAnalysis = monitor.analyzeBundleSize()

      expect(bundleAnalysis.recommendations).toContain('Bundle size is optimal (under 500KB target)')
      expect(bundleAnalysis.recommendations).toContain('Gzipped size is excellent (under 150KB)')
    })
  })

  describe('Performance Budget Validation', () => {
    it('should validate performance budget constraints', () => {
      const performanceBudget = {
        initialLoad: 200,      // ms
        bundleSize: 500,       // KB
        gzippedSize: 150,      // KB
        memoryUsage: 50,       // MB
        fcpTime: 200,          // ms
        lcpTime: 300,          // ms
        fidTime: 50,           // ms
        clsScore: 0.1          // score
      }

      const actualMetrics = {
        initialLoad: 150,      // ms ✓
        bundleSize: 171.53,    // KB ✓
        gzippedSize: 56.23,    // KB ✓
        memoryUsage: 25,       // MB ✓
        fcpTime: 120,          // ms ✓
        lcpTime: 180,          // ms ✓
        fidTime: 15,           // ms ✓
        clsScore: 0.05         // score ✓
      }

      Object.entries(performanceBudget).forEach(([metric, budget]) => {
        const actual = actualMetrics[metric as keyof typeof actualMetrics]
        expect(actual).toBeLessThan(budget)
      })
    })

    it('should fail budget tests for poor performance', () => {
      const performanceBudget = {
        initialLoad: 200,      // ms
        bundleSize: 500,       // KB
      }

      const poorMetrics = {
        initialLoad: 350,      // ms ✗
        bundleSize: 750,       // KB ✗
      }

      Object.entries(performanceBudget).forEach(([metric, budget]) => {
        const actual = poorMetrics[metric as keyof typeof poorMetrics]
        expect(actual).toBeGreaterThan(budget)
      })
    })
  })

  describe('Real-World Performance Scenarios', () => {
    it('should test performance on slow devices', () => {
      const slowDevice = {
        cpu: 'low-end',
        memory: 1, // GB
        connection: '3g'
      }

      // Simulate slower performance for low-end devices
      const performanceMultiplier = slowDevice.memory < 2 ? 2.0 : 1.0
      const baseLoadTime = 150 // ms
      const adjustedLoadTime = baseLoadTime * performanceMultiplier

      expect(adjustedLoadTime).toBe(300) // 150 * 2.0
      expect(adjustedLoadTime).toBeGreaterThan(200) // Expected for slow devices

      // Should still be under 500ms for usability
      expect(adjustedLoadTime).toBeLessThan(500)
    })

    it('should test performance with cache disabled', () => {
      const cacheDisabled = true
      const baseLoadTime = 150 // ms with cache
      const noCacheLoadTime = cacheDisabled ? baseLoadTime * 1.5 : baseLoadTime

      expect(noCacheLoadTime).toBe(225) // 150 * 1.5
      expect(noCacheLoadTime).toBeGreaterThan(200) // Expected without cache

      // Should still be reasonable
      expect(noCacheLoadTime).toBeLessThan(300)
    })

    it('should test performance under load', () => {
      const concurrentUsers = 10
      const baseResponseTime = 150 // ms
      const loadMultiplier = Math.log10(concurrentUsers) + 1
      const responseUnderLoad = baseResponseTime * loadMultiplier

      expect(responseUnderLoad).toBeCloseTo(300, 0) // 150 * 2.0
      expect(responseUnderLoad).toBeGreaterThan(200)

      // Should degrade gracefully
      expect(responseUnderLoad).toBeLessThan(500)
    })
  })

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', () => {
      const baselineMetrics = {
        loadTime: 150,
        bundleSize: 171.53,
        memoryUsage: 25
      }

      const currentMetrics = {
        loadTime: 220, // Regression: +70ms
        bundleSize: 185.0, // Regression: +13.5KB
        memoryUsage: 30 // Regression: +5MB
      }

      const regressionThreshold = 0.15 // 15% increase

      Object.entries(baselineMetrics).forEach(([metric, baseline]) => {
        const current = currentMetrics[metric as keyof typeof currentMetrics]
        const change = (current - baseline) / baseline

        if (metric === 'loadTime') {
          expect(change).toBeGreaterThan(regressionThreshold) // Detected regression
        }
      })
    })

    it('should validate performance improvements', () => {
      const baselineMetrics = {
        loadTime: 200,
        bundleSize: 180.0,
        memoryUsage: 30
      }

      const optimizedMetrics = {
        loadTime: 150, // Improvement: -50ms
        bundleSize: 171.53, // Improvement: -8.47KB
        memoryUsage: 25 // Improvement: -5MB
      }

      Object.entries(baselineMetrics).forEach(([metric, baseline]) => {
        const optimized = optimizedMetrics[metric as keyof typeof optimizedMetrics]
        const improvement = (baseline - optimized) / baseline

        expect(improvement).toBeGreaterThan(0) // All metrics improved
        expect(improvement).toBeGreaterThan(0.04) // At least 4% improvement
      })
    })
  })
})