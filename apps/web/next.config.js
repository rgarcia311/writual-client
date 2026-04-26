/** @type {import('next').NextConfig} */
const path = require('path')

/**
 * Must match getApiOrigin() in src/lib/config.ts so the browser can call same-origin
 * /api/screenplay/* and avoid cross-origin "Failed to fetch" for REST when the app and API
 * run on different hosts/ports in dev.
 */
function apiOriginForRewrites() {
  const explicit = process.env.NEXT_PUBLIC_API_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const gql = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:8080';
  try {
    return new URL(gql).origin;
  } catch {
    return 'http://localhost:8080';
  }
}

const nextConfig = {
    sassOptions: {
        includePaths: [path.join(__dirname, '/src/app/styles')],
    },
    experimental: {
        webpackMemoryOptimizations: true,
    },
  async rewrites() {
    const origin = apiOriginForRewrites();
    return [
      { source: '/api/screenplay/:path*', destination: `${origin}/api/screenplay/:path*` },
    ]
  },
  }
   
  module.exports = nextConfig