import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone mode disabled for Vercel compatibility
  // Vercel's build system doesn't work with standalone output mode
  // This prevents the routes-manifest.json error
  // For Docker deployments, you can enable it by uncommenting:
  // output: 'standalone',
  
  // Optimize images
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
