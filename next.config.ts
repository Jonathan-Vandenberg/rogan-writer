import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker (not for Vercel)
  // Vercel has its own build system and doesn't need standalone mode
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  
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
