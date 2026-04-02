/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium']
  }
};

module.exports = nextConfig;
