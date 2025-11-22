// Load polyfills first for older browsers (especially mobile)
import './utils/polyfills'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializePerformanceMonitoring } from './utils/performance'
import { initializeMobilePerformance } from './utils/mobilePerformance'
import './utils/testSupabaseConnection'
import './utils/debugSync'
import { BUILD_ID } from './config/buildInfo'

// Register Service Worker for offline functionality
if ('serviceWorker' in navigator && import.meta.env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration)

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New content available, prompt user to refresh
                if (confirm('New version available! Refresh to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                  window.location.reload()
                }
              }
            })
          }
        })
      })
      .catch(error => {
        console.log('SW registration failed:', error)
      })
  })

  // Listen for SW messages
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SYNC_COMPLETE') {
      console.log(`Data sync completed for ${event.data.dataType}`)
      // Trigger UI update if needed
      window.dispatchEvent(
        new CustomEvent('sw-sync-complete', {
          detail: event.data,
        })
      )
    }
  })
}

// Initialize performance monitoring
if ((import.meta as any).env?.PROD) {
  initializePerformanceMonitoring()
}

// Initialize mobile performance optimizations
initializeMobilePerformance()

// Seed database with MVP data and then render app
async function initializeApp() {
  console.log('🚀 Initializing app...')
  console.log(`📦 BUILD: ${BUILD_ID}`)
  console.log('📱 Browser:', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hasCryptoUUID: typeof crypto.randomUUID === 'function',
  })
  console.log('📍 Environment:', {
    DEV: import.meta.env.DEV,
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
  })

  // IndexedDB is populated via sync from Supabase on first login
  // See: .claude/specifications/2025-10-27T18:16_test-data-and-seeding-specification.md
  console.log('📦 IndexedDB will be populated from Supabase on first login')

  // Render the app
  console.log('🎨 Rendering React app...')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  console.log('✅ App rendered')
}

// Start the app initialization
initializeApp()
