/**
 * Debug utility for RealtimeManager
 *
 * Usage in browser console:
 *
 * 1. Get diagnostics:
 *    window.debugRealtime()
 *
 * 2. Watch for changes:
 *    window.debugRealtime({ watch: true })
 *
 * 3. Clear console and show fresh diagnostics:
 *    window.debugRealtime({ clear: true })
 */

import type { RealtimeManager } from '../services/data/RealtimeManager'

interface DebugOptions {
  watch?: boolean
  clear?: boolean
  interval?: number // For watch mode, default 5000ms
}

declare global {
  interface Window {
    debugRealtime: (options?: DebugOptions) => void
    __realtimeManager?: RealtimeManager
    __debugRealtimeInterval?: NodeJS.Timeout
  }
}

/**
 * Initialize debug utilities
 * Called from AuthContext after RealtimeManager is created
 */
export function setupRealtimeDebug(realtimeManager: RealtimeManager): void {
  // Store reference on window for debugging
  window.__realtimeManager = realtimeManager

  // Expose debug function
  window.debugRealtime = (options: DebugOptions = {}) => {
    if (options.clear) {
      console.clear()
    }

    if (!window.__realtimeManager) {
      console.error('❌ RealtimeManager not initialized')
      return
    }

    const diagnostics = window.__realtimeManager.getDiagnostics()

    console.group('🔌 RealtimeManager Diagnostics')
    console.log('Connection ID:', diagnostics.connectionId)
    console.log('Uptime:', `${(diagnostics.uptime / 1000).toFixed(1)}s`)
    console.log('Connected:', diagnostics.state.connected ? '✅ Yes' : '❌ No')
    console.log('Online:', diagnostics.state.isOnline ? '✅ Yes' : '❌ No')
    console.log('User ID:', diagnostics.state.currentUserId)
    console.groupEnd()

    console.group('📊 Metrics')
    console.log(
      'Subscription Attempts:',
      diagnostics.metrics.subscriptionAttempts
    )
    console.log(
      'Subscription Successes:',
      diagnostics.metrics.subscriptionSuccesses
    )
    console.log(
      'Subscription Failures:',
      diagnostics.metrics.subscriptionFailures
    )
    console.log('Messages Received:', diagnostics.metrics.messagesReceived)
    console.log('Messages/Minute:', diagnostics.metrics.messagesPerMinute)
    console.log(
      'Last Message:',
      diagnostics.metrics.lastMessageTime
        ? new Date(diagnostics.metrics.lastMessageTime).toLocaleTimeString()
        : 'Never'
    )
    console.groupEnd()

    console.group('📡 Channels')
    console.log('Active Channels:', diagnostics.channels.count)
    console.table(diagnostics.channels.names.map(name => ({ Channel: name })))
    console.groupEnd()

    console.group('📬 Pending Toasts')
    console.log('Count:', diagnostics.pendingToasts)
    console.groupEnd()

    console.log('Timestamp:', diagnostics.timestamp)

    // Watch mode
    if (options.watch) {
      if (window.__debugRealtimeInterval) {
        console.warn(
          '⚠️ Watch mode already active. Stopping previous interval.'
        )
        clearInterval(window.__debugRealtimeInterval)
      }

      const interval = options.interval || 5000
      console.log(
        `👀 Watch mode enabled (refreshing every ${interval}ms). Call debugRealtime({ watch: false }) to stop.`
      )

      window.__debugRealtimeInterval = setInterval(() => {
        console.clear()
        window.debugRealtime({ clear: false })
      }, interval)
    } else if (options.watch === false) {
      if (window.__debugRealtimeInterval) {
        clearInterval(window.__debugRealtimeInterval)
        window.__debugRealtimeInterval = undefined
        console.log('✅ Watch mode stopped')
      }
    }
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║ 🐛 Realtime Debug Mode Enabled                                 ║
║                                                                ║
║ Type window.debugRealtime() in console for diagnostics        ║
║ Use window.debugRealtime({ watch: true }) for live updates    ║
╚════════════════════════════════════════════════════════════════╝
  `)
}

/**
 * Cleanup debug utilities
 * Called from AuthContext on unmount
 */
export function cleanupRealtimeDebug(): void {
  if (window.__debugRealtimeInterval) {
    clearInterval(window.__debugRealtimeInterval)
    window.__debugRealtimeInterval = undefined
  }

  window.__realtimeManager = undefined
  // @ts-expect-error - Allow cleanup of debug function
  window.debugRealtime = undefined
}
