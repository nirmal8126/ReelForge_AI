const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@reelforge/db'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/*': [
      '../../node_modules/.prisma/client/**/*',
      '../../node_modules/@prisma/client/**/*',
      '../../packages/db/node_modules/.prisma/client/**/*',
      '../../packages/db/node_modules/@prisma/client/**/*',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
}

module.exports = nextConfig
