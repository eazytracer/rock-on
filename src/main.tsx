import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializePerformanceMonitoring } from './utils/performance'
import { initializeMobilePerformance } from './utils/mobilePerformance'

// Register Service Worker for offline functionality
if ('serviceWorker' in navigator && (import.meta as any).env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available, prompt user to refresh
                if (confirm('New version available! Refresh to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });

  // Listen for SW messages
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_COMPLETE') {
      console.log(`Data sync completed for ${event.data.dataType}`);
      // Trigger UI update if needed
      window.dispatchEvent(new CustomEvent('sw-sync-complete', {
        detail: event.data
      }));
    }
  });
}

// Initialize performance monitoring
if ((import.meta as any).env?.PROD) {
  initializePerformanceMonitoring()
}

// Initialize mobile performance optimizations
initializeMobilePerformance()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)