const path = require('path')
const dotenv = require('dotenv')
const fs = require('fs')

// Load root .env files so shared keys (ANTHROPIC_API_KEY, etc.) are available
const rootEnv = path.resolve(__dirname, '../../.env')
const rootEnvLocal = path.resolve(__dirname, '../../.env.local')
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false })
if (fs.existsSync(rootEnvLocal)) dotenv.config({ path: rootEnvLocal, override: false })

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@reelforge/db'],
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    outputFileTracingIncludes: {
      '/*': [
        '../../node_modules/.prisma/client/**/*',
        '../../node_modules/@prisma/client/**/*',
        '../../packages/db/node_modules/.prisma/client/**/*',
        '../../packages/db/node_modules/@prisma/client/**/*',
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '*.pub-cdn.apyhi.com' },
    ],
  },
}

module.exports = nextConfig
