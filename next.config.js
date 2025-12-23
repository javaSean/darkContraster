/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gelato-api-live.s3.eu-west-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'darkcontraster.com',
      },
    ],
  },
};

module.exports = nextConfig;
