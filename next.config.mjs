/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15.5.0 最適化設定
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', '@supabase/supabase-js'],
    optimizeServerReact: true, // Server component optimization
    serverMinification: true, // Server code minification
    serverSourceMaps: false, // Disable source maps in production
    
    // Advanced caching - ISR settings moved to Route Handler level
    staleTimes: {
      dynamic: 30, // 30 seconds for dynamic content
      static: 300, // 5 minutes for static content
    },
    
    // Performance optimizations
    webVitalsAttribution: ['CLS', 'LCP', 'FCP', 'TTFB', 'FID'],
    
    // Bundle optimizations
    optimizeCss: true,
  },
  
  // Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    }
  },
  
  // React設定
  reactStrictMode: true,
  
  // PWA準備 - Service Worker設定
  async rewrites() {
    return [
      {
        source: '/sw.js',
        destination: '/_next/static/sw.js',
      },
    ]
  },
  
  // 画像最適化強化
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 3600, // 1 hour cache
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    unoptimized: false,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    
    // Advanced image optimization
    loader: 'default',
    path: '/_next/image',
    loaderFile: '',
    disableStaticImages: false,
  },
  
  // セキュリティヘッダー強化
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
      // 静的アセットの長期キャッシュ
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API レスポンスのキャッシュ最適化
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'max-age=300',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding, Authorization',
          },
        ],
      },
    ];
  },
  
  // パフォーマンス最適化強化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
    reactRemoveProperties: process.env.NODE_ENV === 'production',
    
    // Styled-components optimization
    styledComponents: true,
    
    // Bundle analyzer integration
    ...(process.env.ANALYZE === 'true' && {
      bundleAnalyzer: {
        enabled: true,
        openAnalyzer: false,
      }
    }),
  },
  
  // 出力設定最適化
  output: 'standalone',
  generateEtags: true,
  poweredByHeader: false,
  compress: true,
  
  // Webpack設定高度最適化
  webpack: (config, { isServer, dev }) => {
    // Production最適化
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        
        // Tree shaking強化
        usedExports: true,
        sideEffects: false,
        
        // Bundle splitting最適化
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            
            // Framework bundle
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            
            // Commons bundle for shared modules
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
              priority: 20,
              reuseExistingChunk: true,
              enforce: true,
            },
            
            // Lib bundle for third-party libraries
            lib: {
              name: 'lib',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            
            // Charts bundle (heavy dependencies)
            charts: {
              name: 'charts',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](recharts|echarts)[\\/]/,
              priority: 30,
              enforce: true,
            },
            
            // Supabase bundle
            supabase: {
              name: 'supabase',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              priority: 25,
              enforce: true,
            },
          },
        },
        
        // Use Next.js 15 default minimization - no custom minimizer
        minimize: true,
        // Remove custom minimizer configuration to avoid path issues
      }
      
      // Memory leak prevention
      config.optimization.runtimeChunk = {
        name: 'runtime',
      }
    }
    
    // Server-side optimizations
    if (isServer) {
      config.optimization = {
        ...config.optimization,
        concatenateModules: true,
      }
    }
    
    // Bundle analysis
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
        })
      )
    }
    
    // Module optimization
    config.module.rules.push(
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      }
    )
    
    // Performance hints
    if (!dev) {
      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 400000, // 400KB
        maxAssetSize: 400000, // 400KB
      }
    }
    
    return config
  },
  
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    cleanDistDir: true,
    
    // Disable development features
    reactStrictMode: false, // Can cause double renders
    
    // Advanced production optimizations
    productionBrowserSourceMaps: false,
    modularizeImports: {
      'lucide-react': {
        transform: 'lucide-react/dist/esm/icons/{{member}}',
      },
      '@supabase/supabase-js': {
        transform: '@supabase/supabase-js/dist/main/{{member}}',
        skipDefaultConversion: true,
      },
    },
  }),
  
  // Development optimizations
  ...(process.env.NODE_ENV === 'development' && {
    reactStrictMode: true,
    
    // Fast refresh optimization
    fastRefresh: true,
    
    // Development mode specific settings
    onDemandEntries: {
      maxInactiveAge: 60 * 1000, // 1 minute
      pagesBufferLength: 5,
    },
    
    // Source map optimization for development
    productionBrowserSourceMaps: false,
    
    // Webpack dev server optimization
    webpackDevMiddleware: config => {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
      return config
    },
  }),
}

export default nextConfig
