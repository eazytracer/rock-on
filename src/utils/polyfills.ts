/**
 * Polyfills for older browsers (especially mobile)
 */

// Polyfill for crypto.randomUUID() - not available in older mobile browsers
if (!crypto.randomUUID) {
  console.warn('⚠️ crypto.randomUUID not available, using polyfill')

  crypto.randomUUID = function randomUUID() {
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}

// Export for module system
export {}
