/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  allowedDevOrigins: [
    '35.154.243.128',
    '35.154.243.128:3000',
    '35.154.243.128:3001',
    '35.154.243.128:3002',
    '*.trycloudflare.com',
    'localhost:3000',
    'localhost:3001',
    'localhost:3002'
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
