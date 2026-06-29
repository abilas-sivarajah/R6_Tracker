/** @type {import('next').NextConfig} */
const nextConfig = {
  // r6api.js (and node-fetch) are server-only CommonJS/ESM hybrids.
  // Keep them external to the server bundle so they run as plain Node modules.
  serverExternalPackages: ['r6api.js'],
  images: {
    // Rank / avatar / season icons are served from Ubisoft + r6api.js CDNs.
    remotePatterns: [
      { protocol: 'https', hostname: '**.akamaized.net' },
      { protocol: 'https', hostname: '**.ubi.com' },
      { protocol: 'https', hostname: 'staticctf.akamaized.net' },
      { protocol: 'https', hostname: 'ubisoft-avatars.akamaized.net' },
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
