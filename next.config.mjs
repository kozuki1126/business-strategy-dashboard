/**
 * Next.js Production Configuration for Task #014
 * Optimized for 100CCU Load and 99.5% Availability
 */

const nextConfig = {
  // Enable React strict mode for better development checks
  reactStrictMode: true,

  // ==========================================
  // PERFORMANCE OPTIMIZATIONS
  // ==========================================

  // Experimental features for performance
  experimental: {
    // Enable React Compiler for better performance
    reactCompiler: true,

  // ppr は canary 限定。安定版では無効化
    // Optimize package imports for smaller bundles
    optimizePackageImports: [
      'recharts',
      'date-fns',
      'lucide-react'
    ]
  },

  // Next 15+: externalize specific server deps at top-level (moved from experimental)
  serverExternalPackages: [
    'sharp',
    'canvas'
  ],

  // ==========================================
  // BUILD OPTIMIZATIONS
  // ==========================================

  // Optimize output for production
  output: 'standalone',

  // Enable gzip compression
  compress: true,

  // PoweredBy header removal for security
  poweredByHeader: false,

  // ==========================================
  // IMAGE OPTIMIZATIONS
  // ==========================================

  images: {
    // Enable modern image formats
    formats: ['image/webp', 'image/avif'],

    // Optimize image sizes for dashboard
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Enable image optimization
    minimumCacheTTL: 86400, // 24 hours

    // Domains for external images
    domains: [
      'images.unsplash.com',
      'avatars.githubusercontent.com'
    ],

    // Loader configuration for optimal delivery
    loader: 'default',
    path: '/_next/image/'
  },

  // ==========================================
  // HEADERS AND SECURITY
  // ==========================================

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=600' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' }
        ]
      },
      {
        source: '/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      {
        source: '/(dashboard|analytics|sales|export|audit)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=600, stale-while-revalidate=1200' },
          { key: 'X-Preload', value: 'prefetch' }
        ]
      }
    ]
  },

  // ==========================================
  // REDIRECTS AND REWRITES
  // ==========================================

  async redirects() {
    return [
      { source: '/admin', destination: '/dashboard', permanent: false },
      { source: '/login', destination: '/auth', permanent: false }
    ]
  },

  async rewrites() {
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/metrics', destination: '/api/monitoring/metrics' }
    ]
  },

  // ==========================================
  // WEBPACK OPTIMIZATIONS
  // ==========================================

  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!dev) {
      config.devtool = 'source-map'
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: { minChunks: 2, priority: -20, reuseExistingChunk: true },
            vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors', priority: -10, chunks: 'all' },
            react: { test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/, name: 'react', priority: 20, chunks: 'all' },
            recharts: { test: /[\\/]node_modules[\\/]recharts[\\/]/, name: 'recharts', priority: 15, chunks: 'all' },
            supabase: { test: /[\\/]node_modules[\\/]@supabase[\\/]/, name: 'supabase', priority: 15, chunks: 'all' }
          }
        }
      }
    }

    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.BUILD_ID': JSON.stringify(buildId),
        'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
      })
    )

    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src')
    }

    return config
  },

  // ==========================================
  // COMPILER OPTIONS
  // ==========================================

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    styledComponents: false
  },

  // ==========================================
  // TYPESCRIPT CONFIGURATION
  // ==========================================

  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: false
  },

  // ==========================================
  // ESLint CONFIGURATION
  // ==========================================

  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', 'pages', 'app']
  },

  // ==========================================
  // ENVIRONMENT CONFIGURATION
  // ==========================================

  env: {
    ENABLE_PERFORMANCE_MONITORING: process.env.ENABLE_PERFORMANCE_MONITORING || 'true',
    ENABLE_SLO_MONITORING: process.env.ENABLE_SLO_MONITORING || 'true',
    BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString()
  },

  // ==========================================
  // DEPLOYMENT CONFIGURATION
  // ==========================================

  trailingSlash: false,

  generateBuildId: async () => {
    const { execSync } = require('child_process')
    try {
      return execSync('git rev-parse HEAD').toString().trim()
    } catch {
      return Date.now().toString()
    }
  },

  // ==========================================
  // MONITORING CONFIGURATION
  // ==========================================

  productionBrowserSourceMaps: false,

  modularizeImports: {
    'recharts': { transform: 'recharts/lib/{{member}}', preventFullImport: true },
    'date-fns': { transform: 'date-fns/{{member}}', preventFullImport: true },
    'lucide-react': { transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}', preventFullImport: true }
  }
}

export default nextConfig
