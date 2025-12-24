/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: { buildActivity: false },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gelato-api-live.s3.eu-west-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'darkcontraster.com',
      },
      {
        protocol: 'https',
        hostname: 'www.darkcontraster.com',
      },
    ],
  },
};

module.exports = nextConfig;
