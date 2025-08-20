/**
 * PWA Manager - Service Worker Registration & Management
 * Task #014: 性能・p95最適化実装 - PWA統合・クライアントサイド最適化
 * 
 * Features:
 * - Service Worker registration and lifecycle management
 * - Cache management and optimization
 * - Performance monitoring integration
 * - Offline capability management
 */

'use client'

import { useEffect, useState, useCallback } from 'react'

interface PWACapabilities {
  serviceWorkerSupported: boolean
  cacheAPISupported: boolean
  backgroundSyncSupported: boolean
  notificationsSupported: boolean
  installPromptAvailable: boolean
}

interface CacheStats {
  [cacheName: string]: number
}

interface PWAState {
  isOnline: boolean
  isInstalled: boolean
  updateAvailable: boolean
  capabilities: PWACapabilities
  cacheStats: CacheStats
  serviceWorkerStatus: 'installing' | 'installed' | 'activating' | 'activated' | 'redundant' | 'error' | null
}

interface PWAManagerProps {
  enableAutoUpdate?: boolean
  enableNotifications?: boolean
  onInstallPrompt?: () => void
  onOfflineDetected?: () => void
  onCacheUpdate?: (stats: CacheStats) => void
}

export function PWAManager({
  enableAutoUpdate = true,
  enableNotifications = false,
  onInstallPrompt,
  onOfflineDetected,
  onCacheUpdate
}: PWAManagerProps) {
  const [pwaState, setPWAState] = useState<PWAState>({
    isOnline: true,
    isInstalled: false,
    updateAvailable: false,
    capabilities: {
      serviceWorkerSupported: false,
      cacheAPISupported: false,
      backgroundSyncSupported: false,
      notificationsSupported: false,
      installPromptAvailable: false
    },
    cacheStats: {},
    serviceWorkerStatus: null
  })

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  // ========================================
  // INITIALIZATION & CAPABILITY DETECTION
  // ========================================

  const detectCapabilities = useCallback((): PWACapabilities => {
    if (typeof window === 'undefined') {
      return {
        serviceWorkerSupported: false,
        cacheAPISupported: false,
        backgroundSyncSupported: false,
        notificationsSupported: false,
        installPromptAvailable: false
      }
    }

    return {
      serviceWorkerSupported: 'serviceWorker' in navigator,
      cacheAPISupported: 'caches' in window,
      backgroundSyncSupported: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      notificationsSupported: 'Notification' in window,
      installPromptAvailable: deferredPrompt !== null
    }
  }, [deferredPrompt])

  // ========================================
  // SERVICE WORKER REGISTRATION
  // ========================================

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported')
      return null
    }

    try {
      console.log('🔧 Registering Service Worker...')
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'imports'
      })

      console.log('✅ Service Worker registered successfully')

      // Listen for service worker state changes
      const updateServiceWorkerStatus = () => {
        const sw = registration.installing || registration.waiting || registration.active
        if (sw) {
          setPWAState(prev => ({
            ...prev,
            serviceWorkerStatus: sw.state as PWAState['serviceWorkerStatus']
          }))

          sw.addEventListener('statechange', () => {
            setPWAState(prev => ({
              ...prev,
              serviceWorkerStatus: sw.state as PWAState['serviceWorkerStatus']
            }))

            if (sw.state === 'activated') {
              console.log('🎉 Service Worker activated')
              updateCacheStats()
            }
          })
        }
      }

      updateServiceWorkerStatus()

      // Check for updates
      registration.addEventListener('updatefound', () => {
        console.log('🔄 Service Worker update found')
        setPWAState(prev => ({ ...prev, updateAvailable: true }))

        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('📦 New Service Worker installed, update available')
              if (enableAutoUpdate) {
                updateServiceWorker()
              }
            }
          })
        }
      })

      // Check for controller change (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker controller changed, reloading...')
        window.location.reload()
      })

      return registration
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error)
      setPWAState(prev => ({ ...prev, serviceWorkerStatus: 'error' }))
      return null
    }
  }, [enableAutoUpdate])

  // ========================================
  // SERVICE WORKER COMMUNICATION
  // ========================================

  const sendMessageToSW = useCallback(async (message: any): Promise<any> => {
    if (!navigator.serviceWorker.controller) {
      throw new Error('No active service worker')
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(event.data.error)
        } else {
          resolve(event.data.payload)
        }
      }

      navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2])
    })
  }, [])

  const updateCacheStats = useCallback(async () => {
    try {
      const stats = await sendMessageToSW({ type: 'GET_CACHE_STATS' })
      setPWAState(prev => ({ ...prev, cacheStats: stats }))
      onCacheUpdate?.(stats)
    } catch (error) {
      console.warn('Failed to get cache stats:', error)
    }
  }, [sendMessageToSW, onCacheUpdate])

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  const clearCaches = useCallback(async () => {
    try {
      await sendMessageToSW({ type: 'CLEAR_CACHE' })
      console.log('🗑️ All caches cleared')
      await updateCacheStats()
    } catch (error) {
      console.error('Failed to clear caches:', error)
    }
  }, [sendMessageToSW, updateCacheStats])

  const prefetchData = useCallback(async (urls: string[]) => {
    try {
      await sendMessageToSW({ type: 'PREFETCH_DATA', payload: { urls } })
      console.log('🚀 Data prefetching initiated')
    } catch (error) {
      console.warn('Failed to prefetch data:', error)
    }
  }, [sendMessageToSW])

  // ========================================
  // UPDATE MANAGEMENT
  // ========================================

  const updateServiceWorker = useCallback(async () => {
    try {
      await sendMessageToSW({ type: 'SKIP_WAITING' })
      console.log('🔄 Service Worker update initiated')
    } catch (error) {
      console.error('Failed to update service worker:', error)
    }
  }, [sendMessageToSW])

  // ========================================
  // INSTALLATION MANAGEMENT
  // ========================================

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      console.warn('Install prompt not available')
      return false
    }

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      console.log(`Install prompt result: ${outcome}`)
      setDeferredPrompt(null)
      
      setPWAState(prev => ({
        ...prev,
        isInstalled: outcome === 'accepted',
        capabilities: { ...prev.capabilities, installPromptAvailable: false }
      }))

      return outcome === 'accepted'
    } catch (error) {
      console.error('Install prompt failed:', error)
      return false
    }
  }, [deferredPrompt])

  // ========================================
  // NETWORK STATUS MONITORING
  // ========================================

  useEffect(() => {
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine
      setPWAState(prev => ({ ...prev, isOnline }))
      
      if (!isOnline) {
        console.warn('📴 Application is offline')
        onOfflineDetected?.()
      } else {
        console.log('🌐 Application is online')
      }
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    
    // Initial status
    updateOnlineStatus()

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [onOfflineDetected])

  // ========================================
  // INSTALL PROMPT HANDLING
  // ========================================

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      
      setDeferredPrompt(e)
      setPWAState(prev => ({
        ...prev,
        capabilities: { ...prev.capabilities, installPromptAvailable: true }
      }))
      
      console.log('💾 Install prompt available')
      onInstallPrompt?.()
    }

    const handleAppInstalled = () => {
      console.log('🎉 PWA installed successfully')
      setDeferredPrompt(null)
      setPWAState(prev => ({
        ...prev,
        isInstalled: true,
        capabilities: { ...prev.capabilities, installPromptAvailable: false }
      }))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [onInstallPrompt])

  // ========================================
  // INITIALIZATION
  // ========================================

  useEffect(() => {
    const initialize = async () => {
      // Update capabilities
      const capabilities = detectCapabilities()
      setPWAState(prev => ({ ...prev, capabilities }))

      // Register service worker
      if (capabilities.serviceWorkerSupported) {
        await registerServiceWorker()
      }

      // Setup performance monitoring
      if (capabilities.serviceWorkerSupported) {
        setTimeout(updateCacheStats, 2000) // Wait for SW to initialize
      }

      // Prefetch critical data
      if (capabilities.serviceWorkerSupported) {
        setTimeout(() => {
          prefetchData([
            '/api/analytics?start=2025-01-01&end=2025-01-31',
            '/api/sales'
          ])
        }, 5000) // Wait 5 seconds after page load
      }
    }

    initialize()
  }, [detectCapabilities, registerServiceWorker, updateCacheStats, prefetchData])

  // ========================================
  // RENDER PWA STATUS (Optional UI)
  // ========================================

  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-xs z-50">
        <div className="font-semibold mb-2">PWA Status (Dev Mode)</div>
        <div className="space-y-1">
          <div>SW: {pwaState.serviceWorkerStatus || 'Not registered'}</div>
          <div>Online: {pwaState.isOnline ? '✅' : '❌'}</div>
          <div>Installed: {pwaState.isInstalled ? '✅' : '❌'}</div>
          <div>Update Available: {pwaState.updateAvailable ? '🔄' : '✅'}</div>
          <div>Cache Items: {Object.values(pwaState.cacheStats).reduce((a, b) => a + b, 0)}</div>
        </div>
        {pwaState.updateAvailable && (
          <button
            onClick={updateServiceWorker}
            className="mt-2 bg-blue-600 px-2 py-1 rounded text-xs"
          >
            Update SW
          </button>
        )}
        {pwaState.capabilities.installPromptAvailable && (
          <button
            onClick={promptInstall}
            className="mt-2 bg-green-600 px-2 py-1 rounded text-xs ml-1"
          >
            Install
          </button>
        )}
      </div>
    )
  }

  return null
}

// ========================================
// CUSTOM HOOKS
// ========================================

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      setIsInstallable(false)
      return outcome === 'accepted'
    } catch (error) {
      console.error('Install prompt failed:', error)
      return false
    }
  }, [deferredPrompt])

  return { isInstallable, promptInstall }
}

export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true)
      })
    }
  }, [])

  const applyUpdate = useCallback(() => {
    window.location.reload()
  }, [])

  return { updateAvailable, applyUpdate }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine)
    
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    updateStatus()

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  return isOnline
}

// ========================================
// PERFORMANCE UTILITIES
// ========================================

export const PWAUtils = {
  // Check if app is running as PWA
  isPWA: () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           // @ts-ignore
           window.navigator.standalone === true
  },

  // Get cache statistics
  getCacheStats: async (): Promise<CacheStats> => {
    if (!('caches' in window)) return {}
    
    const cacheNames = await caches.keys()
    const stats: CacheStats = {}
    
    for (const name of cacheNames) {
      const cache = await caches.open(name)
      const keys = await cache.keys()
      stats[name] = keys.length
    }
    
    return stats
  },

  // Clear all caches
  clearAllCaches: async (): Promise<void> => {
    if (!('caches' in window)) return
    
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
  },

  // Prefetch critical resources
  prefetchResources: (urls: string[]): Promise<void>[] => {
    return urls.map(url => 
      fetch(url, { cache: 'force-cache' }).catch(console.warn)
    )
  }
}