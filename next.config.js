/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/send-campaign": ["./node_modules/@sparticuz/chromium/bin/**"]
  }
};

module.exports = nextConfig;
