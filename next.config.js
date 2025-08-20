/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  experimental: {
    // App Router の最適化を有効化
    appDir: true,
  },
  // パフォーマンス最適化
  swcMinify: true,
  reactStrictMode: true,
  
  // 画像最適化設定
  images: {
    formats: ['image/webp'],
    domains: ['localhost'], // 必要に応じて追加
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
        ],
      },
    ]
  },
  
  // 環境変数の設定
  env: {
    CUSTOM_NODE_ENV: process.env.NODE_ENV,
  },
}

module.exports = withBundleAnalyzer(nextConfig)
