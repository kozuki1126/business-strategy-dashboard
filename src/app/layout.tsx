/**
 * Root Layout with Advanced Performance Optimizations
 * Task #014: 性能・p95最適化実装 - PWA統合・メタデータ最適化
 */

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { PWAManager } from '@/components/pwa/PWAManager'
import './globals.css'

// Font optimization with preload
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'sans-serif']
})

// ========================================
// VIEWPORT CONFIGURATION
// ========================================

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' }
  ],
  colorScheme: 'light dark'
}

// ========================================
// METADATA CONFIGURATION  
// ========================================

export const metadata: Metadata = {
  // Basic metadata
  title: {
    default: '経営戦略ダッシュボード',
    template: '%s | 経営戦略ダッシュボード'
  },
  description: '株価・為替・天候・売上データを統合し、経営判断を支援する高性能ダッシュボード。リアルタイム分析・相関解析・データエクスポート機能を提供。',
  
  // PWA Configuration
  applicationName: '経営戦略ダッシュボード',
  manifest: '/manifest.json',
  
  // SEO Optimization
  keywords: [
    '経営ダッシュボード', 'ビジネス分析', '売上管理', '相関分析', 
    'データ可視化', '経営支援', 'KPI監視', 'パフォーマンス分析',
    '株価連動', '為替影響', '天候分析', 'インバウンド統計'
  ],
  authors: [{ name: 'Business Strategy Dashboard Team' }],
  creator: 'Business Strategy Dashboard',
  publisher: 'Business Strategy Dashboard',
  
  // Language and locale
  alternates: {
    canonical: 'https://business-strategy-dashboard.vercel.app',
    languages: {
      'ja-JP': 'https://business-strategy-dashboard.vercel.app'
    }
  },
  
  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://business-strategy-dashboard.vercel.app',
    title: '経営戦略ダッシュボード - データ分析で経営判断を最適化',
    description: '外部指標と売上データを統合した高性能ダッシュボード。リアルタイム分析で経営判断を支援します。',
    siteName: '経営戦略ダッシュボード',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '経営戦略ダッシュボード - メイン画面'
      }
    ]
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: '経営戦略ダッシュボード',
    description: '外部指標×売上で意思決定を加速',
    images: ['/twitter-image.png']
  },
  
  // Technical metadata
  robots: {
    index: false, // Internal tool
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false
    }
  },
  
  // Performance hints
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Dashboard',
    'format-detection': 'telephone=no',
    'msapplication-tap-highlight': 'no',
    
    // Security
    'referrer-policy': 'strict-origin-when-cross-origin',
    
    // Performance
    'resource-hints': 'preconnect, dns-prefetch',
    
    // PWA
    'theme-color': '#1f2937',
    'background-color': '#ffffff'
  },
  
  // Apple specific
  appleWebApp: {
    capable: true,
    title: 'Dashboard',
    statusBarStyle: 'default'
  },
  
  // Icons
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' }
    ],
    shortcut: '/favicon.ico'
  }
}

// ========================================
// ROOT LAYOUT COMPONENT
// ========================================

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja" className={inter.className}>
      <head>
        {/* DNS Prefetch for external resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />
        
        {/* Preconnect for critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        
        {/* Resource Hints */}
        <link rel="prefetch" href="/api/analytics" />
        <link rel="prefetch" href="/api/sales" />
        
        {/* Critical CSS (inline small critical styles) */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Critical loading styles */
            body { 
              margin: 0; 
              padding: 0; 
              font-family: ${inter.style.fontFamily}, system-ui, -apple-system, sans-serif;
              line-height: 1.5;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            
            /* Loading spinner for initial load */
            .loading-spinner {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 32px;
              height: 32px;
              border: 3px solid #f3f4f6;
              border-top: 3px solid #3b82f6;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              z-index: 9999;
            }
            
            @keyframes spin {
              0% { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
            
            /* Hide scrollbar during initial load */
            .loading body {
              overflow: hidden;
            }
          `
        }} />
        
        {/* Web App Manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon-180x180.png" />
        
        {/* Microsoft Tiles */}
        <meta name="msapplication-TileColor" content="#1f2937" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Performance Monitoring (Development) */}
        {process.env.NODE_ENV === 'development' && (
          <script dangerouslySetInnerHTML={{
            __html: `
              // Performance monitoring
              if (typeof window !== 'undefined') {
                window.addEventListener('load', () => {
                  setTimeout(() => {
                    if ('performance' in window) {
                      const perf = performance.getEntriesByType('navigation')[0];
                      console.log('⚡ Performance Metrics:');
                      console.log('  - DOM Load:', (perf.domContentLoadedEventEnd - perf.navigationStart).toFixed(2) + 'ms');
                      console.log('  - Page Load:', (perf.loadEventEnd - perf.navigationStart).toFixed(2) + 'ms');
                      console.log('  - First Paint:', performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime.toFixed(2) + 'ms');
                      console.log('  - FCP:', performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime.toFixed(2) + 'ms');
                    }
                  }, 1000);
                });
              }
            `
          }} />
        )}
      </head>
      
      <body suppressHydrationWarning>
        {/* PWA Manager - Service Worker & Cache Management */}
        <PWAManager 
          enableAutoUpdate={true}
          enableNotifications={false}
          onOfflineDetected={() => {
            console.warn('📴 Application went offline - cached data will be used')
          }}
          onCacheUpdate={(stats) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('💾 Cache updated:', stats)
            }
          }}
        />
        
        {/* Main Application Content */}
        <div id="app-root" className="min-h-screen">
          {children}
        </div>
        
        {/* Loading Indicator for Initial Load */}
        <div id="loading-indicator" className="loading-spinner" style={{ display: 'none' }} />
        
        {/* Performance Script */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Remove loading class when page is interactive
            document.addEventListener('DOMContentLoaded', () => {
              document.body.classList.remove('loading');
              const loadingIndicator = document.getElementById('loading-indicator');
              if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
              }
            });
            
            // Critical resource loading optimization
            if (typeof window !== 'undefined') {
              // Preload critical pages
              const preloadPages = ['/dashboard', '/sales', '/analytics'];
              const preloadAPIs = ['/api/analytics', '/api/sales'];
              
              window.addEventListener('load', () => {
                // Prefetch critical pages after main load
                setTimeout(() => {
                  [...preloadPages, ...preloadAPIs].forEach(url => {
                    const link = document.createElement('link');
                    link.rel = 'prefetch';
                    link.href = url;
                    document.head.appendChild(link);
                  });
                }, 2000);
              });
              
              // Page visibility optimization
              document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                  // Page became visible - refresh data if stale
                  if (window.lastDataFetch && Date.now() - window.lastDataFetch > 5 * 60 * 1000) {
                    // Trigger data refresh if last fetch was > 5 minutes ago
                    window.dispatchEvent(new CustomEvent('refreshData'));
                  }
                }
              });
            }
          `
        }} />
      </body>
    </html>
  )
}