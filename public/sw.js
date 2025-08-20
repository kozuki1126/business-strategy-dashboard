/**
 * Service Worker for Advanced Caching & Performance Optimization
 * Task #014: 性能・p95最適化実装 - PWA・オフライン対応
 * 
 * Features:
 * - API response caching with Cache-First strategy
 * - Static asset caching with Stale-While-Revalidate
 * - Background data prefetching
 * - Network optimization
 */

const CACHE_NAME = 'business-dashboard-v1.2.0'
const CACHE_VERSION = '20250821'

// Cache configurations
const CACHE_STRATEGIES = {
  STATIC: `${CACHE_NAME}-static`,
  API: `${CACHE_NAME}-api`,
  IMAGES: `${CACHE_NAME}-images`,
  FONTS: `${CACHE_NAME}-fonts`,
}

const CACHE_DURATIONS = {
  STATIC: 7 * 24 * 60 * 60 * 1000, // 7 days
  API: 5 * 60 * 1000, // 5 minutes
  IMAGES: 30 * 24 * 60 * 60 * 1000, // 30 days
  FONTS: 365 * 24 * 60 * 60 * 1000, // 1 year
}

// Routes to cache
const STATIC_CACHE_ROUTES = [
  '/',
  '/dashboard',
  '/sales',
  '/analytics',
  '/export',
  '/audit',
  '/auth',
  '/_next/static/css/',
  '/_next/static/js/',
  '/favicon.ico',
  '/manifest.json'
]

const API_CACHE_ROUTES = [
  '/api/analytics',
  '/api/analytics/correlation',
  '/api/sales',
  '/api/audit',
  '/api/export'
]

// ========================================
// INSTALLATION & ACTIVATION
// ========================================

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...')
  
  event.waitUntil(
    Promise.all([
      // Pre-cache critical static assets
      caches.open(CACHE_STRATEGIES.STATIC).then(cache => {
        console.log('📦 Pre-caching static assets')
        return cache.addAll([
          '/',
          '/dashboard',
          '/manifest.json'
        ].filter(url => url !== ''))
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  )
})

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated')
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      cleanOldCaches(),
      
      // Claim all clients
      self.clients.claim(),
      
      // Initialize background sync
      initializeBackgroundSync()
    ])
  )
})

// ========================================
// FETCH INTERCEPTOR & CACHING STRATEGIES
// ========================================

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return
  }
  
  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request))
  } else if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request))
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
  } else if (isFontRequest(url)) {
    event.respondWith(handleFontRequest(request))
  } else if (isPageRequest(url)) {
    event.respondWith(handlePageRequest(request))
  }
})

// ========================================
// CACHING STRATEGY IMPLEMENTATIONS
// ========================================

/**
 * Static Assets: Cache First with Fallback
 */
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(CACHE_STRATEGIES.STATIC)
    const cached = await cache.match(request)
    
    if (cached && !isExpired(cached, CACHE_DURATIONS.STATIC)) {
      return cached
    }
    
    const response = await fetch(request)
    
    if (response.ok) {
      // Cache successful responses
      const responseClone = response.clone()
      await cache.put(request, responseClone)
    }
    
    return response
  } catch (error) {
    console.error('Static asset fetch failed:', error)
    
    // Return cached version as fallback
    const cache = await caches.open(CACHE_STRATEGIES.STATIC)
    const cached = await cache.match(request)
    
    if (cached) {
      return cached
    }
    
    throw error
  }
}

/**
 * API Requests: Network First with Cache Fallback
 */
async function handleAPIRequest(request) {
  const cache = await caches.open(CACHE_STRATEGIES.API)
  
  try {
    // Try network first for fresh data
    const networkResponse = await fetch(request, {
      headers: {
        ...request.headers,
        'X-Service-Worker': 'true'
      }
    })
    
    if (networkResponse.ok) {
      // Cache successful API responses
      const responseClone = networkResponse.clone()
      await cache.put(request, responseClone)
      
      // Add performance headers
      const enhancedResponse = new Response(await networkResponse.blob(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...networkResponse.headers,
          'X-Cache-Status': 'MISS',
          'X-Served-By': 'ServiceWorker',
          'X-Cache-Date': new Date().toISOString()
        }
      })
      
      return enhancedResponse
    }
    
    throw new Error(`API request failed: ${networkResponse.status}`)
  } catch (error) {
    console.warn('Network failed, trying cache:', error.message)
    
    // Fallback to cache
    const cached = await cache.match(request)
    
    if (cached && !isExpired(cached, CACHE_DURATIONS.API)) {
      // Add cache headers
      const cachedResponse = cached.clone()
      cachedResponse.headers.set('X-Cache-Status', 'HIT')
      cachedResponse.headers.set('X-Served-By', 'ServiceWorker-Cache')
      
      return cachedResponse
    }
    
    // Return error response if no cache available
    return new Response(
      JSON.stringify({
        error: 'Network unavailable and no cached data',
        offline: true,
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Status': 'MISS',
          'X-Error-Type': 'OFFLINE'
        }
      }
    )
  }
}

/**
 * Images: Stale While Revalidate
 */
async function handleImageRequest(request) {
  const cache = await caches.open(CACHE_STRATEGIES.IMAGES)
  const cached = await cache.match(request)
  
  // Return cached immediately if available
  if (cached) {
    // Background update if expired
    if (isExpired(cached, CACHE_DURATIONS.IMAGES)) {
      event.waitUntil(updateImageCache(request, cache))
    }
    return cached
  }
  
  // Fetch and cache if not available
  try {
    const response = await fetch(request)
    if (response.ok) {
      const responseClone = response.clone()
      await cache.put(request, responseClone)
    }
    return response
  } catch (error) {
    console.error('Image fetch failed:', error)
    throw error
  }
}

/**
 * Fonts: Cache First (Long-term)
 */
async function handleFontRequest(request) {
  const cache = await caches.open(CACHE_STRATEGIES.FONTS)
  const cached = await cache.match(request)
  
  if (cached) {
    return cached
  }
  
  const response = await fetch(request)
  
  if (response.ok) {
    const responseClone = response.clone()
    await cache.put(request, responseClone)
  }
  
  return response
}

/**
 * Pages: Network First with Shell Fallback
 */
async function handlePageRequest(request) {
  try {
    const response = await fetch(request)
    return response
  } catch (error) {
    console.warn('Page fetch failed, serving app shell:', error)
    
    // Return app shell for offline experience
    const cache = await caches.open(CACHE_STRATEGIES.STATIC)
    const appShell = await cache.match('/')
    
    if (appShell) {
      return appShell
    }
    
    throw error
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') ||
         url.pathname.includes('.css') ||
         url.pathname.includes('.js') ||
         url.pathname.includes('.woff') ||
         url.pathname.includes('.woff2') ||
         url.pathname === '/favicon.ico' ||
         url.pathname === '/manifest.json'
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isImageRequest(url) {
  return url.pathname.includes('.jpg') ||
         url.pathname.includes('.jpeg') ||
         url.pathname.includes('.png') ||
         url.pathname.includes('.gif') ||
         url.pathname.includes('.webp') ||
         url.pathname.includes('.avif') ||
         url.pathname.includes('.svg')
}

function isFontRequest(url) {
  return url.pathname.includes('.woff') ||
         url.pathname.includes('.woff2') ||
         url.pathname.includes('.ttf') ||
         url.pathname.includes('.eot')
}

function isPageRequest(url) {
  return !isStaticAsset(url) && 
         !isAPIRequest(url) && 
         !isImageRequest(url) && 
         !isFontRequest(url) &&
         (url.pathname === '/' || 
          url.pathname.startsWith('/dashboard') ||
          url.pathname.startsWith('/sales') ||
          url.pathname.startsWith('/analytics') ||
          url.pathname.startsWith('/export') ||
          url.pathname.startsWith('/audit') ||
          url.pathname.startsWith('/auth'))
}

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date')
  if (!dateHeader) return true
  
  const responseDate = new Date(dateHeader)
  const now = new Date()
  
  return (now.getTime() - responseDate.getTime()) > maxAge
}

async function updateImageCache(request, cache) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response)
    }
  } catch (error) {
    console.warn('Background image update failed:', error)
  }
}

async function cleanOldCaches() {
  const cacheNames = await caches.keys()
  const oldCaches = cacheNames.filter(name => 
    name.startsWith('business-dashboard-') && !name.includes(CACHE_VERSION)
  )
  
  await Promise.all(
    oldCaches.map(name => {
      console.log(`🗑️ Deleting old cache: ${name}`)
      return caches.delete(name)
    })
  )
}

// ========================================
// BACKGROUND SYNC & PREFETCHING
// ========================================

async function initializeBackgroundSync() {
  // Register background sync for offline actions
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    self.registration.sync.register('analytics-data-sync')
    console.log('📊 Background sync registered for analytics data')
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'analytics-data-sync') {
    event.waitUntil(syncAnalyticsData())
  }
})

async function syncAnalyticsData() {
  try {
    console.log('🔄 Syncing analytics data in background...')
    
    // Prefetch common analytics queries
    const commonQueries = [
      '/api/analytics?start=2025-01-01&end=2025-01-31',
      '/api/analytics/correlation',
      '/api/sales'
    ]
    
    await Promise.all(
      commonQueries.map(async (url) => {
        try {
          const response = await fetch(url)
          if (response.ok) {
            const cache = await caches.open(CACHE_STRATEGIES.API)
            await cache.put(url, response)
            console.log(`✅ Prefetched: ${url}`)
          }
        } catch (error) {
          console.warn(`❌ Prefetch failed for ${url}:`, error)
        }
      })
    )
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}

// ========================================
// MESSAGE HANDLING
// ========================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'GET_CACHE_STATS':
      getCacheStats().then(stats => {
        event.ports[0].postMessage({ type: 'CACHE_STATS', payload: stats })
      })
      break
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' })
      })
      break
      
    case 'PREFETCH_DATA':
      prefetchData(payload.urls)
      break
      
    default:
      console.warn('Unknown message type:', type)
  }
})

async function getCacheStats() {
  const cacheNames = await caches.keys()
  const stats = {}
  
  for (const name of cacheNames) {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    stats[name] = keys.length
  }
  
  return stats
}

async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(name => caches.delete(name)))
  console.log('🗑️ All caches cleared')
}

async function prefetchData(urls) {
  console.log('🚀 Prefetching data:', urls)
  
  await Promise.all(
    urls.map(async (url) => {
      try {
        await fetch(url)
        console.log(`✅ Prefetched: ${url}`)
      } catch (error) {
        console.warn(`❌ Prefetch failed for ${url}:`, error)
      }
    })
  )
}

// ========================================
// PERFORMANCE MONITORING
// ========================================

self.addEventListener('fetch', (event) => {
  // Track cache performance
  const startTime = performance.now()
  
  event.respondWith(
    handleRequest(event.request).then(response => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Log slow requests
      if (duration > 1000) {
        console.warn(`🐌 Slow request (${duration.toFixed(2)}ms): ${event.request.url}`)
      }
      
      return response
    })
  )
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  if (isAPIRequest(url)) {
    return handleAPIRequest(request)
  } else if (isStaticAsset(url)) {
    return handleStaticAsset(request)
  } else if (isImageRequest(url)) {
    return handleImageRequest(request)
  } else if (isFontRequest(url)) {
    return handleFontRequest(request)
  } else if (isPageRequest(url)) {
    return handlePageRequest(request)
  } else {
    return fetch(request)
  }
}

console.log('🔧 Service Worker loaded and ready for caching optimization')