/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
  webpack: (config) => {
    // react-pdf / pdfjs-dist needs canvas to be false in browser builds
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
