const CACHE_NAME = 'prayersync-v1.0.0';
const STATIC_CACHE_NAME = 'prayersync-static-v1.0.0';
const API_CACHE_NAME = 'prayersync-api-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index-production.html',
  '/app-production.js',
  '/styles-new.css',
  '/manifest-production.json',
  '/icon-512x512.svg',
  // Add any other static assets
];

// API endpoints to cache
const API_ENDPOINTS = [
  'https://api.aladhan.com/v1/timings',
  'https://nominatim.openstreetmap.org/reverse'
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES).catch(err => {
          console.error('Cache addAll failed:', err);
          // Try to cache files individually
          return Promise.allSettled(
            STATIC_FILES.map(file => cache.add(file))
          );
        });
      }),
      
      // Create API cache
      caches.open(API_CACHE_NAME)
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      self.skipWaiting(); // Force activation
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== API_CACHE_NAME &&
                cacheName.startsWith('prayersync-')) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all pages
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker: Activation complete');
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (url.origin === location.origin) {
    // Same-origin requests (static files)
    event.respondWith(handleStaticRequest(request));
  } else if (isAPIRequest(url)) {
    // API requests
    event.respondWith(handleAPIRequest(request));
  } else {
    // External requests (fonts, etc.)
    event.respondWith(handleExternalRequest(request));
  }
});

// Handle static file requests
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Serve from cache, update in background
      updateCacheInBackground(request, cache);
      return cachedResponse;
    }
    
    // Not in cache, try network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Static request failed:', error);
    
    // Return offline fallback for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return createOfflinePage();
    }
    
    throw error;
  }
}

// Handle API requests with cache-first strategy
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Try network first for fresh data
    const networkResponse = await fetch(request, {
      headers: {
        'User-Agent': 'PrayerSync/1.0.0'
      }
    });
    
    if (networkResponse.ok) {
      // Cache successful API responses
      const clonedResponse = networkResponse.clone();
      await cache.put(request, clonedResponse);
      return networkResponse;
    }
    
    throw new Error(`API request failed: ${networkResponse.status}`);
  } catch (error) {
    console.warn('API request failed, trying cache:', error);
    
    // Fall back to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Add header to indicate cached response
      const response = cachedResponse.clone();
      response.headers.set('X-Served-By', 'ServiceWorker-Cache');
      return response;
    }
    
    // Return error response if no cache available
    return new Response(
      JSON.stringify({
        error: 'Network unavailable and no cached data',
        offline: true
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Served-By': 'ServiceWorker-Offline'
        }
      }
    );
  }
}

// Handle external requests (fonts, CDNs, etc.)
async function handleExternalRequest(request) {
  try {
    // Try network with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(request, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    console.warn('External request failed:', error);
    
    // Check if we have it cached
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return empty response for failed external resources
    return new Response('', { status: 408 });
  }
}

// Update cache in background
async function updateCacheInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response);
    }
  } catch (error) {
    // Silently fail background updates
    console.warn('Background cache update failed:', error);
  }
}

// Check if request is to a cached API
function isAPIRequest(url) {
  return API_ENDPOINTS.some(endpoint => url.href.includes(endpoint));
}

// Create offline fallback page
function createOfflinePage() {
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PrayerSync - Offline</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: #f8fafc;
                color: #1e293b;
            }
            .offline-container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 400px;
            }
            .offline-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            h1 {
                margin-bottom: 1rem;
                color: #1e3a5f;
            }
            p {
                margin-bottom: 1.5rem;
                color: #64748b;
            }
            button {
                background: #1e3a5f;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                cursor: pointer;
                font-size: 1rem;
            }
            button:hover {
                background: #2c4a70;
            }
        </style>
    </head>
    <body>
        <div class="offline-container">
            <div class="offline-icon">🕌</div>
            <h1>PrayerSync</h1>
            <p>You're currently offline. Some features may be limited, but cached prayer times are still available.</p>
            <button onclick="window.location.reload()">Try Again</button>
        </div>
    </body>
    </html>
  `;
  
  return new Response(offlineHTML, {
    headers: {
      'Content-Type': 'text/html',
      'X-Served-By': 'ServiceWorker-Offline'
    }
  });
}

// Handle background sync for prayer time updates
self.addEventListener('sync', event => {
  if (event.tag === 'prayer-times-sync') {
    event.waitUntil(syncPrayerTimes());
  }
});

// Sync prayer times in background
async function syncPrayerTimes() {
  try {
    console.log('Background sync: Updating prayer times');
    
    // Get user's stored location
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Notify clients that sync is happening
      clients.forEach(client => {
        client.postMessage({
          type: 'BACKGROUND_SYNC',
          action: 'PRAYER_TIMES_UPDATE'
        });
      });
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle push notifications (for future prayer reminders)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Prayer time reminder',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: 'prayer-reminder',
      requireInteraction: true,
      actions: [
        {
          action: 'mark-prayed',
          title: 'Mark as Prayed'
        },
        {
          action: 'remind-later',
          title: 'Remind in 5 min'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Prayer Time', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'mark-prayed') {
    // Handle marking prayer as completed
    event.waitUntil(
      clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'PRAYER_ACTION',
            action: 'MARK_COMPLETE',
            prayer: event.notification.tag
          });
        });
      })
    );
  } else if (event.action === 'remind-later') {
    // Schedule another reminder
    event.waitUntil(
      clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'PRAYER_ACTION',
            action: 'REMIND_LATER',
            prayer: event.notification.tag
          });
        });
      })
    );
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});

// Message handling from main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('Service Worker: Script loaded successfully');