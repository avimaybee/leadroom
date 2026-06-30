/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard/leads/:id/research',
        destination: '/leads/:id?view=research',
        permanent: true,
      },
      {
        source: '/dashboard/leads/:id',
        destination: '/leads/:id',
        permanent: true,
      },
      {
        source: '/dashboard/discovery/scopes/:id',
        destination: '/scopes/:id',
        permanent: true,
      },
      {
        source: '/dashboard/discovery',
        destination: '/scopes',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
