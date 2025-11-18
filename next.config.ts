import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone mode disabled for Vercel compatibility
  // Vercel's build system doesn't work with standalone output mode
  // This prevents the routes-manifest.json error
  // For Docker deployments, you can enable it by uncommenting:
  // output: 'standalone',
  
  // Disable ESLint during builds (linting should be done in CI/CD)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript type checking during builds (type checking should be done in CI/CD)
  typescript: {
    ignoreBuildErrors: false, // Keep type checking enabled
  },
  
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
