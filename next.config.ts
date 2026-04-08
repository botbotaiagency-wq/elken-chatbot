import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'voyageai',
    'pdf-parse',
    'mammoth',
    'sharp',
    'cheerio'
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co'
      }
    ]
  }
}

export default nextConfig