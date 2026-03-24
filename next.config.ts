import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    '@react-pdf/renderer',
    '@react-pdf/layout',
    '@react-pdf/pdfkit',
    '@react-pdf/render',
    'yoga-layout',
  ],
  transpilePackages: [
    'emoji-regex-xs',
  ],
}

export default nextConfig
