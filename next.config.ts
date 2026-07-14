import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow loading Next.js dev resources (HMR, /_next/*) when the dev server is
  // reached over the LAN — e.g. testing the PWA install/offline from a phone.
  // Dev-only; has no effect on production builds.
  allowedDevOrigins: ['192.168.178.33'],
}

export default nextConfig
