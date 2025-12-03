// Rock On! Service Worker for Offline Functionality
// Enables offline access to the band management platform

// IMPORTANT: Update VERSION on each deploy to invalidate old caches
// This should match BUILD_ID from the build process
const VERSION = '2';
const CACHE_NAME = `rock-on-v${VERSION}`;
const STATIC_CACHE_NAME = `rock-on-static-v${VERSION}`;
const DYNAMIC_CACHE_NAME = `rock-on-dynamic-v${VERSION}`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Routes that should work offline
const OFFLINE_ROUTES = [
  '/',
  '/songs',
  '/sessions',
  '/setlists',
  '/dashboard'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME &&
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Claim control of all clients
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle navigation requests (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle API-like requests
  if (url.pathname.startsWith('/api') || url.pathname.includes('.json')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Default handling for other requests
  event.respondWith(handleDefaultRequest(request));
});

// Handle navigation requests (for SPA routing)
// NETWORK-FIRST: Always try to get fresh HTML to ensure users get latest version
function handleNavigationRequest(request) {
  return fetch(request)
    .then((networkResponse) => {
      // Got response from network - cache it and return
      if (networkResponse.ok) {
        return caches.open(DYNAMIC_CACHE_NAME)
          .then((cache) => {
            cache.put('/index.html', networkResponse.clone());
            return networkResponse;
          });
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed - try cache as fallback for offline support
      console.log('[SW] Network failed, falling back to cached index.html');
      return caches.match('/index.html');
    });
}

// Handle static asset requests
// CACHE-FIRST for hashed assets (immutable), NETWORK-FIRST for unhashed
function handleStaticRequest(request) {
  const url = new URL(request.url);

  // Hashed assets (contain hash in filename) are immutable - use cache-first
  // Pattern: filename-hash.ext (e.g., index-95de112-d7efe939.js)
  const isHashedAsset = /\-[a-f0-9]{6,}\./i.test(url.pathname);

  if (isHashedAsset) {
    // Cache-first for immutable hashed assets
    return caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        // Not in cache - fetch and cache
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              return caches.open(STATIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
                });
            }
            return networkResponse;
          });
      });
  }

  // Network-first for non-hashed assets (may change between deploys)
  return fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        return caches.open(STATIC_CACHE_NAME)
          .then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed - try cache as fallback
      return caches.match(request);
    });
}

// Handle API requests with cache-first strategy for offline support
function handleApiRequest(request) {
  return caches.match(request)
    .then((response) => {
      if (response) {
        // Return cached response and update in background
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(DYNAMIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
            }
          })
          .catch(() => {
            // Network error - keep using cache
          });

        return response;
      }

      // Fetch from network
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            return caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, networkResponse.clone());
                return networkResponse;
              });
          }
          return networkResponse;
        })
        .catch(() => {
          // Return generic offline response for API requests
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message: 'This request requires an internet connection',
              cached: false
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            }
          );
        });
    });
}

// Handle default requests
function handleDefaultRequest(request) {
  return caches.match(request)
    .then((response) => {
      if (response) {
        return response;
      }

      return fetch(request)
        .then((networkResponse) => {
          // Cache successful responses
          if (networkResponse.ok) {
            return caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, networkResponse.clone());
                return networkResponse;
              });
          }
          return networkResponse;
        });
    });
}

// Helper function to determine if a path is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname === '/manifest.json' ||
         pathname === '/favicon.ico';
}

// Background sync for when connectivity is restored
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'background-sync-songs') {
    event.waitUntil(syncPendingData('songs'));
  } else if (event.tag === 'background-sync-sessions') {
    event.waitUntil(syncPendingData('sessions'));
  } else if (event.tag === 'background-sync-setlists') {
    event.waitUntil(syncPendingData('setlists'));
  }
});

// Sync pending data when connection is restored
async function syncPendingData(dataType) {
  try {
    console.log(`[SW] Syncing pending ${dataType} data`);

    // In a real implementation, this would:
    // 1. Get pending changes from IndexedDB
    // 2. Send them to the server
    // 3. Update local storage with server response
    // 4. Clear pending changes

    // For this offline-first app, we'll focus on local data consistency
    const message = {
      type: 'SYNC_COMPLETE',
      dataType: dataType,
      timestamp: new Date().toISOString()
    };

    // Notify all clients about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage(message);
    });

  } catch (error) {
    console.error(`[SW] Failed to sync ${dataType}:`, error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'REQUEST_SYNC') {
    // Register background sync
    self.registration.sync.register(`background-sync-${event.data.dataType}`)
      .then(() => {
        console.log(`[SW] Background sync registered for ${event.data.dataType}`);
      })
      .catch((error) => {
        console.error(`[SW] Background sync registration failed:`, error);
      });
  }
});

// Notify about successful installation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      status: 'active'
    });
  }
});

console.log('[SW] Service worker script loaded');