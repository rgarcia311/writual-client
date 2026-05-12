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
    // Dev rewrites below hit the API over HTTP; AI PDF import can run many minutes. Next's
    // default proxied-rewrite window (~30s) otherwise closes the connection (ECONNRESET / "Failed to proxy").
    // Production: multi-minute *synchronous* HTTP is an anti-pattern on serverless (platform limits are
    // typically seconds to a few minutes). Running this import in production will require an async
    // pattern (e.g. job queue + client polling, or webhooks) rather than only raising timeouts here.
    experimental: {
        webpackMemoryOptimizations: true,
        proxyTimeout: 600_000,
    },
  async rewrites() {
    const origin = apiOriginForRewrites();
    return [
      { source: '/api/screenplay/:path*', destination: `${origin}/api/screenplay/:path*` },
    ]
  },
  }
   
  module.exports = nextConfig