/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the dev server to be opened from other devices on the LAN (e.g. your
  // phone) without the cross-origin dev warning. Add your PC's local IP(s).
  allowedDevOrigins: ['192.168.152.1', '192.168.0.1', '10.150.17.40'],
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
