import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: root,
  reactStrictMode: true,
  transpilePackages: ['@spaceborn/web-core'],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'robu-prod-media.s3.ap-south-1.amazonaws.com' },
      { protocol: 'https', hostname: 'robu.in' },
      { protocol: 'https', hostname: 'robocraze.com' },
    ],
  },
  // In AWS the load balancer routes /v1 to the API before requests reach Next.
  async rewrites() {
    return process.env.NODE_ENV === 'production' ? [] : [{ source: '/v1/:path*', destination: `${apiOrigin}/v1/:path*` }];
  },
};

export default nextConfig;
