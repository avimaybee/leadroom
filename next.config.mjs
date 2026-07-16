/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Note: COOP header intentionally omitted to avoid breaking Firebase Auth popup flows.
  // Firebase Auth uses window.open for popup sign-in which requires cross-origin access.
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

// Only initialize OpenNext Cloudflare for development mode
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev()).catch((e) => console.error("Failed to init OpenNext for dev", e));
}
