import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@oneoral/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/dzjztoqun/**',
      },
    ],
  },
};

export default nextConfig;
