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
}

module.exports = nextConfig
