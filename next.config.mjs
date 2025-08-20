/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15.5.0 対応設定
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
  
  // 画像最適化設定
  images: {
    domains: [],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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
        ],
      },
    ];
  },
  
  // パフォーマンス最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // 出力設定
  output: 'standalone',
  
  // webpack設定（必要最小限）
  webpack: (config, { isServer }) => {
    // Production最適化
    if (process.env.NODE_ENV === 'production') {
      config.optimization = {
        ...config.optimization,
        sideEffects: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;